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

## Scripted derivation (2026-08-30)

`derive-distribution-assets.py` in this directory regenerates the server, web,
Inno Setup and macOS visual inputs from the same versioned source. It is
deterministic and idempotent:

```bash
python3 resources/unigma/derive-distribution-assets.py           # write
python3 resources/unigma/derive-distribution-assets.py --check   # verify only
```

Fixed geometry used by the script, verified locally against the already
recorded assets: the icon area of `unigma-lockup-dark.png` is the crop
`(0, 0, 244, 244)`, and the opaque glyph inside that crop is the box
`(34, 54, 174, 194)`. Resizing the crop with nearest-neighbor to `256x256` and
`512x512` reproduces `unigma-icon-256.png` and `unigma-icon-512.png` with an
identical pixel buffer, so the new outputs stay on the recipe already recorded
above.

Recipes:

- transparent PNGs: crop `(0, 0, 244, 244)` resized with nearest-neighbor;
- favicon and Inno bitmaps: glyph box `(34, 54, 174, 194)` resized with Lanczos
  and composited, opaque, on the flat surface `#15111F`, which is the
  `Vesper Violet` chrome background. No blue and no grey background is used;
- macOS `code.icns`: crop `(0, 0, 244, 244)` resized with nearest-neighbor per
  frame; the chunk order and frame set of the shipped file are preserved
  (`ic12 ic07 ic13 ic08 ic04 ic14 ic09 ic05 ic10 ic11`), PNG payloads for the
  PNG chunk types and ARGB/PackBits payloads for `ic04`/`ic05`. The optional
  upstream `info` chunk, an `NSKeyedArchiver` asset-catalog reference left by
  the Code - OSS build, is not reproduced; it is metadata and is not needed to
  render the icon.

Verified after generation: `--check` exits `0` on a second run, every frame
decodes, `ic04`/`ic05` decode back to the expected pixels, and a hue/saturation
scan reports zero Code - OSS blue pixels in all files below.

| Distribution file | SHA-256 after derivation | Size and format | Note |
| --- | --- | --- | --- |
| `resources/server/code-192.png` | `241860021c989f874c9732ee0aec3c67740f94f6c12be2a1b8445c017c083a78` | `192x192` PNG RGBA | Was `1024x1024` while `resources/server/manifest.json` declares `192x192`; now matches the declared size. |
| `resources/server/code-512.png` | `6b11a7dab06bb930e5e962fab887ebd0f30e85323ae98efd0cb62f69fdc95113` | `512x512` PNG RGBA | Was `1024x1024`; now matches the declared `512x512`. Same pixel buffer as `unigma-icon-512.png`. |
| `resources/server/favicon.ico` | `2de93ff8a51051fd6da757cf8970c39afb42a406347f292e344528081b3f9b9b` | ICO `16/24/32/48/64`, BMP frames | Frame set and BMP frame encoding preserved. |
| `resources/darwin/code.icns` | `f12a2da1000e180c203daa1539b70d6c8aded7ae58d6f0ff7dfdf221e64166cf` | ICNS, 10 frames | Replaces the bootstrap Code - OSS icon, which was `#167abf` blue in every frame. |
| `resources/win32/inno-big-100.bmp` | `913f594599d0df4f698139d2f064760a0641dc1708de3066bb8aebefbaae84c2` | `164x314` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-big-125.bmp` | `b4cd7bb7732ef8d9b191ba2efb5a44db6fcd4faeb0c40c667d6c4f2820ecbd8f` | `192x386` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-big-150.bmp` | `c0b1e06a47347b4467fb9f5187ab7b2d839eb61d0e81fe963e75782308c8f228` | `246x459` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-big-175.bmp` | `7e3dd04be735e9350c351c0af08028d334e3adeff5b33d49d99b4d9827c5c48c` | `273x556` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-big-200.bmp` | `6f4da973fd02f44a658a326d9ca0987ca9ff8a27857153a9599a5d7a83992e4e` | `328x604` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-big-225.bmp` | `b84ab696609540c0890292b0b0a1e0ba852d94ed045ab80f382e079e91d09c9a` | `355x700` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-big-250.bmp` | `70caeb419767a78f9f8abbbdf0ef8dea75cec15ac50cd53f1cba38568c979be6` | `410x797` BMP3 24-bit | Dimensions preserved; the shipped file was 32-bit, now 24-bit like every other wizard bitmap. |
| `resources/win32/inno-small-100.bmp` | `e1a768f8e0a757a92e4b550434ebc457da27e87d9f86c11337e494c85c6e2fd9` | `55x55` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-small-125.bmp` | `3bee9bb9516bfd2304d5758b9d7159606570bebefc2ba451af1acab1e9728b74` | `64x68` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-small-150.bmp` | `ba9ad1fb4b36a44cdc98cf38ca9af81ba58fe8f997a1d56a0c4270b693cbdee6` | `83x80` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-small-175.bmp` | `0f4eefc97169e928ff6170bcc0b1381f85a41a36f4ee015b21c241800cfd935a` | `92x97` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-small-200.bmp` | `1f238bf536683128a782c5839df59d4e8b21406e43a9a8dc9d3f8b1d994cb3d9` | `110x106` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-small-225.bmp` | `fa13908b3a26c93bf8d42f6ca4fd5cb9792550f04a3d618b8ce0aceb15e632ad` | `119x123` BMP3 24-bit | Dimensions preserved. |
| `resources/win32/inno-small-250.bmp` | `8d580de3c43515ea11be8b8f33f502dd84c013e8cd5ed58620aa51d3564c2039` | `138x140` BMP3 24-bit | Dimensions preserved. |

The physical file names `code-192.png`, `code-512.png`, `favicon.ico`,
`code.icns` and `inno-*.bmp` are unchanged because they are packaging contract
names read by `resources/server/manifest.json`, `build/gulpfile.vscode.web.ts`,
`build/gulpfile.reh.ts`, `build/lib/electron.ts` and `build/win32/code.iss`.
Only the file content is unigma; the legacy name carries no brand claim.

Nothing in this section adds any authorship, ownership, licensing, publication
or clearance evidence. It records reproducible raster derivation only.

## Evidence still missing

| Claim needed for clearance | Evidence absent | Status |
| --- | --- | --- |
| Authorship and originality | A dated, signed attestation from the actual creator or an authorized representative identifying the source and affirming authorship/originality. | Not proved. |
| Ownership and derivative rights | An executed assignment or license authorizing unigma to copy, modify, and use the source and final derivatives. | Not proved. |
| Public distribution | Written authorization applicable to public distribution of the final assets and their derivatives. | Not proved. |
| No identifiable OpenCode copying | An independent, dated review comparing the final lockup, icon, and derived assets with OpenCode identity, documenting method, scope, and conclusion. | Not proved; AC-012 blocked. |
| Non-collision/trademark clearance | An independent documented search and analysis for `unigma`, `unigma-code`, and the visual mark, specifying jurisdictions, classes/markets, sources searched, results, and conclusion. | Not proved. |
| macOS asset provenance | Rights evidence for the source. The derivation gap is closed: `resources/darwin/code.icns` no longer is the bootstrap Code - OSS file and is now regenerated by `derive-distribution-assets.py` from the same recorded source, with the recipe above. The rights question is the same open question as for every other asset here. | Derivation proved; rights not proved. |

No statement in this file grants a license or authorizes release. The missing
evidence above must be supplied and independently reviewed before AC-012 can
pass or the assets can be publicly distributed.
