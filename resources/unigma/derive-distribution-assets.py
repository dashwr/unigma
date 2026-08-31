#!/usr/bin/env python3
# Copyright (c) 2026 unigma contributors. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root for license information.
"""Deterministically derive unigma distribution assets from the versioned source mark.

Single source of truth: ``resources/unigma/unigma-lockup-dark.png`` (1392x244 RGBA).
Its icon area is the fixed crop ``(0, 0, 244, 244)``; the opaque glyph inside that
crop is the fixed box ``(34, 54, 174, 194)``. Both boxes are constants here so the
derivation is reproducible byte for byte on any machine with the same Pillow major.

Run from the repository root:

    python3 resources/unigma/derive-distribution-assets.py

Add ``--check`` to only recompute and compare hashes without writing files.

This script records a technical derivation only. It does not assert authorship,
ownership, licensing, publication rights, or trademark clearance. AC-012 stays
blocked; see ``resources/unigma/BRANDING-PROVENANCE.md``.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import pathlib
import sys

from PIL import Image

REPO = pathlib.Path(__file__).resolve().parents[2]
SOURCE = REPO / 'resources' / 'unigma' / 'unigma-lockup-dark.png'

# Fixed geometry of the versioned source mark.
ICON_BOX = (0, 0, 244, 244)
GLYPH_BOX = (34, 54, 174, 194)

# Dark violet product surface. Matches the "Vesper Violet" chrome background
# (sideBar/titleBar/panel) in extensions/theme-defaults/themes/vesper-violet.json.
SURFACE = (0x15, 0x11, 0x1F)

# Transparent PWA/server icons: nearest-neighbor from ICON_BOX, matching the
# recipe already recorded for unigma-icon-256/512 and resources/linux/code.png.
SERVER_PNGS = {
	'resources/server/code-192.png': 192,
	'resources/server/code-512.png': 512,
}

# Browser favicon: opaque, composited on the dark violet surface so the off-white
# glyph stays visible on light browser chrome. Frame set kept as shipped.
FAVICON = 'resources/server/favicon.ico'
FAVICON_SIZES = (16, 24, 32, 48, 64)
FAVICON_GLYPH_RATIO = 0.75

# Inno Setup wizard bitmaps: 24-bit BMP, opaque, dimensions preserved verbatim.
INNO_BIG = {
	'resources/win32/inno-big-100.bmp': (164, 314),
	'resources/win32/inno-big-125.bmp': (192, 386),
	'resources/win32/inno-big-150.bmp': (246, 459),
	'resources/win32/inno-big-175.bmp': (273, 556),
	'resources/win32/inno-big-200.bmp': (328, 604),
	'resources/win32/inno-big-225.bmp': (355, 700),
	'resources/win32/inno-big-250.bmp': (410, 797),
}
INNO_BIG_GLYPH_RATIO = 0.46   # of bitmap width
INNO_BIG_CENTER_Y = 0.34      # of bitmap height

INNO_SMALL = {
	'resources/win32/inno-small-100.bmp': (55, 55),
	'resources/win32/inno-small-125.bmp': (64, 68),
	'resources/win32/inno-small-150.bmp': (83, 80),
	'resources/win32/inno-small-175.bmp': (92, 97),
	'resources/win32/inno-small-200.bmp': (110, 106),
	'resources/win32/inno-small-225.bmp': (119, 123),
	'resources/win32/inno-small-250.bmp': (138, 140),
}
INNO_SMALL_GLYPH_RATIO = 0.66  # of min(width, height)

# macOS icon. Chunk order and the frame set are kept exactly as shipped, except
# the optional upstream 'info' chunk (an NSKeyedArchiver asset-catalog reference
# left over from the Code - OSS build) which is dropped: it is metadata only and
# is not needed to render the icon.
ICNS = 'resources/darwin/code.icns'
ICNS_CHUNKS = (
	('ic12', 64, 'png'),
	('ic07', 128, 'png'),
	('ic13', 256, 'png'),
	('ic08', 256, 'png'),
	('ic04', 16, 'argb'),
	('ic14', 512, 'png'),
	('ic09', 512, 'png'),
	('ic05', 32, 'argb'),
	('ic10', 1024, 'png'),
	('ic11', 32, 'png'),
)


def icns_packbits(raw: bytes) -> bytes:
	"""PackBits variant used by ICNS ARGB/24-bit chunks (run lengths 3..130)."""
	out = bytearray()
	i, n = 0, len(raw)
	while i < n:
		run = 1
		while i + run < n and raw[i + run] == raw[i] and run < 130:
			run += 1
		if run >= 3:
			out.append(0x80 + run - 3)
			out.append(raw[i])
			i += run
			continue
		literal = bytearray()
		j = i
		while j < n and len(literal) < 128:
			r = 1
			while j + r < n and raw[j + r] == raw[j] and r < 3:
				r += 1
			if r >= 3:
				break
			literal.append(raw[j])
			j += 1
		out.append(len(literal) - 1)
		out += literal
		i = j
	return bytes(out)


def icns_argb(img: Image.Image) -> bytes:
	r, g, b, a = img.split()
	planes = a.tobytes() + r.tobytes() + g.tobytes() + b.tobytes()
	return b'ARGB' + icns_packbits(planes)


def load_source() -> Image.Image:
	return Image.open(SOURCE).convert('RGBA')


def icon_area(src: Image.Image) -> Image.Image:
	return src.crop(ICON_BOX)


def glyph(src: Image.Image) -> Image.Image:
	return src.crop(GLYPH_BOX)


def composite(size: tuple[int, int], mark: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
	canvas = Image.new('RGBA', size, SURFACE + (255,))
	canvas.alpha_composite(mark, (box[0], box[1]))
	return canvas


def centered_box(size: tuple[int, int], edge: int, center_y_ratio: float) -> tuple[int, int, int, int]:
	x = (size[0] - edge) // 2
	y = int(round(size[1] * center_y_ratio)) - edge // 2
	y = max(0, min(y, size[1] - edge))
	return (x, y, x + edge, y + edge)


def build() -> dict[str, bytes]:
	src = load_source()
	area = icon_area(src)
	mark = glyph(src)
	out: dict[str, bytes] = {}

	for rel, edge in SERVER_PNGS.items():
		img = area.resize((edge, edge), Image.NEAREST)
		buf = io.BytesIO()
		img.save(buf, format='PNG', optimize=True)
		out[rel] = buf.getvalue()

	frames = []
	for edge in FAVICON_SIZES:
		glyph_edge = max(1, int(round(edge * FAVICON_GLYPH_RATIO)))
		scaled = mark.resize((glyph_edge, glyph_edge), Image.LANCZOS)
		frames.append(composite((edge, edge), scaled, centered_box((edge, edge), glyph_edge, 0.5)))
	buf = io.BytesIO()
	# bitmap_format='bmp' keeps the shipped encoding: classic BMP frames, not
	# PNG-in-ICO, which older Windows shell versions do not decode below 256 px.
	frames[-1].save(buf, format='ICO', sizes=[(e, e) for e in FAVICON_SIZES], bitmap_format='bmp')
	out[FAVICON] = buf.getvalue()

	for rel, size in INNO_BIG.items():
		edge = max(1, int(round(size[0] * INNO_BIG_GLYPH_RATIO)))
		scaled = mark.resize((edge, edge), Image.LANCZOS)
		img = composite(size, scaled, centered_box(size, edge, INNO_BIG_CENTER_Y))
		buf = io.BytesIO()
		img.convert('RGB').save(buf, format='BMP')
		out[rel] = buf.getvalue()

	for rel, size in INNO_SMALL.items():
		edge = max(1, int(round(min(size) * INNO_SMALL_GLYPH_RATIO)))
		scaled = mark.resize((edge, edge), Image.LANCZOS)
		img = composite(size, scaled, centered_box(size, edge, 0.5))
		buf = io.BytesIO()
		img.convert('RGB').save(buf, format='BMP')
		out[rel] = buf.getvalue()

	chunks = bytearray()
	for name, edge, encoding in ICNS_CHUNKS:
		frame = area.resize((edge, edge), Image.NEAREST)
		if encoding == 'png':
			buf = io.BytesIO()
			frame.save(buf, format='PNG', optimize=True)
			payload = buf.getvalue()
		else:
			payload = icns_argb(frame)
		chunks += name.encode('ascii') + (len(payload) + 8).to_bytes(4, 'big') + payload
	out[ICNS] = b'icns' + (len(chunks) + 8).to_bytes(4, 'big') + bytes(chunks)

	return out


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument('--check', action='store_true', help='compare only, do not write')
	args = parser.parse_args()

	artifacts = build()
	drift = 0
	for rel in sorted(artifacts):
		data = artifacts[rel]
		path = REPO / rel
		digest = hashlib.sha256(data).hexdigest()
		current = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
		state = 'same' if current == digest else 'DIFFERS'
		if current != digest:
			drift += 1
			if not args.check:
				path.write_bytes(data)
				state = 'written'
		print(f'{state:8s} {digest} {rel}')

	if args.check and drift:
		print(f'{drift} artifact(s) differ from the derivation', file=sys.stderr)
		return 1
	return 0


if __name__ == '__main__':
	raise SystemExit(main())
