# unigma — revisão inicial de terceiros

## escopo

Esta é a evidência de T-004 para a fundação do fork. Não substitui a auditoria
legal exigida antes de distribuição pública.

| origem | material | tratamento atual |
| --- | --- | --- |
| Code - OSS (`microsoft/vscode`, tag `1.134.0`) | código incorporado do snapshot, `LICENSE.txt`, `ThirdPartyNotices.txt` e avisos incorporados | preservados no snapshot importado |
| código próprio de unigma | `src/vs/workbench/contrib/unigmaAgent/common/agentProtocol.ts` e `src/vs/workbench/contrib/unigmaAgent/test/common/agentProtocol.test.ts` | separado da proveniência Code - OSS; atribuição própria compatível com MIT nos headers |
| dependências do upstream | inventário gerado em `ThirdPartyNotices.txt` e manifests | não editar ou remover sem revisar a licença correspondente |
| extensões de terceiros | fontes presentes no upstream | não são instaladas por catálogo nem baixadas pelo unigma nesta tarefa |
| marca unigma | metadados em `product.json` e direção em `resources/unigma/` | identidade própria, sem ativo binário nesta tarefa |

A separação acima é por arquivo: os dois arquivos próprios listados usam a
atribuição de unigma, enquanto o código incorporado do snapshot Code - OSS e
seus notices/licenças permanecem preservados. Isso não conclui a auditoria de
proveniência; as referências upstream e integrações de terceiros ainda exigem
triagem antes de qualquer distribuição.

## verificações desta etapa

- `product.json` não usa o nome Code - OSS/Visual Studio Code como identidade;
- a configuração default de Copilot, endpoints de entitlement e URL de voz
  Microsoft foram removidos;
- `builtInExtensionsEnabledWithAutoUpdates` está vazio;
- não há CDN Microsoft configurada para conteúdo de Webview;
- `LICENSE.txt` e `ThirdPartyNotices.txt` do upstream permanecem na raiz;
- nenhuma fonte proprietária ou candidata `Cinderblock` foi incorporada.
- o `README.md` da raiz foi substituído por documentação própria de unigma; os
  READMEs internos do snapshot continuam sendo material upstream e não são
  apresentados como identidade do produto;
- identificadores de empacotamento Windows/macOS herdados foram substituídos por
  identificadores próprios em `product.json`.
- o onboarding de keymaps foi reduzido ao keymap padrão; não há referências a
  extensões externas ou instalação via catálogo nesta configuração.

## estado da triagem

### concluído nesta fundação

- o README da raiz apresenta unigma, não a identidade do upstream;
- `product.json` usa identidade, URLs, protocolo, IDs de empacotamento e
  configuração de distribuição próprios;
- Copilot default, entitlement, voz Microsoft, CDN e auto-update de extensões
  externas foram removidos ou deixados vazios;
- `LICENSE.txt` e `ThirdPartyNotices.txt` existem na raiz e a proveniência do
  snapshot está registrada em `docs/UPSTREAM.md`;
- nenhuma fonte Cinderblock, ativo binário proprietário ou catálogo externo foi
  incorporado.

### ainda necessário antes de distribuição

- inventariar referências Microsoft/upstream e integrações de terceiros que
  permanecem no código, manifests e extensões, decidindo caso a caso o que pode
  compor uma distribuição unigma;
- conferir licenças e notices desse inventário contra o artefato final;
- obter build e artefatos reais para revisar o conteúdo distribuído;
- concluir auditoria jurídica da marca `unigma`/`unigma-code` e de qualquer
  ativo visual ou fonte.

As auditorias de dependências durante a validação registraram vulnerabilidades
herdadas do upstream. Isso é um finding de supply chain a revisar antes de
release, não motivo para editar lockfiles ou aplicar `npm audit fix` sem análise.

O código upstream que ainda contém referências históricas ou integrações de
terceiros permanece sujeito à triagem por capacidade antes de ser empacotado.
Isso é uma pendência de revisão, não autorização para distribuir essas
integrações.
