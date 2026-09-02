# remoção de CAPI — estado parcial

**data:** 2026-08-27
**escopo:** desacoplar Claude do Copilot/CAPI sem remover OpenCode, GitHub genérico ou o SDK nativo do Claude.

## feito nesta etapa

- `ClaudeAgent` deixou de receber `ICopilotApiService` e `IClaudeProxyService`.
- o catálogo do Claude passou a consultar apenas `Query.supportedModels()` do
  SDK nativo, condicionado à configuração local utilizável.
- `ClaudeAgentSession` deixou de carregar transporte proxy, handle de proxy e
  créditos CAPI; materialização, rebuild, troca de modelo e envio usam o SDK
  nativo.
- `claudeSdkOptions.ts` passou a encaminhar o ambiente nativo do usuário ao
  subprocesso e deixou de montar `ANTHROPIC_BASE_URL`/
  `ANTHROPIC_AUTH_TOKEN` de proxy.
- o campo de transporte foi removido do overlay persistido de sessão.
- `ClaudeProxyService` deixou de ser registrado em
  `agentHostMain.ts`/`agentHostServerMain.ts`.
- a suíte `claudeAgent.test.ts` deixou de montar autenticação GitHub, endpoint
  GitHub ou fixtures de proxy/CAPI; a cobertura restante usa o contrato nativo
  do SDK.
- `claudeMapSessionEvents.ts` deixou de depender de `proxyChatError.ts` e agora
  projeta diretamente erros emitidos pelo SDK nativo.
- removidos os módulos Claude proxy-only (`ClaudeProxyService`, erros, betas e
  auth shim) e seus testes; `parseProxyBearer` permanece em
  `node/shared/proxyAuth.ts` para os proxies ainda suportados.

## ainda pendente

- migrar Codex e BYOK para os caminhos diretos antes de remover
  `CopilotApiService` globalmente;
- limpar dependências, OTel, schemas, build/CI e superfícies de distribuição;
- revisar o catálogo histórico de arquitetura sem tratá-lo como descrição do
  caminho nativo;

## evidência e bloqueios

- `npm run typecheck-client` passou após as alterações, com apenas warnings do
  npm sobre chaves legadas (`disturl`, `target`, `runtime` etc.). Execuções
  anteriores foram interrompidas por timeout local, sem diagnóstico.
- `npm run compile-client` passou; o `compile-src` terminou com `0 errors`.
- `npx eslint` nos arquivos alterados e `node --experimental-strip-types --check`
  passaram para a cobertura/mapa Claude.
- o runner direto `node test/unit/node/index.js --runGlob
  'vs/platform/agentHost/test/node/claude*.test.js'` passou com `502 passing`.
- `mocha` foi atualizado para `^11.1.0` (lockfile resolve `11.8.0`); com o
  `yargs` compatível, `npm run test-node` deixou de falhar no Node 26.
- a atualização do lockfile também reconciliou entradas órfãs que já estavam
  divergentes do `package.json` modificado por outra frente; a mudança
  intencional desta etapa é somente o Mocha e sua árvore transitiva.
- `parseProxyBearer` foi movido para `node/shared/proxyAuth.ts`; o proxy BYOK
  importa o helper compartilhado, sem dependência de produção no caminho Claude.
- `npm run test-node -- --run src/vs/platform/agentHost/test/node/claudeAgent.test`
  passou com `235 passing`; o mapa passou com `32 passing` e o glob Claude com
  `502 passing` no Node 26.7.0.
- a suíte dedicada do proxy Claude foi removida junto com a implementação; os
  testes de `parseProxyBearer` continuam cobrindo o helper compartilhado.
- a árvore já tinha alterações não relacionadas: milhares de deleções de
  fixtures/testes Copilot e PNGs de branding não rastreados. As remoções da
  superfície proxy Claude foram autorizadas explicitamente; não houve limpeza
  fora desse recorte.
- os gates de runner, legalidade e branding continuam nos estados registrados
  em [`WORKBENCH.md`](WORKBENCH.md) e [`BRANDING-CLEARANCE.md`](BRANDING-CLEARANCE.md).

## próximo passo

Repetir a suíte nativa na matriz Node 24; só depois considerar qualquer recorte
adicional de CAPI/Codex, validando cada mudança com typecheck e testes focados.
