# plano de ondas — refundação do caminho oficial

> **data:** 2026-08-28
>
> **status:** plano operacional ativo. Substitui
> [`2026-08-27-e00-e03-ondas.md`](2026-08-27-e00-e03-ondas.md) como ordem de
> execução; o documento anterior continua válido como registro histórico das
> lanes 1A–1F e dos recortes 2A/2B.
>
> **não autoriza** suporte, distribuição, release, publicação ou clearance legal.
>
> **fonte:** decisões `D-024`, `D-026` e `D-030` registradas em
> [`../DECISIONS.md`](../DECISIONS.md) a partir das respostas do responsável em
> 2026-08-28; inventário em [`../BACKLOG.md`](../BACKLOG.md),
> [`../ACCEPTANCE.md`](../ACCEPTANCE.md) e
> [`../status/WORKBENCH.md`](../status/WORKBENCH.md).

## o que mudou

Três decisões novas reordenam o trabalho:

1. **`D-024`** — o subsistema `src/vs/platform/agentHost/**`, herdado do bootstrap
   Code - OSS, é retirado do produto. Ele não é o harness oficial (`D-017`,
   `D-022`, `RQ-022`, `RQ-105`) e ainda é compilado, registrado e alcançável pela
   UI upstream de Chat/Agents Window. A retirada reduz diretamente o inventário
   de terceiros de `AC-001` e o risco de `AC-002`.
2. **`D-030`** — prova formal de autoria/proveniência e trademark clearance não
   são gates de entrega para este projeto FOSS. `AC-001` continua aplicável:
   licenças, notices, copyright e integridade da cadeia não são opcionais.
3. **`D-026`** — o OpenCode é consumido em três camadas: binário do usuário
   resolvido e validado por contrato, bundle de release upstream fixado e não
   modificado, e poda `service-only` opcional. `T-096` sai do caminho crítico.

## objetivo

Fechar E00, E01, E02 e E03 com o caminho oficial `unigma+opencode` isolado,
sem transformar fixture, mock, probe externo ou compile local em suporte.

## regras de execução

1. **ordem interna:** os itens de cada onda são executados na ordem indicada;
2. **teste no fim de onda:** cada onda grande termina com um bloco de testes
   nomeado; não se abre a onda seguinte sem ele;
3. **runner:** builds Windows x64 e Linux/WSL2 nunca rodam em paralelo no runner
   self-hosted compartilhado;
4. **ambiente:** Node `24.18.0`/x64 e npm `<12` são a matriz oficial; Node 26 é
   diagnóstico local e não substitui evidência;
5. **evidência:** cada onda termina com comando, ambiente, saída, cenário e
   artefato ou bloqueio registrado; `done` exige regressão reproduzível;
6. **árvore compartilhada:** este checkout contém trabalho não commitado de
   outras frentes; preservar e nunca usar reset/checkout destrutivo.

## estados

- `done`: critérios e regressão aplicáveis comprovados;
- `review`: implementação existe, mas falta QA, integração ou evidência;
- `partial`: parte comprovada, sem suporte de release;
- `blocked`: falta ambiente, decisão, atestação, bundle ou evidência obrigatória.

---

## onda 0 — ambiente

Sequencial. Não altera código de produto.

| # | tarefa |
| --- | --- |
| 0.1 | instalar Node `24.18.0`/x64 em `$HOME` por gerenciador de versão ou tarball, sem `sudo` e sem instalação global |
| 0.2 | confirmar npm major `<12` conforme `npm_config_user_agent` |
| 0.3 | executar `npm ci --no-audit --no-fund` limpo sob Node 24 |
| 0.4 | preparar o alvo SSH: VPS Linux x64 alcançável pelo OpenSSH do cliente WSL e, para o teste manual, pelo laptop Linux. `openssh-server`, conta, rota, chave e `known_hosts` são pré-condições administradas pelo responsável; o agente nunca lê, gera, copia ou imprime chave, senha ou `known_hosts` |
| 0.5 | criar `docs/status/EVIDENCE.md` com o formato fixo: run id, commit/head, nome e id do artefato, bytes, plataforma, resultado por passo, hashes |

**teste de fechamento:** `npm run compile-client` e `npm run typecheck-client`
verdes sob Node 24 local, com saída registrada.

**bloqueia:** todas as ondas seguintes.

---

## onda 1 — retirada do Agent Host e do CAPI

Executa `D-024`. A ordem é obrigatória: remover a pasta antes de cortar os
consumidores quebra o compile. Encerra `BUG-CAPI-001` por deleção.

| # | id | tarefa |
| --- | --- | --- |
| 1.1 | `T-100` | desregistrar a contribuição de Agent Sessions em `src/vs/workbench/workbench.common.main.ts` e nos entrypoints desktop/web; remover `vs/platform/agentHost/node/agentHostMain` e `diffWorkerMain` de `build/buildfile.ts` e `build/next/index.ts` |
| 1.2 | `T-101` | remover `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/**` e os comandos de Agents Window em `chat/electron-browser/agentSessions/agentSessionsActions.ts`; limpar as referências residuais em `chatSessions.contribution.ts` e `chat.contribution.ts` |
| 1.3 | `T-102` | remover as configurações de usuário `chat.agentHost.*` e o tratamento de `product.agentSdks` em `build/gulpfile.reh.ts` e `build/gulpfile.vscode.ts` |
| 1.4 | `T-103` | remover `test/smoke/src/areas/agentsWindow/**` e `build/azure-pipelines/common/smokeTestAgentHost.ts` |
| 1.5 | `T-104` | remover `src/vs/platform/agentHost/**` inteiro, `src/typings/copilot-api.d.ts` e as exclusões de protocolo Codex em `build/filters.ts` |
| 1.6 | `T-105` | remover do `package.json` as dependências que ficaram órfãs — SDKs Anthropic/Codex/Copilot e `@microsoft/dev-tunnels-*` — e regenerar o lockfile por `npm install` normal, sem `--ignore-scripts` |
| 1.7 | `T-103` | remover `Agents Window` do filtro oficial de smoke, que deixa de ser necessário |

**testes de fechamento:**

```bash
npm run compile-client
npm run typecheck-client
npm run eslint
npm run hygiene
npm run test-node
npm run test-build-scripts
node --experimental-strip-types build/azure-pipelines/oss/audit-notices.ts \
  --notice ThirdPartyNotices.txt --repo .
```

A última linha existe para **medir a queda** das 1.321 entradas `manifest-only`;
ela ainda deve retornar `1` nesta onda. A queda medida é a evidência de que o
corte foi efetivo.

**saída:** árvore sem Agent Host, smoke sem a exclusão `Agents Window`,
`BUG-CAPI-001` fechado, delta do inventário de terceiros registrado.

---

## onda 2 — colheita na matriz oficial

Roda sobre a árvore já reduzida. Sem alteração de comportamento.

| # | tarefa |
| --- | --- |
| 2.1 | disparar `.github/workflows/unigma-self-hosted-validation.yml` (Windows x64) |
| 2.2 | disparar `.github/workflows/unigma-linux-wsl-validation.yml` (Linux x64/WSL2) após o Windows terminar |
| 2.3 | registrar a evidência dos dois runs em `docs/status/EVIDENCE.md` |
| 2.4 | promover `T-020`, `T-023` e `T-030` de `review` para `done` |
| 2.5 | reconfirmar `AC-013` com o filtro de smoke reduzido |
| 2.6 | disponibilizar o artefato Linux x64 da ref validada para teste manual do cliente contra a VPS, sem tratá-lo como aceite de SSH |

**teste de fechamento:** os dois workflows verdes, smoke passando sem
`Agents Window`, artefatos `unigma-<plat>-x64-<run_id>` com hash e bytes
registrados.

**saída:** `E02`/`E03` deixam de estar bloqueados por evidência de matriz.

---

## onda 3 — terceiros e branding

Executa `D-030`. Pode rodar em paralelo com a onda 4; não compartilha arquivo com
ela.

| # | id | tarefa |
| --- | --- | --- |
| 3.1 | `T-002` | reexecutar `audit-notices.ts` após a onda 1 e classificar cada nome restante em três baldes: `devDependency`-only, transitiva já coberta, ou realmente distribuída e ausente do notice |
| 3.2 | `T-004` | resolver as 7 divergências de versão e as 7 dependências sem licença declarada |
| 3.3 | `T-004` | completar `ThirdPartyNotices.txt` até o auditor retornar `0` |
| 3.4 | `T-002` | remover referências visíveis a `VS Code`, `Code - OSS` e `Microsoft` da identidade, onboarding, textos, metadados e assets distribuídos, preservando atribuições legais obrigatórias |

Prova formal de autoria dos assets e busca de marca não são gates do projeto por
decisão `D-030`. Isso não autoriza remover copyright, licença, notices ou
atribuições exigidas, nem copiar assets/código de terceiros.

**teste de fechamento:** `audit-notices.ts` retorna `0`; as referências upstream
visíveis foram removidas; segurança da cadeia e dos artefatos permanece validada.
`E00-B` deixa de ser bloqueio formal por `D-030`.

---

## onda 4 — integração real com o OpenCode do usuário

Executa a camada 1 de `D-026`. É o caminho crítico funcional.

| # | id | tarefa |
| --- | --- | --- |
| 4.1 | `T-106` | resolver o binário `opencode` do `PATH` em `ChildProcessManager`, com override explícito por configuração; o campo `command` já é injetável |
| 4.2 | `T-106` | ler `/doc` no startup, validar a versão contra a faixa declarada em `OPENCODE-COMPATIBILITY.md` e **recusar fail-closed** quando o contrato não bater; registrar versão e origem no diagnóstico redigido |
| 4.3 | `T-012` | conectar o inventário de fontes MCP, plugin e regra às fontes explícitas do OpenCode, liberando `sourceInventoryComplete` sem catálogo paralelo, `npx -y`, `bun x`, plugin npm, URL insegura ou OAuth silencioso |
| 4.4 | `T-024` | integração local ponta a ponta: RPC → processo → cliente → storage → sessão → eventos → abort → restart → duas sessões |
| 4.5 | `T-010` | provar `DuplicateRequestId` e `SessionNotFound` produzidos pelo handler real no caminho UI → extension host → bridge, com concorrência, retry, rollback, workspace divergente, redaction e dispose |
| 4.6 | `T-031` | superfície de sessão: criar, retomar, entrada, estados e resultados via RPC |
| 4.7 | `T-032` | streaming incremental, reconexão, cancelamento, limites e virtualização |
| 4.8 | `T-033` | diff no editor com aprovação e rejeição explícitas, sem autoaprovação |
| 4.9 | `T-034` | inglês por padrão, pacote `pt-BR`, tokens de tema, contraste, foco e teclado |

**testes de fechamento:**

```bash
npm run gulp compile-extension:unigma-agent-runtime
npm --prefix extensions/unigma-agent-runtime test
npm run test-browser -- --browser chromium
./scripts/test-integration.sh
```

Executados na matriz oficial, nas duas plataformas.

**saída:** `T-010`, `T-012`, `T-024` e `T-031`–`T-034` em `done`; `E02` e `E03`
funcionais contra OpenCode real.

---

## onda 5 — SSH

Roda em paralelo com a onda 4.

| # | id | tarefa |
| --- | --- | --- |
| 5.1 | `T-013` | executar a matriz com o cliente Linux x64 do build WSL (`unigmadev`) para a VPS Linux x64, com OpenSSH real como autoridade |
| 5.2 | `T-013` | validar versão, `known_hosts`, perda e reconexão, e ausência de cópia do workspace |
| 5.3 | `T-013` | manter as recusas fail-closed já cobertas: origem desconhecida, replay, fallback local, host não autorizado |
| 5.4 | `T-013` | registrar na evidência que o cliente é WSL2 sobre o runner Windows e o host remoto é a VPS Linux x64, não bare-metal do runner |

O agente não coleta, lê, gera ou entrega chave ou senha, e não altera
`known_hosts`.

**teste de fechamento:** conexão real registrada com comando, versão do OpenSSH,
ref/SHA do build `unigmadev`, VPS alvo, cenário e logs sem segredo. O probe SSH
bruto é diagnóstico de transporte; o aceite da integração do app continua
dependendo de T-050/T-051/T-052/T-053.

---

## onda 6 — bundle fixado

Executa a camada 2 de `D-026`. Depende das ondas 3 e 4.

| # | id | tarefa |
| --- | --- | --- |
| 6.1 | `T-011` | fixar release, origem e SHA-256 do OpenCode por alvo; executar a matriz health, `/doc`, `/path`, SSE, sessão, prompt, abort, diff, permissão, restart e incompatibilidade contra o binário fixado |
| 6.2 | `T-107` | comutar entre binário do usuário e binário bundled por configuração explícita, mantendo a validação de contrato da onda 4 em ambos |
| 6.3 | `T-097` | gerar o bundle versionado com manifesto, hashes, proveniência e notices, a partir do release upstream **não modificado** |
| 6.4 | `T-098` | troca atômica com processo parado e rollback; dados do usuário permanecem fora do artefato |
| 6.5 | `T-099` | evidência real do bundle em Windows x64 e Linux x64 |

**teste de fechamento:** matriz de `T-011` completa contra o binário fixado, nos
dois runners, com artefato e hashes registrados.

---

## onda 7 — poda service-only, opcional

Executa a camada 3 de `D-026`. Não bloqueia release.

| # | id | tarefa |
| --- | --- | --- |
| 7.1 | `T-095` | manter a auditoria de superfícies alcançáveis e empacotadas como fonte da decisão |
| 7.2 | `T-096` | versionar o patch mínimo em `build/unigma/opencode/patches/` com o commit base fixado; o clone de trabalho não entra no repositório |
| 7.3 | `T-096` | diagnosticar o modo `effect` que excedeu 900 s antes de qualquer promoção |

Promover somente se a rota de UI no servidor loopback provar ser um problema
real de superfície ou se o diagnóstico do `effect` exigir o patch.

---

## não iniciar

`E-04`, `E-05`, `E-06` e `E-08` continuam fora de escopo. `E-08` segue como
direção confirmada em `D-016`, sem tarefas definidas.

## caminho crítico e paralelismo

```
onda 0 → onda 1 → onda 2 → onda 4 → onda 6 → onda 7 (opcional)
                     ├── onda 3 (paralela à 4)
                     └── onda 5 (paralela à 4)
```

## riscos registrados

| risco | efeito | mitigação |
| --- | --- | --- |
| runner indisponível | trava as ondas 2, 4, 5 e 6 | nenhuma; é gate duro. Registrar bloqueio em vez de promover com evidência local |
| corte da onda 1 atinge código compartilhado | quebra de compile em Chat/BYOK/GitHub genérico | ordem obrigatória de 1.1 a 1.7 e bloco de testes completo no fim da onda |
| queda menor que a esperada no inventário de terceiros | `E00-A` continua caro | a onda 3 classifica por baldes; `devDependency`-only não exige notice de distribuição |
| deriva de versão do OpenCode do usuário | quebra silenciosa da integração | validação de contrato por `/doc` com recusa fail-closed, item 4.2 |
| tentação de promover com evidência local | aceite falso | Node 26, fixture, mock e probe externo continuam explicitamente rejeitados |
