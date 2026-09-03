#!/usr/bin/env bash
# Copyright (c) 2026 unigma contributors. Licensed under the MIT License.
#
# Fails the build when anything inside a packaged unigma-server tree asks the
# dynamic loader for a glibc, libstdc++ or C++ ABI symbol version newer than the
# baseline the product already promises its users.
#
# The baseline is not invented here. `resources/server/bin/helpers/check-requirements-linux.sh`
# ships inside the package and refuses to start below GLIBC 2.28 / GLIBCXX
# 3.4.25, and `src/vs/server/node/remoteAgentEnvironmentImpl.ts` marks anything
# under glibc 2.28 unsupported. This gate exists so the build cannot contradict
# that promise: run 33784052687 loaded every addon of an activated server on a
# real host and six of eight failed, because they had been compiled against the
# build host's own toolchain rather than the vendored sysroot.
#
# Deliberate divergence from `build/azure-pipelines/linux/verify-glibc-requirements.sh`,
# which this replaces for unigma:
#
#   * that script exits 1 for GLIBC but only echoes for GLIBCXX, and never looks
#     at CXXABI at all. `@vscode/spdlog` and `kerberos` broke on exactly
#     GLIBCXX_3.4.31 and CXXABI_1.3.15, so an upstream-faithful gate would have
#     passed the artifact that the runner then proved dead. All three fail here;
#   * that script hard-codes the sysroot's objdump and prints absolute paths.
#
# It is a separate file rather than an edit because the upstream script lives
# under `build/azure-pipelines/`, which no longer runs in this fork, and because
# these semantics are a fork decision that should not be attributed to upstream.
#
# Usage: verify-server-symbol-baseline.sh <server-root>

set -euo pipefail

if [ "$#" -ne 1 ]; then
	echo "usage: verify-server-symbol-baseline.sh <server-root>" >&2
	exit 2
fi

# Strip any trailing slash so the relative paths reported below never start with
# one and never reveal where the runner keeps its build tree.
server_root="${1%/}"

if [ ! -d "$server_root" ]; then
	echo "server root is not a directory" >&2
	exit 1
fi

expected_glibc="${EXPECTED_GLIBC_VERSION:-2.28}"
expected_glibcxx="${EXPECTED_GLIBCXX_VERSION:-3.4.25}"
# libstdc++ does not version GLIBCXX and CXXABI in step, so the C++ ABI level has
# to be named separately. 1.3.11 is the level that ships next to GLIBCXX_3.4.25
# in gcc 8.5, which is the compiler inside the remote sysroot; anything newer
# means the object was not built against that sysroot.
expected_cxxabi="${EXPECTED_CXXABI_VERSION:-1.3.11}"

triple="${UNIGMA_SERVER_TRIPLE:-x86_64-linux-gnu}"

# Resolving objdump.
#
# The sysroot's own binutils is preferred: it is the toolchain that produced the
# objects, it is checksum-pinned, and it makes the gate independent of whatever
# binutils the build host happens to carry. It is not required, though. `-T`
# only prints the ELF version-needs table, which any binutils new enough to read
# a 64-bit ELF renders identically, so a host objdump is an acceptable
# fallback. What is not acceptable is having none: a gate that cannot read the
# files must fail, not pass quietly.
objdump_bin="${UNIGMA_OBJDUMP:-}"
objdump_origin="explicit"
if [ -z "$objdump_bin" ] && [ -n "${VSCODE_REMOTE_SYSROOT_DIR:-}" ]; then
	# Two candidates because the vendored callers disagree about the layout:
	# `verify-glibc-requirements.sh` reads the doubled-triple binutils directory
	# while `setup-env.sh` reads the single-triple one for gcc. Probing costs
	# nothing and avoids pinning a layout this script cannot verify on its own.
	for candidate in \
		"$VSCODE_REMOTE_SYSROOT_DIR/$triple/$triple/bin/objdump" \
		"$VSCODE_REMOTE_SYSROOT_DIR/$triple/bin/$triple-objdump"
	do
		if [ -x "$candidate" ]; then
			objdump_bin="$candidate"
			objdump_origin="sysroot"
			break
		fi
	done
fi
if [ -z "$objdump_bin" ] && command -v objdump >/dev/null 2>&1; then
	objdump_bin="objdump"
	objdump_origin="build host"
fi
if [ -z "$objdump_bin" ]; then
	echo "no objdump found in the remote sysroot or on PATH; cannot verify the symbol baseline" >&2
	exit 1
fi

# Returns success when $1 is strictly newer than $2 under version ordering.
newer_than() {
	[ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

echo "symbol baseline: GLIBC <= $expected_glibc, GLIBCXX <= $expected_glibcxx, CXXABI <= $expected_cxxabi"
echo "objdump provided by: $objdump_origin"

# Every native addon in the tree, plus the packaged node itself. The addons are
# what the extension host and the workbench dlopen at runtime; node is what runs
# them, and it is a download rather than a local build, so it is the one file
# whose baseline nothing else in this pipeline would notice regressing.
files=()
while IFS= read -r -d '' file; do
	files+=("$file")
done < <(find "$server_root" -type f -name '*.node' -print0 | sort -z)

if [ -f "$server_root/node" ]; then
	files+=("$server_root/node")
else
	echo "packaged node binary missing from the server tree" >&2
	exit 1
fi

checked=0
skipped=0
violations=0

for file in "${files[@]}"; do
	# Report positions inside the package, never the runner's build directory.
	relative="${file#"$server_root"/}"

	# A non-ELF file cannot carry versioned symbol references, so it cannot
	# violate the baseline. Name it anyway: a foreign-platform binary inside a
	# linux-x64 package is dead weight worth seeing, and silence here is how the
	# original defect survived.
	magic="$(head -c 4 "$file" | od -An -tx1 | tr -d ' \n')"
	if [ "$magic" != "7f454c46" ]; then
		echo "  skipped (not ELF): $relative"
		skipped=$((skipped + 1))
		continue
	fi

	if ! symbols="$("$objdump_bin" -T "$file" 2>&1)"; then
		echo "  unreadable ELF object: $relative" >&2
		violations=$((violations + 1))
		continue
	fi

	checked=$((checked + 1))

	# Match the version tokens directly instead of by column position. objdump's
	# columns shift depending on whether a symbol carries a size field, which is
	# why the upstream script needs an awk guard; the token itself is
	# unambiguous. GLIBC_PRIVATE is excluded by requiring a leading digit.
	while IFS= read -r token; do
		[ -n "$token" ] || continue
		symbol_set="${token%%_*}"
		found="${token#*_}"
		case "$symbol_set" in
			GLIBC) baseline="$expected_glibc" ;;
			GLIBCXX) baseline="$expected_glibcxx" ;;
			CXXABI) baseline="$expected_cxxabi" ;;
			*) continue ;;
		esac
		if newer_than "$found" "$baseline"; then
			echo "  $relative requires ${symbol_set}_${found}, above the ${symbol_set} baseline $baseline" >&2
			violations=$((violations + 1))
		fi
	done < <(printf '%s\n' "$symbols" | grep -oE '(GLIBCXX|CXXABI|GLIBC)_[0-9]+(\.[0-9]+)*' | sort -u)
done

echo "symbol baseline: inspected $checked ELF objects, skipped $skipped non-ELF files"

if [ "$violations" -ne 0 ]; then
	echo "symbol baseline violated by $violations symbol reference(s); the server would not start on a host at the declared baseline" >&2
	exit 1
fi

echo "symbol baseline: all inspected objects are within the declared baseline"
