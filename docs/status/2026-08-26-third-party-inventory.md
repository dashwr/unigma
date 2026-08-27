# unigma - inventario de terceiros - 2026-08-26

## Escopo e reproducao

Este inventario registra fatos observados a partir do baseline commitado
`94afeef7` e do working tree desta rodada, na raiz
`/home/dasher/projects/unigma/unigma`. Ele nao concede
clearance juridico, nao infere licencas ausentes e nao autoriza distribuicao.

O auditor de notices e executavel sem `tsx` global ou instalacao: Node com type
stripping carrega `audit-notices.ts`, que importa `parse-notices.ts` diretamente.

```sh
node --experimental-strip-types build/azure-pipelines/oss/audit-notices.ts \
  --notice ThirdPartyNotices.txt --repo .
```

O auditor le, sem rede nem `node_modules`, os manifests `package.json`,
`package-lock.json`, `Cargo.lock` e `cgmanifest.json` presentes no checkout. O
relatorio classifica entradas de notice duplicadas, nomes com mais de uma
versao, licencas como declaradas no notice e nomes exclusivos de notice ou de
manifest. Um nome exclusivo de manifest e um finding a decidir, nao uma licenca
inventada; um nome exclusivo de notice pode ser dependencia transitiva detectada
pelo gerador upstream. O comando retorna codigo 1 enquanto houver nome exclusivo
de manifest, para que um relatorio com `FAIL` nao seja aceito pela automacao.

## Resultado observado

A execucao no checkout indicado acima encontrou 149 `package.json`, 63
`package-lock.json`, dois `Cargo.lock` e 77 `cgmanifest.json`. Foram coletadas
3.072 ocorrencias de manifesto, equivalentes a 1.393 nomes e 1.745 pares
nome-versao distintos. O notice raiz tem 79 entradas e 79 pares nome-versao
distintos: 72 nomes sobrepoem manifests, sete sao `notice-only` e 1.321 sao
`manifest-only`. O auditor retorna codigo 1 por estas 1.321 lacunas, que seguem
sem classificacao de distribuicao.

Nao houve entrada duplicada pelo par nome-versao nem nome com mais de uma
versao no notice analisado. Sete dependencias presentes tanto no notice como
nos manifests tem versoes diferentes e exigem decisao humana; o auditor as
reporta sem escolher qual versao e distribuida:

| Nome | Versao no notice | Versao(s) no manifesto |
| --- | --- | --- |
| `atom/language-sass` | `0.62.1` | `0.61.4` |
| `daaain/Handlebars` | `1.8.0` | `1.10.0` |
| `dompurify` | `3.2.7` | `3.4.8`, `3.4.10`, `3.4.12` |
| `jeff-hykin/better-cpp-syntax` | `1.17.4` | `1.27.1` |
| `marked` | `14.0.0` | `4.3.0`, `14.0.0`, `16.4.2` |
| `semver` | `5.5.0` | `1.0.27`, `5.5.0`, `5.7.2`, `7.5.2`, `7.5.4`, `7.6.2`, `7.7.3`, `7.7.4`, `7.8.0`, `7.8.5` |
| `TypeScript-TmLanguage` | `0.1.8` | `0.1.8`, `1.0.0` |

Sete entradas nao declaram licenca no cabecalho do notice e permanecem
desconhecidas:

| Nome | Versao declarada | Linha do notice |
| --- | --- | --- |
| `@fig/autocomplete-shared 1.1.2` | ausente | 9 |
| `amazon-q-developer-cli f66e0b0e917ab185eef528dc36eca56b78ca8b5d` | ausente | 89 |
| `codex` | ausente | 380 |
| `fish-shell 3.7.1` | ausente | 1078 |
| `seti-ui 0.1.0` | ausente | 2257 |
| `vscode-win32-app-container-tokens` | ausente | 3159 |
| `zsh 5.9` | ausente | 3424 |

## Arquivos de notice versionados

| Origem | Caminho | SHA-256 | Tratamento observado |
| --- | --- | --- | --- |
| snapshot Code - OSS | `LICENSE.txt` | `cce33203a80863c22499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236` | preservado na raiz |
| snapshot Code - OSS e terceiros | `ThirdPartyNotices.txt` | `51b3fd6b279f33c324ba7d32ed9f8849bb51cc2d7c61eaf13c2e8eba5efdd523` | entrada do auditor |
| extensao | `extensions/mermaid-markdown-features/ThirdPartyNotices.txt` | `a42d48519a03963f6379d8c962bc6e94939bb07e887c9880a4b6a295e8c7e12c` | deve acompanhar o pacote quando a extensao for empacotada |
| extensao | `extensions/terminal-suggest/ThirdPartyNotices.txt` | `875fb70e4eb54f1fa9987d6bd16cc5472ef3b75fc5758a5f897494f58753c489` | deve acompanhar o pacote quando a extensao for empacotada |
| extensao | `extensions/theme-seti/ThirdPartyNotices.txt` | `be25a8e2c617f7214c99a256305fb6b2d976e3a698c44bda424f617079dcff9f` | deve acompanhar o pacote quando a extensao for empacotada |

Os tres notices de extensao acima sao os unicos arquivos
`extensions/*/ThirdPartyNotices.txt` rastreados neste commit.

## Artefatos finais registrados

Nao ha TAR ou ZIP de distribuicao neste checkout para reinspecao local. A
evidencia registrada em [`../ACCEPTANCE.md`](../ACCEPTANCE.md) e
[`THIRD-PARTY-REVIEW.md`](THIRD-PARTY-REVIEW.md)
identifica os artefatos finais `unigma-linux-x64-32929454545` e
`unigma-windows-x64-32930950550`, ambos no head de codigo `838ca94e`. Essa
evidencia registra hashes da licenca e do notice raiz iguais aos desta tabela,
os tres notices de extensao esperados e ausencia das quatro extensoes proibidas
no pacote. Ela nao substitui nova auditoria do conteudo de cada artefato futuro.

`node --experimental-strip-types build/unigma/audit-distribution.ts <diretorio-do-pacote> <raiz-do-checkout>`
falha deterministicamente se o pacote nao tiver layout valido, identidade e
metadados declarados, MIT/URL de licenca, gallery, extensoes proibidas, notices
ou hashes esperados. Tambem rejeita feeds/report/voz declarados, auto-update de
extensoes, diretorios `.git`/cache/logs no pacote e as extensoes proibidas. As
verificacoes sao tecnicas de conteudo e configuracao; elas nao classificam
licencas, direitos de marca ou autorizacao de distribuicao.

## Validacao local em 2026-08-27

- Node `v26.7.0` executou `node --experimental-strip-types
  build/azure-pipelines/oss/audit-notices.ts --notice ThirdPartyNotices.txt
  --repo .`; o walker agora exclui `node_modules` e retornou codigo `1`, esperado
  pelas 1.321 entradas `manifest-only`;
- a mesma execucao encontrou 149 `package.json`, 63 `package-lock.json`, dois
  `Cargo.lock` e 77 `cgmanifest.json`, totalizando 3.072 ocorrencias de
  manifesto;
- `git diff --check` passou; `npm run test-build-scripts` passou com 270 testes
  em 40 suites;
- `npm run compile-client` passou em `2.47 min`, incluindo compile de extensoes e
  `src/tsconfig`; esse resultado e diagnostico local, nao substitui o runner;
- Node `24.18.0`/npm menor que `12` continuam ausentes neste ambiente local;
  testes que dependem da matriz oficial devem rodar no runner autorizado.

## Limitacoes e decisoes pendentes

- O parser usa os cabecalhos e licencas declarados no notice; nao valida texto
  juridico, SPDX, copyright, excecoes ou compatibilidade de licencas.
- A comparacao por nome nao resolve aliases, pacotes binarios, dependencias de
  plataforma, origem fora dos manifests ou divergencia de versao. Cada resultado
  `manifest-only`, `notice-only`, duplicata ou versao divergente do relatorio
  exige classificacao humana antes de release.
- O checkout nao contem os artefatos Linux/Windows finais. Portanto, esta rodada
  nao confirma novamente seus membros nem seus hashes; a auditoria deve ser
  executada contra cada diretorio de pacote produzido.
- Nenhuma clearance legal, de autoria, de marca ou de distribuicao e afirmada.
  AC-001 e AC-012 permanecem bloqueados pelas revisoes independentes exigidas.
