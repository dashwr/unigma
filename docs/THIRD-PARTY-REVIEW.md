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

## revisão do artefato Linux

A revisão do artefato publicado no run `32916035363`, commit
`2446405698011bef1fd1947f5459b1a64e79781e`, foi executada após download com
timeout de 300 segundos. A API do GitHub identificou o artefato
`unigma-linux-x64-32916035363` (id `9588657070`, 186066342 bytes); o download
terminou com exit code `0`. O wrapper contém o tar, a evidência e logs de smoke;
somente `unigma-linux-x64.tar.xz` é candidato a distribuição.

### confirmado

- a evidência do wrapper registra `target=linux-x64`, runner `WIREDNEOMKII`,
  ambiente Ubuntu WSL2, `smoke=passed` e `runtime-tests=passed`;
- o tar contém `./resources/app/LICENSE.txt` e o notice raiz. Os hashes
  conferem com o checkout (`LICENSE.txt`:
  `cce33203a80863c22499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236`; notice:
  `51b3fd6b279f33c32499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236`), além
  de três notices de extensões;
- o `product.json` empacotado usa `unigma`, MIT, `builtInExtensions=[]` e não
  configura gallery, feeds, report URL ou voz;
- não há caminho de Copilot no tar. Uma varredura dos logs do wrapper também não
  encontrou chaves de autorização, literais Bearer ou valores de access/refresh
  token; os logs não são parte do pacote de distribuição.

### bloqueadores encontrados

- o `resources/app/package.json` empacotado ainda declara
  `author.name=Microsoft Corporation` e o repositório
  `https://github.com/microsoft/vscode.git`. A construção atual atualiza somente
  `name` e `version`, não autoria/repositório;
- fora dos logs, o tar contém 27 caminhos GitHub, 13 caminhos de
  `microsoft-authentication` e dois binários MSAL. Isso não demonstra ativação,
  mas demonstra que superfícies de autenticação upstream entram no artefato;
  `builtInExtensions=[]` não as remove porque o empacotamento copia
  `.build/extensions/**`;
- os ativos PNG em `resources/unigma/` têm README e dimensões/fundo compatíveis
  com a direção visual, mas não há nesta revisão evidência independente de
  autoria, licença ou não colisão. As mudanças são alheias e continuam fora do
  commit;
- `licenseUrl` e `serverLicenseUrl` permanecem vazios em `product.json`. Isso não
  invalida o MIT, mas deixa a distribuição sem URL pública de licença;
- o auditor `audit-notices.ts` não foi executado: o import
  `./parse-notices.js` não existe no checkout (há apenas `.ts`) e `tsx` não está
  instalado. O scanner de licenças com download/rede permanece deliberadamente
  não executado.

O resultado não autoriza distribuição. A correção de metadados, a decisão sobre
as extensões de autenticação, a conferência completa do inventário e a revisão
de direitos dos ativos precisam ocorrer em uma rodada própria, seguida de novo
build/inspeção dos dois alvos.

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
- corrigir ou justificar os metadados de autor/repositório que ainda apontam para
  Microsoft/VS Code no `package.json` empacotado;
- decidir explicitamente se `github-authentication` e
  `microsoft-authentication`/MSAL fazem parte do MVP local-first; a decisão deve
  ser refletida no empacotamento e validada no tar, sem inferir ausência a partir
  de `builtInExtensions=[]`;
- conferir licenças e notices desse inventário contra o artefato final;
- obter build e artefatos reais para revisar o conteúdo distribuído;
- concluir auditoria jurídica da marca `unigma`/`unigma-code` e de qualquer
  ativo visual ou fonte, incluindo os PNGs presentes em `resources/unigma/`.

As auditorias de dependências durante a validação registraram vulnerabilidades
herdadas do upstream. Isso é um finding de supply chain a revisar antes de
release, não motivo para editar lockfiles ou aplicar `npm audit fix` sem análise.

O código upstream que ainda contém referências históricas ou integrações de
terceiros permanece sujeito à triagem por capacidade antes de ser empacotado.
Isso é uma pendência de revisão, não autorização para distribuir essas
integrações.
