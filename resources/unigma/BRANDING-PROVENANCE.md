# Unigma Branding Provenance

## Scope

This is an internal provenance record for the distribution assets in this
directory. It is not a public license grant and does not replace a legal or
trademark review.

## Selected final source

| Distribution file | Source outside Git | Derivation | SHA-256 of source |
| --- | --- | --- | --- |
| `unigma-icon-512.png` | `unigma-branding/lockup-com-icone.png` | transparent 244 x 244 px icon area, resized with nearest-neighbor | `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa` |
| `unigma-icon-256.png` | `unigma-branding/lockup-com-icone.png` | transparent 244 x 244 px icon area, resized with nearest-neighbor | `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa` |
| `unigma-lockup-dark.png` | `unigma-branding/lockup-com-icone.png` | byte-preserving final logo + wordmark lockup | `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa` |

The same icon derivation replaces the platform assets consumed by the existing
packaging configuration: `resources/linux/code.png`,
`resources/linux/rpm/code.xpm`, `resources/win32/code.ico`,
`resources/win32/code_70x70.png`, and `resources/win32/code_150x150.png`.
Their legacy filenames are packaging inputs, not brand names. The macOS
`resources/darwin/code.icns` remains outside this integration because this
environment has no ICNS encoder; it must be regenerated from the same source
before macOS distribution.

The selected final logo is the block U plus violet square active cell, and the
selected final wordmark is the lettering paired with it in the lockup. The
evidence for the logo's primary status is
`unigma-branding/old/unigma-design-sheet.html`, section "A / primary mark", and
`unigma-branding/Unigma Icons.dc.html`, whose product-signature glyph has the
same construction. Other boards, editor mockups, cipher studies and the
existing standalone `unigma-wordmark.png` remain exploratory.

## Review boundary

The local source location and hashes establish traceability only. No author
attestation, assignment, trademark clearance, public license, or independent
similarity/non-collision assessment was supplied with the source files. AC-012
therefore remains blocked and public distribution is not authorized by this
record.
