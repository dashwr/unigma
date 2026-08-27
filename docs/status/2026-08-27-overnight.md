# unigma - rodada overnight - 2026-08-27

## escopo

Rodada coordenada para fechar o máximo verificável de E00/E01 e preparar
recortes independentes de E02/E03. Nenhum resultado abaixo concede suporte,
clearance legal, distribuição ou release.

## decisão sobre headless e service-only

`opencode serve` já é o entrypoint headless usado pelo runtime. Isso não elimina o
perfil `service-only`, que continua sendo o contrato do artefato oficial
`unigma+opencode` para superfície, proveniência, auditoria e separação de UI/CLI
redundante. A decisão desta rodada é não iniciar uma poda ampla: primeiro auditar
o que é alcançável e empacotado, aplicando somente o patch mínimo comprovado.

## evidência executada

| alvo | comando/ambiente | resultado |
| --- | --- | --- |
| auditoria de notices | `node --experimental-strip-types build/azure-pipelines/oss/audit-notices.ts --notice ThirdPartyNotices.txt --repo .` | relatório reproduzível; código 1 por 1.321 `manifest-only` |
| runtime TypeScript | `npm run gulp compile-extension:unigma-agent-runtime` | passou, 0 erros, Node `v26.7.0` |
| lint direcionado | `npm run eslint -- build/azure-pipelines/oss/audit-notices.ts extensions/unigma-agent-runtime/src/infrastructure/runtimeTransport.ts extensions/unigma-agent-runtime/src/test/runtimeTransport.test.ts` | passou, 3 arquivos |
| cliente/workbench | `npm run typecheck-client` | passou localmente; não é validação de runner |
| build scripts | `npm run test-build-scripts` | passou, 270 testes em 40 suites |
| cliente/workbench | `npm run compile-client` | passou em `2.47 min`, incluindo compile de extensões e `src/tsconfig`; diagnóstico local, não validação de runner |
| suíte runtime | `npm --prefix extensions/unigma-agent-runtime test` | não executou testes: Mocha/yargs falhou com `require is not defined in ES module scope` em Node `v26.7.0` |

O ambiente local não tem Node `24.18.0` nem nvm. A flag de compatibilidade do
Node 26 não corrigiu o harness; o erro não foi contornado alterando Mocha, yargs
ou dependências.

## correções técnicas aplicadas

- `extensions/unigma-agent-runtime/src/infrastructure/runtimeTransport.ts`:
  - sessões conhecidas agora carregam `sessionId -> workspaceUri`;
  - retomada de sessão em outro workspace é recusada;
  - `session.deleted` remove a referência transitória;
  - `session.error` usa mensagem fixa e não ecoa payload externo;
  - aprovação/rejeição usam `{ response: 'once' }` e `{ response: 'reject' }`,
    conforme `docs/OPENCODE-COMPATIBILITY.md`.
- `extensions/unigma-agent-runtime/src/test/runtimeTransport.test.ts` ganhou
  regressão de workspace divergente e passou a esperar payloads/mensagem
  sanitizados.
- `build/azure-pipelines/oss/audit-notices.ts` deixou de atravessar
  `node_modules`, evitando contaminar o inventário do checkout com a instalação
  local.

## segunda onda delegada

- `extensions/unigma-agent-runtime/src/infrastructure/diagnostics.ts` agora
  aceita somente níveis diagnósticos allowlisted e converte valores inválidos
  para `info`; o teste cobre injeção por newline.
- `src/vs/workbench/contrib/unigmaAgent/browser/unigmaAgentSession.ts` ignora
  erros/resultados tardios de outra sessão; `unigmaAgentView.ts` não re-renderiza
  nem altera estado depois de `dispose` e mantém o preflight antes do runtime.
- `src/vs/workbench/contrib/unigmaAgent/test/browser/unigmaAgent.contribution.test.ts`
  cobre registro de comando, transporte serializável e eventos tardios.
- A segunda onda passou ESLint direcionado sem cache, compile do runtime,
  `typecheck-client`, `test-build-scripts` (270 testes em 40 suites),
  `compile-client` e `git diff --check`. A suíte browser não foi executada;
  a suíte Mocha do runtime continua bloqueada pelo Node `v26.7.0`/npm `12.0.2`.

- A operação `ListWorktrees` agora recusa explicitamente o transporte OpenCode e
  orienta que worktrees são gerenciadas pelo Git; o compile/lint direcionado do
  bridge passou após essa correção.

## execução da onda 1 — 2026-08-27

Somente a onda 1 foi executada. A onda 2 e as posteriores não foram iniciadas.
As lanes abaixo rodaram em paralelo, com suas etapas internas em ordem:

| lane | evidência executada | estado ao fim da lane |
| --- | --- | --- |
| 1A / E00-A | Auditor root: 149 `package.json`, 63 `package-lock.json`, 2 `Cargo.lock`, 77 `cgmanifest.json`, 3.072 ocorrências, 1.393 nomes, 1.745 pares, 79 notices, 72 sobrepostos, 7 `notice-only`, 1.321 `manifest-only`, 7 divergências e 7 licenças sem declaração; código 1. Os três notices de extensão foram lidos, mas o parser atual retorna 0 por usarem formatos não normalizados. | `blocked`; classificação e normalização deliberada pendentes |
| 1B / E00-B | `BRANDING-CLEARANCE.md` e `BRANDING-PROVENANCE.md` revisados; as cinco atestações continuam ausentes. XPM Linux e ICNS Darwin também não têm derivação técnica comprovada. | `blocked`; revisão humana independente necessária |
| 1C / E01-A | `npm run gulp compile-extension:unigma-agent-runtime`: exit 0, 0 erros. `npm --prefix extensions/unigma-agent-runtime test`: exit 1 antes da descoberta por incompatibilidade Mocha/yargs em Node `v26.7.0`. A composição ainda separa `AgentRuntimeApplication` do bridge real. | `review`; Node 24, runner e integração real pendentes |
| 1D / E01-B | `opencode serve` confirmado como entrypoint headless; versão/hash do binário externo e probe HTTP/SSE anterior permanecem registrados. O candidato service-only tem entrypoint/build direcionado, mas não é patchset ou bundle aceito. Nenhum servidor foi iniciado nesta lane. | `partial`; auditar superfícies e fixar bundle |
| 1E / E01-C | Política, preflight, recusas e revalidação revisados; `sourceInventoryComplete: false` mantém `unknownOrigin` recusado. Plugin/regra ainda não têm inventário conectado. Teste local de runtime também parou no harness Node 26. | `review`; enumerador read-only, Node 24 e OpenCode real pendentes |
| 1F / E01-D | Matriz pura executada: 6 testes, 23 asserções, exit 0. Cobriu clientes Linux/Windows x64 para host Linux x64 e recusas de host key, plataforma, cliente, destino e conexão. Nenhuma conexão SSH real foi feita. | `partial/blocked`; host Linux x64 autorizado e OpenSSH real pendentes |

**consolidação:** a onda 1 produziu evidência e bloqueios nomeados, mas não fechou
nenhum épico. Não houve instalação, rede, sudo, SSH, leitura de credenciais ou
alteração de arquivos pelos executores das lanes.

## findings por frente

### e00-a

Permanece `blocked`. O relatório atual tem 79 entries no notice raiz, 72 nomes
em sobreposição, sete `notice-only`, 1.321 `manifest-only`, sete divergências de
versão e sete entradas sem licença declarada. Os notices de extensões usam
formatos diferentes do parser de separadores e ainda exigem uma normalização
deliberada. Isso é finding técnico e não parecer jurídico.

### e00-b / ac-012

Permanece `blocked`. Faltam as cinco atestações independentes de autoria,
direitos de derivação, autorização de distribuição, não cópia e não colisão de
marca. Nenhum agente pode preencher esse gate por inferência.

### e01-a / t-010

Permanece `review`. A cobertura de fonte é ampla, mas a suíte compilada não
rodou por incompatibilidade do ambiente. A leitura do código também confirmou
que `AgentRuntimeApplication` e `RuntimeTransportBridge` continuam sendo
composições separadas em `extension.ts`; a integração do caminho real UI →
extension host → bridge ainda precisa de evidência antes de fechar.

### e01-b / t-011

Permanece `partial`. `/usr/bin/opencode` `1.18.23` e o candidato Linux
service-only têm hashes e proveniências diferentes; não existe bundle oficial
`unigma+opencode` versionado, manifesto ou patchset aceito. Fixture e probe
externo não são suporte de release.

### e01-c / t-012

Permanece `review`. O preflight de produção continua recusando `unknownOrigin`
porque o inventário de plugin/regra não está conectado. As correções do bridge
foram compiladas e lintadas, mas precisam de suíte compilada em Node 24 e runner,
além de evidência OpenCode real.

### e01-d / t-013

Permanece `partial/blocked`. A política pura passou 6 testes em fixture; não
houve conexão SSH, leitura de chave, alteração de `known_hosts` ou teste em
host autorizado. Os workflows atuais não executam T-013.

### e02 / e03

Os épicos continuam formalmente `blocked`, mas existem recortes seguros de
verificação:

- T-023: armazenamento de referência de sessão e diagnóstico redigido;
- T-020: lifecycle/ativação lazy e descarte;
- T-030: contribuição nativa, registro lazy e ausência de Webview/I/O;
- T-031: reducer/sessão com transporte injetado;
- T-034: acessibilidade estrutural, sem fechar branding/localização.

T-021/T-022 dependem do bundle T-011; T-024, T-032 e T-033 não devem ser
promovidas antes da integração real.

## intervenção, permissão e dúvida

| tipo | item | ação necessária |
| --- | --- | --- |
| ambiente | Node/npm | Node `24.18.0`/npm `11.16.0` já foi disponibilizado localmente; repetir no runner oficial e registrar o ambiente |
| runner | E01/E02/E03 | executar Windows x64 e Linux/WSL2 sequencialmente; workflows não cobrem integração funcional completa |
| bundle | E01-B/E09 | auditar superfícies do `serve`, então fornecer/produzir bundle service-only fixado, patchset mínimo, manifesto e hashes por alvo |
| legal | E00-A/E00-B | revisão independente das 1.321 lacunas, sete divergências, sete licenças ausentes e cinco atestações de branding |
| remoto | E01-D | host Linux x64 autorizado, OpenSSH/known_hosts administrados e aprovação explícita para conexão real; sem entregar chaves ao unigma |
| decisão | E01-A | decidir se a composição `AgentRuntimeApplication` será integrada ao bridge ou permanecerá como camada futura; não escolher por conveniência de teste |
| escopo | E02/E03 | autorizar formalmente recortes isolados sem converter seus resultados em aceite dos épicos |

## condição de encerramento

Só atualizar um item para `done` com comando, ambiente, saída, cenário,
artefato/commit quando aplicável e regressão reproduzível. Ausência de runner,
credencial, bundle, decisão ou atestação permanece `blocked`.

## adendo — execução da onda 2

Após o encerramento da onda 1, foram executados somente os recortes 2A/T-020 e
2B/T-030, sem iniciar a onda 3 ou qualquer lane posterior:

- 2A: `npm run gulp compile-extension:unigma-agent-runtime` e o comando oficial
  `npm --prefix extensions/unigma-agent-runtime test` passaram em Node
  `v24.18.0`/npm `11.16.0`, com 0 erros e 59 testes. O bloqueio de harness
  causado por Node 26 foi resolvido localmente; a repetição no runner oficial
  ainda é necessária.
- 2B: o `npm run gulp compile-client` anterior passou com 0 erros em Node
  `v26.7.0`; o teste focado `bash scripts/test.sh --run
  src/vs/workbench/contrib/unigmaAgent/test/browser/unigmaAgent.contribution.test.ts`
  passou com 8 testes. A revisão estática não encontrou Webview, processo, rede,
  filesystem ou segredo nos arquivos browser da contribuição. A tentativa de
  `compile-client` em Node `v24.18.0` chegou a `src/tsconfig` com 0 erros, mas o
  worker `tsgo` terminou sem código após aproximadamente 13 minutos.
- O teste 2B recebeu apenas correções de teardown/assertion no arquivo de teste;
  nenhuma funcionalidade de onda posterior foi iniciada. `git diff --check`
  passou. Compile local e Node 26 são evidência diagnóstica, não aceite da matriz.

Estado: 2A/2B em `review`; E02/E03 permanecem `blocked` até runner, integração e
gates dependentes serem comprovados. O histórico anterior que registra a onda 2
como não iniciada descreve o estado antes deste adendo.
