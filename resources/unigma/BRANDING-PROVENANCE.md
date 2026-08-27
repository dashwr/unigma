# Unigma Branding Provenance

## Scope and boundary

This is an internal technical provenance record for the versioned distribution
assets. It records local hashes and reproducible raster relationships; it is not
a public license grant, rights assignment, publication authorization, author
attestation, originality assertion, trademark clearance, or non-collision
assessment. AC-012 remains **blocked**.

Non-versioned exploratory PNGs are outside this record and were not read, used,
or modified during this review.

## Source inspected locally

| Item | Confirmed value |
| --- | --- |
| Source outside Git | `/home/dasher/Projects/unigma/unigma-branding/lockup-com-icone.png` |
| Source format | PNG, `1392x244`, RGBA |
| Source SHA-256 | `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa` |
| Repository introduction | Commit `6ecb36d8ddae81d46a20307647654f4cbdc68de4` added the final unigma assets and changed the Linux/Windows packaging inputs. |

The source hash establishes that the current external file is traceable to the
lockup below. It does not establish who created it, who owns it, whether it is
original, or whether its use is authorized.

## Versioned assets and derivations

| Distribution file | SHA-256 | Derivation and local verification |
| --- | --- | --- |
| `unigma-lockup-dark.png` | `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa` | Byte-for-byte identical to the inspected external source. |
| `unigma-icon-256.png` | `cbf815b411976c45cfe2acfd8e7b76a06967ff16e839362b712ddfb079a1ea00` | The `244x244` source icon area resized to `256x256` with nearest-neighbor has the same pixel signature. |
| `unigma-icon-512.png` | `b9d556632b3438219034be905cc1d7466ba6f5cefd9ff290dc32ae4ee3293ba2` | The same source area resized to `512x512` with nearest-neighbor has the same pixel signature. |
| `resources/linux/code.png` | `65860cb01918926e08dac87cf4b2c830b10d138910f15fb1be262d69fd7e5459` | The same source area resized to `1024x1024` with nearest-neighbor has the same pixel signature. |
| `resources/linux/rpm/code.xpm` | `e45a15f606134b63fafa5d16a511ae9e59f4f4e66df4958d71ec8021af2c4d7a` | Changed in the integration commit, but exact pixel equivalence is not proven: the XPM has 3 colors and the expected RGBA PNG has 6; conversion parameters are not recorded. |
| `resources/win32/code.ico` | `1f3a20a45dbbb5983535e3ea386c28bfc92a55feb54acc986683cc0aef38d0b3` | Every embedded frame (`256`, `128`, `64`, `48`, `32`, `16` px) matches the same source area resized with nearest-neighbor by pixel signature. |
| `resources/win32/code_70x70.png` | `0abd8cd7113f95b3eb8d6e416c72f1702e2ee7e0b6d48edd630bd3230336b55f` | The same source area resized to `70x70` with nearest-neighbor has the same pixel signature. |
| `resources/win32/code_150x150.png` | `3b9c0dc9f7be6316c9e9dfec51299e6b5a59e7426a4520cde147eeee71ddaba5` | The same source area resized to `150x150` with nearest-neighbor has the same pixel signature. |
| `resources/darwin/code.icns` | `9a8e62dcb766f84eef6debdb2d59d1222a1f102c18f8ffc9de157f1cdc509926` | Not derived by the integration: it existed in bootstrap commit `1cb578ff4c4dad421d20c8fc821267a32b729f8c` and remains without a proved source or recipe here. |

Legacy platform filenames are packaging inputs, not evidence of a brand name or
of rights. A matching file hash or pixel signature establishes a technical
relationship only.

## Evidence still missing

| Claim needed for clearance | Evidence absent | Status |
| --- | --- | --- |
| Authorship and originality | A dated, signed attestation from the actual creator or an authorized representative identifying the source and affirming authorship/originality. | Not proved. |
| Ownership and derivative rights | An executed assignment or license authorizing unigma to copy, modify, and use the source and final derivatives. | Not proved. |
| Public distribution | Written authorization applicable to public distribution of the final assets and their derivatives. | Not proved. |
| No identifiable OpenCode copying | An independent, dated review comparing the final lockup, icon, and derived assets with OpenCode identity, documenting method, scope, and conclusion. | Not proved; AC-012 blocked. |
| Non-collision/trademark clearance | An independent documented search and analysis for `unigma`, `unigma-code`, and the visual mark, specifying jurisdictions, classes/markets, sources searched, results, and conclusion. | Not proved. |
| macOS asset provenance | Its source, derivation recipe, and applicable rights evidence, or a regenerated ICNS after source rights are proved. | Not proved. |

No statement in this file grants a license or authorizes release. The missing
evidence above must be supplied and independently reviewed before AC-012 can
pass or the assets can be publicly distributed.
