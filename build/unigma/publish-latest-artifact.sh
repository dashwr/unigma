#!/usr/bin/env bash
# Copyright (c) 2026 unigma contributors. Licensed under the MIT License.
#
# Publishes a freshly built artifact tree into the persistent per-user artifact
# store, so a later smoke run can pair a client and a server without rebuilding
# either one.
#
# The store keeps builds under `versions/<commit>` and points a `<name>` symlink
# at the current one. The pointer is swapped with `mv -T`, which is atomic on a
# single filesystem, so a reader either sees the old tree or the new one and
# never a half-installed directory. The previous version is kept and older ones
# are pruned, mirroring the retention rule of `docs/SSH-CONTRACT.md`.
#
# Usage: publish-latest-artifact.sh <name> <source-tree> <commit> [key=value ...]
#
# The trailing key=value pairs are appended verbatim to the published
# PROVENANCE.txt. Never pass a secret: this file is written to a persistent
# location on the build host.

set -euo pipefail

if [ "$#" -lt 3 ]; then
	echo "usage: publish-latest-artifact.sh <name> <source-tree> <commit> [key=value ...]" >&2
	exit 2
fi

name="$1"
tree="$2"
commit="$3"
shift 3

case "$name" in
	unigma | unigma-server | opencode) ;;
	*)
		echo "refusing to publish unknown artifact name: $name" >&2
		exit 1
		;;
esac

if [ ! -d "$tree" ]; then
	echo "source tree is not a directory: $tree" >&2
	exit 1
fi

# A short hex commit keeps the version directory name predictable and prevents a
# caller from steering the path with separators or traversal.
if ! printf '%s' "$commit" | grep -Eq '^[0-9a-f]{40}$'; then
	echo "commit must be a full lowercase hex sha: $commit" >&2
	exit 1
fi

retain="${UNIGMA_ARTIFACT_RETAIN:-2}"
root="${UNIGMA_ARTIFACT_ROOT:-$HOME/.local/share/unigma-artifacts}"
versions="$root/versions/$name"
target="$versions/$commit"
pointer="$root/$name-latest"

mkdir -p "$versions"

staging="$(mktemp -d -p "$versions" ".incoming-XXXXXXXX")"
cleanup() {
	rm -rf "$staging" "$pointer.incoming"
}
trap cleanup EXIT

# Copy rather than move: the caller's tree belongs to the build workspace and is
# still needed by later steps.
tar -C "$tree" -cf - . | tar -C "$staging" -xf -

{
	printf 'artifact=%s\n' "$name"
	printf 'commit=%s\n' "$commit"
	printf 'publishedAt=%s\n' "$(date -Is)"
	for entry in "$@"; do
		printf '%s\n' "$entry"
	done
} > "$staging/PROVENANCE.txt"

# Replacing an existing version of the same commit is expected: a workflow may
# be dispatched twice on one ref.
rm -rf "$target"
mv -T "$staging" "$target"
trap - EXIT

ln -sfn "$target" "$pointer.incoming"
mv -T "$pointer.incoming" "$pointer"

# Prune by publication time rather than by name, because commit hashes carry no
# ordering. The current version is always kept, whatever its age.
current="$(basename "$(readlink -f "$pointer")")"
mapfile -t ordered < <(
	find "$versions" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' |
		sort -rn |
		cut -d' ' -f2-
)
kept=0
for version in "${ordered[@]}"; do
	if [ "$version" = "$current" ]; then
		continue
	fi
	kept=$((kept + 1))
	if [ "$kept" -ge "$retain" ]; then
		rm -rf "${versions:?}/$version"
	fi
done

echo "published $name-latest -> $target"
