# unigma — upstream fixado

## snapshot de fundação

| campo | valor |
| --- | --- |
| repositório | `https://github.com/microsoft/vscode.git` |
| tag importada | `1.134.0` |
| commit | `474a349ad5b745e512ef86b864d1c74f7264dd7a` |
| Node.js de desenvolvimento | `24.18.0` (`.nvmrc`) |
| Electron declarado | `42.8.1` (`package.json`) |
| plataformas alvo | Windows x64 e Linux x64 |

O snapshot foi obtido da tag verificável e importado no repositório unigma sem
instalação de dependências. O checkout oficial de desenvolvimento é
`E:\unigma`: a árvore importada está na branch `master`, ainda sem commits. O
clone temporário detached HEAD usado para validar o SHA é separado desse
checkout oficial. O remote Git local `upstream` aponta para o repositório acima.
A árvore upstream permanece a fonte de proveniência para o código incorporado;
mudanças próprias devem ser identificáveis no histórico quando o projeto
começar a criar commits.

## validação local da fundação

A validação foi executada com Node.js `24.18.0` e npm `11.16.0` no checkout
local `E:\unigma`, fora do workspace sincronizado, além de clones temporários.
O checkout local contém a árvore do snapshot importado, mas ainda não possui
commits; o clone temporário curto usado para validar o SHA ficou em detached HEAD
no commit fixado e não é o checkout oficial de desenvolvimento.

## instalação e dependências nested

O upstream orquestra dependências nested pelo `npm install` no root: os scripts
`preinstall`/`postinstall` de `package.json` usam `build/npm/dirs.ts` e
`build/npm/postinstall.ts`. Consequentemente, `npm ci --ignore-scripts` deixa a
árvore incompleta e não representa uma instalação nested integral.

### verificações que passaram

- `npm ci --ignore-scripts` no root: 1.582 pacotes;
- `npm ci --ignore-scripts` em `build/`: 535 pacotes;
- `npm run typecheck-client`;
- `npm run eslint`;
- `npm run stylelint` — sugestões de design token não bloquearam a execução;
- `npm run test-build-scripts` — nenhum teste foi descoberto pelo script.

No checkout `E:\unigma`, os quatro últimos checks passaram com o Node portátil
no `PATH`; o eslint verificou 11.448 arquivos, o stylelint verificou 446 CSS e
reportou 142 sugestões não bloqueantes.

Os comandos acima passaram no clone de validação. As auditorias npm relataram
vulnerabilidades nas dependências herdadas; elas não foram corrigidas
automaticamente.

### verificações bloqueadas ou incompletas

- `npm ci` no workspace em caminho sincronizado falhou com `TAR_ENTRY_ERROR`,
  `EBADF` e `EPERM`;
- instalação completa no clone encontrou `MSB8040` em
  `@vscode/native-watchdog`, pois o módulo exige bibliotecas Spectre do
  Visual Studio ausentes no toolchain; nenhum componente foi instalado;
- `compile-client` é o menor compile sem Copilot. A tentativa oficial não foi
  feita porque requer toolchain nativo e a instalação correspondente ficou
  bloqueada por `MSB8040`/bibliotecas Spectre;
- em um ciclo controlado anterior, `npm run compile-client` avançou no checkout
  local, mas a instalação `--ignore-scripts` não trouxe todas as dependências
  nested das extensões. Após dependências pontuais em `ipynb`,
  `markdown-language-features` e `markdown-math`, a execução parou em
  `mermaid-markdown-features` porque o pacote nested `esbuild` não está
  instalado;
- a tentativa controlada mais recente, ainda com dependências parciais, parou em
  `extensions/github-authentication` por tipos `mocha`/`node` ausentes;
- `npm run test-node` não foi considerado aprovado: apesar do código de saída 0,
  emitiu `ERR_MODULE_NOT_FOUND` para arquivos em `out/`, que não foi produzido
  por causa do bloqueio do compile-client;
- `npm run compile` inclui `compile-copilot`, que não é caminho autorizado para
  o produto unigma e não foi habilitado;
- nenhum artefato Windows/Linux foi gerado e nenhum smoke de distribuição foi
  executado.

Após muitos ciclos controlados e limitados de complementação de dependências
nested, a caça incremental por dependências de cada extensão foi encerrada. O
harness completo permanece bloqueado por peculiaridades do upstream/toolchain,
não por um erro identificado em código próprio do unigma. Para fechar T-002 de
forma integral ainda é necessário um build mínimo reproduzível em ambiente
suportado ou uma decisão explícita de escopo sobre o harness upstream.

## limites

- a versão interna declarada pelo `package.json` pode diferir da tag durante o
  ciclo de release do upstream; a tag e o commit são a autoridade;
- a cadência de atualização acompanha releases/patches verificáveis do upstream;
- a identidade e a triagem inicial estão registradas em
  `THIRD-PARTY-REVIEW.md` e nas tarefas T-002/T-004 do backlog.
