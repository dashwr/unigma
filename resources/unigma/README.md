# Unigma distribution identity

This directory contains only distribution assets for the Unigma product. Do not
place identifiable Code - OSS, Visual Studio Code, or OpenCode assets here.

## Final logo and wordmark

The final logo and wordmark are the lockup supplied in
`unigma-branding/lockup-com-icone.png`. Its logo is the block `U` with a violet
square active cell; its wordmark is the lettering paired with that logo. The
source board labels `U / active cell` as the primary mark, and
`Unigma Icons.dc.html` reuses the same glyph as the product signature. Mockups,
boards, editor screens and cipher studies are references only, not product
targets.

- `unigma-icon-512.png`: primary square mark for high-density distribution use.
- `unigma-icon-256.png`: primary square mark for icon and avatar use.
- `unigma-lockup-dark.png`: final horizontal logo + wordmark lockup for dark
  surfaces.

The PNGs are RGBA with transparent backgrounds. The icon uses off-white
`#efeff4` and violet `#8b5cf6`; it has no embedded font.

## Provenance and rights

The source PNGs are maintained outside this repository in
`/home/dasher/Projects/unigma/unigma-branding`; no source font or editable
board is distributed here. `BRANDING-PROVENANCE.md` records the source hashes,
derivation, and review boundary. These files do not assert a public license.
They remain blocked from public release until independent authorship, rights,
and non-collision review closes AC-012.

The `unigma-cipher*` and the existing `unigma-wordmark.png` file are exploratory
assets. They are not part of the final distribution set; the final wordmark is
the lettering in `unigma-lockup-dark.png`. Do not package the exploratory files.
