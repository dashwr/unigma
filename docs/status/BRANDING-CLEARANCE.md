# unigma - clearance de branding

## Estado

Este registro cobre somente a cadeia tecnica dos assets de distribuicao
versionados e a evidencia de clearance disponivel em 2026-08-26. Nao e licenca,
cessao, autorizacao de publicacao, atestacao de autoria/originalidade ou parecer
de marca. Por decisão `D-030`, AC-012 não é gate de entrega do produto FOSS.
Este registro continua descrevendo lacunas formais de prova, mas elas não
bloqueiam o caminho operacional enquanto copyright, licenças, notices e
segurança forem preservados.

Os PNGs exploratorios nao rastreados foram excluidos do escopo: nao foram lidos,
usados ou alterados nesta revisao.

## Fatos tecnicos confirmados

- A fonte externa atualmente acessivel e
  `/home/dasher/Projects/unigma/unigma-branding/lockup-com-icone.png`.
  Seu SHA-256 e
  `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa`.
- A fonte e um PNG RGBA de `1392x244`. O arquivo versionado
  `resources/unigma/unigma-lockup-dark.png` tem o mesmo SHA-256; portanto, os
  dois arquivos sao byte a byte identicos no estado inspecionado.
- O commit `6ecb36d8ddae81d46a20307647654f4cbdc68de4` adicionou os tres assets
  em `resources/unigma/`, este registro de proveniencia e alterou os inputs de
  Linux e Windows. Isso prova quando a cadeia entrou neste repositorio, nao a
  criacao nem os direitos anteriores a Git.

| Arquivo versionado | SHA-256 atual | Derivacao tecnicamente verificada |
| --- | --- | --- |
| `resources/unigma/unigma-lockup-dark.png` | `1db9a19f62933c88af775d1086265f61466db8fc87303101c545842875c3c9fa` | Copia byte a byte da fonte externa atual. |
| `resources/unigma/unigma-icon-256.png` | `cbf815b411976c45cfe2acfd8e7b76a06967ff16e839362b712ddfb079a1ea00` | Assinatura de pixels coincide com o recorte `244x244` na origem, redimensionado para `256x256` com nearest-neighbor. |
| `resources/unigma/unigma-icon-512.png` | `b9d556632b3438219034be905cc1d7466ba6f5cefd9ff290dc32ae4ee3293ba2` | Assinatura de pixels coincide com o mesmo recorte, redimensionado para `512x512` com nearest-neighbor. |
| `resources/linux/code.png` | `65860cb01918926e08dac87cf4b2c830b10d138910f15fb1be262d69fd7e5459` | Assinatura de pixels coincide com o mesmo recorte, redimensionado para `1024x1024` com nearest-neighbor. |
| `resources/linux/rpm/code.xpm` | `e45a15f606134b63fafa5d16a511ae9e59f4f4e66df4958d71ec8021af2c4d7a` | O commit da integracao o alterou junto com os demais assets. A equivalencia de pixels nao foi demonstrada: o XPM lido tem 3 cores, enquanto o PNG RGBA esperado tem 6. Os parametros de conversao nao estao registrados. |
| `resources/win32/code.ico` | `1f3a20a45dbbb5983535e3ea386c28bfc92a55feb54acc986683cc0aef38d0b3` | As seis frames (`256`, `128`, `64`, `48`, `32` e `16` px) coincidem, por assinatura de pixels, com o mesmo recorte e nearest-neighbor. |
| `resources/win32/code_70x70.png` | `0abd8cd7113f95b3eb8d6e416c72f1702e2ee7e0b6d48edd630bd3230336b55f` | Assinatura de pixels coincide com o mesmo recorte, redimensionado para `70x70` com nearest-neighbor. |
| `resources/win32/code_150x150.png` | `3b9c0dc9f7be6316c9e9dfec51299e6b5a59e7426a4520cde147eeee71ddaba5` | Assinatura de pixels coincide com o mesmo recorte, redimensionado para `150x150` com nearest-neighbor. |
| `resources/darwin/code.icns` | `9a8e62dcb766f84eef6debdb2d59d1222a1f102c18f8ffc9de157f1cdc509926` | Sem derivacao provada da fonte acima. O arquivo ja existia no bootstrap `1cb578ff4c4dad421d20c8fc821267a32b729f8c` e nao foi alterado pela integracao de branding. |

"Assinatura de pixels" e uma verificacao local de raster, nao prova autoria,
titularidade, permissao, licenca, originalidade ou ausencia de colisao.

## Matriz de prova e lacunas

| Tema | Evidencia disponivel | Sem prova | Resultado |
| --- | --- | --- | --- |
| Rastreabilidade da fonte e dos derivados | Caminho externo acessivel, SHA-256 da fonte, hashes dos arquivos versionados, comparacoes byte a byte e de pixels acima. | Nada nesta evidencia identifica quem criou a fonte ou com qual direito. | Cadeia tecnica parcial confirmada. |
| Autoria e originalidade | Nenhuma atestacao foi fornecida. | Declaracao assinada e datada da pessoa criadora ou representante autorizado, identificando a fonte e afirmando autoria/originalidade. | Nao comprovadas. |
| Titularidade e direito de derivar | Nenhum instrumento foi fornecido. | Documento executado de cessao ou licenca que autorize unigma a copiar, modificar e usar os assets finais e derivados. | Nao comprovados. |
| Direito de distribuir/publicar | Nenhuma autorizacao foi fornecida. | Autorizacao escrita aplicavel a distribuicao publica dos assets finais e derivados. | Nao comprovado. |
| Nao copia de elementos identificaveis do OpenCode (AC-012) | Nenhuma revisao independente foi fornecida. | Relatorio independente, datado e arquivado que compare o lockup, o icone e os derivados com a identidade do OpenCode, declare o escopo/metodo e conclua a revisao. | Nao comprovada; AC-012 bloqueada. |
| Nao colisao/trademark clearance | Nenhuma busca ou parecer foi fornecido. | Busca e analise independente documentadas para `unigma`, `unigma-code` e os elementos visuais, com jurisdicoes, classes/mercados, fontes consultadas, resultados e conclusao. | Nao comprovada. |
| Asset macOS | O ICNS versionado e identificavel por hash e anterior a integracao. | Fonte, receita de derivacao e direitos do ICNS, ou ICNS regenerado com receita verificavel apos os direitos da fonte estarem comprovados. | Nao comprovado. |

## Condicao operacional por D-030

As lacunas formais acima ficam registradas, mas não bloqueiam a entrega FOSS por
decisão do responsável. A liberação operacional continua condicionada a
copyright, licenças, notices, atribuições obrigatórias, integridade da cadeia de
dependências e ausência de cópia deliberada de assets ou código de terceiros.
