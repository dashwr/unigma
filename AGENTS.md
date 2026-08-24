# unigma — guia operacional

## contexto

`unigma` é um IDE desktop local-first, derivado de Code - OSS, com OpenCode
como runtime primário de agente. O MVP atende Windows x64 e Linux x64. A
arquitetura está aprovada e o snapshot inicial do upstream foi importado; as
features próprias ainda não foram implementadas.

## leia antes de alterar

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — fronteiras, processos e estrutura;
2. [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — requisitos e escopo;
3. [docs/DECISIONS.md](docs/DECISIONS.md) — decisões imutáveis até nova instrução;
4. [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) — evidência exigida;
5. [docs/FLOWS.md](docs/FLOWS.md) e [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — fluxos e fontes de verdade.

Referências externas autorizadas: [Code - OSS LICENSE](https://github.com/microsoft/vscode/blob/main/LICENSE.txt), [diferenças Code - OSS/VS Code](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code) e [OpenCode server](https://opencode.ai/docs/server).

## stack e estrutura alvo

- Code - OSS/Electron e TypeScript;
- `src/vs/workbench/contrib/unigmaAgent/`: UI nativa do workbench;
- `extensions/unigma-agent-runtime/`: CLI `opencode serve`, HTTP/SSE, Git e estado mínimo;
- `extensions/unigma-remote-ssh/`: OpenSSH e host remoto;
- `resources/unigma/`: branding e metadados de distribuição.
- `product.json`, `LICENSE.txt`, `ThirdPartyNotices.txt`: identidade, licença e
  proveniência da distribuição.

OpenCode roda como processo filho reutilizável, no máximo um por extension
host, e comunica por loopback HTTP/SSE. Não criar Webview para a superfície
principal de agente.

## regras invariáveis

- não há backend, banco central, conta, RBAC, cloud, telemetria, cache/fila
  distribuídos ou sincronização no MVP;
- Git, OpenSSH, OpenCode e o filesystem são fontes de verdade. Não duplicar
  prompts, diffs, workspace, tokens ou chaves em armazenamento próprio;
- exigir workspace confiável e aprovação explícita para efeitos do agente;
- providers, MCP e plugins são configurados localmente por fonte explícita;
  sem catálogo, instalação silenciosa ou Visual Studio Marketplace;
- SSH usa OpenSSH, `known_hosts` e agente/chaves já administrados pelo usuário;
- UI padrão em inglês, pacote `pt-BR`; marca original, sem ativos identificáveis
  da Microsoft ou do OpenCode.

## segurança e limites legais

Nunca extraia ou persista credenciais, tokens, caches OAuth, senhas ou chaves
SSH; não intercepte tráfego e não contorne entitlement. Não reutilize marca,
ícones, binários, endpoints/chaves Microsoft ou Marketplace. Preserve licenças,
copyrights e notices do Code - OSS e demais dependências.

Não criar fork preventivo do Electron, desabilitar sandbox/GPU/segurança de
renderer, nem adicionar framework, monorepo, segundo runner, compatibilidade ou
infraestrutura especulativa. Patches de performance sobre Code - OSS exigem
perfil reproduzível antes/depois, escopo mínimo e teste de regressão.

## desenvolvimento e validação

Base fixada: tag Code - OSS `1.134.0`, commit
`474a349ad5b745e512ef86b864d1c74f7264dd7a`, Node.js `24.18.0` e Electron
`42.8.1` (ver [docs/UPSTREAM.md](docs/UPSTREAM.md)). O checkout principal de
desenvolvimento é `E:\unigma`, fora do workspace sincronizado. Preserve
`G:\My Drive\projects\unigma` como origem; não rode instalação ou build nele.
O ambiente precisa de Node x64, Python e toolchain nativo compatível com a
plataforma.

Use `npm ci` somente quando a instalação local de dependências estiver
autorizada e necessária. Não instale globalmente. Scripts verificados no
`package.json`:

- desenvolvimento: `npm run compile`, `npm run build-fast`, `npm run watch`;
- lint: `npm run eslint`, `npm run stylelint`;
- typecheck: `npm run typecheck-client`;
- testes: `npm run test-node`, `npm run test-build-scripts`,
  `npm run test-extension`, `npm run smoketest`;
- harness agregado: `npm run core-ci`, `npm run extensions-ci`;
- execução: `scripts\code.bat` (Windows), `./scripts/code.sh` (Linux);
- testes Electron: `scripts\test.bat` (Windows), `./scripts/test.sh` (Linux);
- empacotamento: `npm run gulp vscode-win32-x64` ou
  `npm run gulp vscode-linux-x64`.

O script de testes pode instalar dependências automaticamente quando
`node_modules` não existe; confirme autorização antes de executá-lo. Valide
primeiro o menor alvo afetado e depois o conjunto exigido pelo backlog.

Não há migrations nem deploy de aplicação no MVP. Qualquer release exige revisão
de licenças/identidade e autorização explícita; publicação, domínios e
certificados não são implícitos.

Para mudanças futuras, valide no menor alvo e depois nos testes do pacote
afetado. Métricas de startup, RSS por processo e CPU devem ser comparadas ao
baseline por plataforma em perfil limpo, idle, streaming e SSH remoto.
