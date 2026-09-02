# unigma — workbench operacional

> quadro vivo das frentes de trabalho. O histórico detalhado fica nos arquivos
> datados desta pasta; este quadro responde **o que está ativo, onde parou e qual
> é o próximo passo**.

**última atualização:** 2026-08-31
**foco atual:** implementação incremental de `E02/E03` no runtime OpenCode e
workbench nativo, mantendo os gates `E00/E01` em review/partial
do CLI Rust **preservando o Code Server**, em
[`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md),
que emenda no plano de ondas
[`../planos/2026-08-28-ondas-refundacao.md`](../planos/2026-08-28-ondas-refundacao.md)
entre a onda 1 e a colheita da onda 2. `CLI-001` está em `review`: os testes Rust
e a compilação de `terminal-suggest` passaram localmente; os gates de runner da
etapa A estão verdes.
`OVN-D024` fechou a matriz oficial em 2026-08-30 no head `91867fb1`; a matriz
final de contratos OpenCode/SSH fechou no head `d00521d6`: Windows
`33345230165` e Linux/WSL2 `33347302898` concluíram todos os passos, incluindo
instalação limpa, pacote, auditoria de distribuição, smoke e evidência de
artefato. As entradas formais estão em [`EVIDENCE.md`](EVIDENCE.md); o que
continua em aberto é o inventário de terceiros da raiz, clearance legal e
qualquer capacidade de E-02 em diante.
Os runs anteriores `33267418418` (Windows, `a3300897`) e `33279351708`
(Linux WSL, `e6b4e1bd`) permanecem como registro histórico do recorte do CLI.
Em 2026-08-30, `c00f37b3` removeu `@github/copilot` e `@github/copilot-sdk` da
raiz e de `remote/`, limpou as linhas correspondentes do About e removeu o
workaround morto do postinstall. `compile-client`, `typecheck-client`,
`test-build-scripts` (262/262), eslint e os testes do auditor passaram; os dois
lockfiles não contêm mais esses pacotes. O auditor root caiu de 721 para 695
manifest-only; CLI segue `rc=0`.
O notice root ainda não foi regenerado: o fluxo completo exige o artefato CG
interno do Azure DevOps, indisponível neste ambiente. A varredura interrompida
durante a poda da árvore foi descartada e não é evidência legal.
Nesta rodada, o caminho residual de Agent Sessions Welcome foi removido da
configuração de startup, layout, tema e contribuição de walkthrough; os três
arquivos da página órfã também foram removidos. A validação ainda é `review`,
pois compile/typecheck e runner precisam confirmar o recorte completo.
Em 2026-08-30, a execução Windows `33288698590` no commit `4814f40a` passou
build, checks e auditoria do pacote, mas falhou no smoke: 61 passaram e os dois
casos Integrated Browser dependentes de `workbench.panel.chat` falharam. O
recorte local seguinte desativa apenas essa superfície por `D-032`, preserva os
serviços compartilhados, declara os dois casos como capability não suportada e
adiciona uma asserção negativa. `compile-client`, `typecheck-client`, 60 testes
 do runtime, 6 testes da policy SSH, 262 testes de build e o teste focal da
 capability passaram sob Node `24.18.0`. O auditor da CLI com `--scope cli`
 retorna `0`, sem manifest-only ou licença ausente; o escopo root está em 695
 manifest-only e os 7 avisos de licença são falsos positivos do parser.

## quadro

| id | escopo | fase | estado | próximo passo verificável | depende de | fonte principal |
| --- | --- | --- | --- | --- | --- | --- |
| `DOC-001` | adaptar o workflow e reorganizar `docs/` | documentação final | `done` | manter este quadro na próxima solicitação multi-tarefa | nenhuma | [`README.md`](../README.md), [`fontes/MODELO-DE-TAREFAS.pdf`](../fontes/MODELO-DE-TAREFAS.pdf) |
| `OVN-001` | triagem, delegação e consolidação do overnight E00–E03 | implementação/verificação | `in_progress` | consolidar resultados de 1A–1F e dos recortes 2A/2B, desbloquear ambiente/gates humanos e não iniciar onda 3 | nenhum; sem colisão de arquivos | [`planos/2026-08-27-e00-e03-ondas.md`](../planos/2026-08-27-e00-e03-ondas.md), [`BACKLOG.md`](../BACKLOG.md) |
| `OVN-D024` | retirada do Agent Host herdado e do CAPI | implementação/review | `review` | executar compile/typecheck/testes e auditor de notices no runner após publicar a ref | T-100–T-104 locais; runner | [`../planos/2026-08-28-ondas-refundacao.md`](../planos/2026-08-28-ondas-refundacao.md), [`../DECISIONS.md`](../DECISIONS.md) |
| `CLI-001` | etapa A: desacoplar o Agent Host do CLI Rust, preservando Code Server, bridge, multiplexer, protocolo e `command-shell` | implementação/review | `review` | colher Node 24/runner, revisar notices e decidir tratamento do baseline clippy; não promover por teste local | auditoria CLI; `D-027`; `D-029` | [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md), [`2026-08-29-cli-audit.md`](2026-08-29-cli-audit.md) |
| `CLI-002` | etapa B: OpenSSH → `unigma-server` remoto → extension host → `unigma-agent-runtime` → `opencode serve` (T-050…T-053) | implementação/review | `blocked` | provisionar fora do agente `sshd`/host key e `unigma-server` pré-instalado; então executar matriz SSH | `CLI-001`, `D-028`, `D-031`, host autorizado | [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md), [`../SSH-CONTRACT.md`](../SSH-CONTRACT.md) |
| `CLI-003` | auditoria do `code tunnel` e de `@microsoft/dev-tunnels-*` (`Q-3`) | discovery | `ready` | levantar, sem alterar código, quem consome o subcomando `tunnel`, o que ele exige do serviço Microsoft e o que cairia junto; entregar veredito preservar/remover para decisão | nenhuma; não bloqueia `CLI-001` nem `CLI-002` | [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md) §7, [`2026-08-29-cli-audit.md`](2026-08-29-cli-audit.md) |
| `OVN-T105` | dependências órfãs após D-024 | backlog bloqueado | `blocked` | remover Claude/Codex do root e regenerar lockfile por instalação normal autorizada; `@microsoft/dev-tunnels-*` fica fora deste corte enquanto `Q-3` não for decidida; as crates `ahp`/`ahp-types` saem em `CLI-001`/A.6 | T-104; `CLI-001`; autorização de instalação | [`BACKLOG.md`](../BACKLOG.md), [`../DECISIONS.md`](../DECISIONS.md) |
| `OVN-T023` | verificar storage de referência, lifecycle e diagnóstico redigido | verificação | `review` | executar suíte compilada em Node 24 e confirmar ausência de conteúdo sensível | T-010/T-020, runner | [`2026-08-27-overnight.md`](2026-08-27-overnight.md) |
| `OVN-T020` | verificar esqueleto, ativação lazy e lifecycle do runtime | verificação | `review` | repetir compile e suíte de lifecycle em Node 24/npm <12 | T-010, runner | [`../planos/2026-08-27-e00-e03-ondas.md`](../planos/2026-08-27-e00-e03-ondas.md) |
| `OVN-T030` | verificar contribuição nativa e fronteira arquitetural | verificação | `review` | repetir compile/teste browser na matriz oficial e cobrir integração quando liberada | T-010, runner | [`../planos/2026-08-27-e00-e03-ondas.md`](../planos/2026-08-27-e00-e03-ondas.md) |
| `E00-A` / `T-002/T-004` | notices, terceiros e identidade de distribuição | release candidate | `blocked` | concluir inventário legal e classificar lacunas antes de release | revisão independente | [`2026-08-26-third-party-inventory.md`](2026-08-26-third-party-inventory.md), [`THIRD-PARTY-REVIEW.md`](THIRD-PARTY-REVIEW.md) |
| `E00-B` / `AC-012` | autoria, direitos e não colisão do branding | decisão de escopo | `partial` | manter obrigações legais e remover identidade upstream; prova formal não é gate por D-030 | D-030 | [`BRANDING-CLEARANCE.md`](BRANDING-CLEARANCE.md), [`../DECISIONS.md`](../DECISIONS.md) |
| `E01-A` / `T-010` | contrato RPC e erros sanitizados | regressão | `review` | executar/registrar a suíte integrada do workbench quando o alvo existir | build e harness do runner | [`BACKLOG.md`](../BACKLOG.md), [`2026-08-26-campanha.md`](2026-08-26-campanha.md) |
| `E01-B` / `T-011` | compatibilidade HTTP/SSE do OpenCode | evidência | `partial` | obter provider/modelo autorizado para prompt/streaming/diff real; depois validar bundle service-only | bundle service-only; provider autorizado | [`OPENCODE-COMPATIBILITY.md`](../OPENCODE-COMPATIBILITY.md) |
| `E01-C` / `T-012` | preflight local e bridge workbench↔extension host | regressão/runner | `review` | rodar validação oficial; depois conectar inventário plugin/regra e prova OpenCode real | `E01-B`, runner sequencial | [`LOCAL-INTEGRATIONS-POLICY.md`](../LOCAL-INTEGRATIONS-POLICY.md), [`2026-08-26-campanha.md`](2026-08-26-campanha.md) |
| `E01-D` / `T-013` | contrato SSH fail-closed | implementação/review | `partial` | provisionar fora do agente `sshd` + host key + `unigma-server` de teste; então executar matriz sem replay ou segredo | host Linux x64 e `unigma-server` autorizados | [`SSH-CONTRACT.md`](../SSH-CONTRACT.md) |
| `E01-E` | evidência e fechamento de E-00/E-01 | backlog | `blocked` | consolidar runs, artefatos, aceite e status após as frentes acima | E00/E01 pendentes | [`planos/2026-08-26-e00-e01.md`](../planos/2026-08-26-e00-e01.md) |
| `E02/E03` | runtime OpenCode e workbench nativo funcional | implementação | `in_progress` | fechar streaming incremental, permissões reais e contrato nativo de `@`/`/`; só então colher runner | E-00/E-01 em review/partial; provider/modelo autorizado para prompt real | [`BACKLOG.md`](../BACKLOG.md), [`OPENCODE-COMPATIBILITY.md`](../OPENCODE-COMPATIBILITY.md) |
| `E09` / `T-095..T-099` | perfil service-only e bundle `unigma+opencode` | backlog | `partial` | auditar superfícies do `serve` e transformar o resultado em patch mínimo, manifesto e artefato aceitos | E-00/T-011 | [`OPENCODE-SERVICE-ONLY.md`](../OPENCODE-SERVICE-ONLY.md) |

## estados

- `backlog`: não iniciado ou sem autorização/pré-condição;
- `ready`: dependências claras e próximo passo executável;
- `in_progress`: execução em andamento;
- `review`: implementação existe, mas QA, security, regressão ou evidência ainda
  não fecharam a tarefa;
- `partial`: parte comprovada e pendência explícita; não é aceite;
- `blocked`: existe impedimento registrado; não mascarar como `ready`;
- `done`: todos os gates aplicáveis e a documentação foram concluídos;
- `cancelled`: removida por decisão explícita.

## como atualizar

1. Ao receber uma solicitação multi-tarefa, crie IDs locais (`DOC-`, `BUG-` ou o
   ID do backlog) e liste dependências antes de editar.
2. Marque somente uma linha como `foco atual`; cada troca registra o próximo
   passo da linha anterior.
3. Depois de cada comando relevante, atualize estado, evidência e bloqueio; não
   espere o fim do prompt para reconstruir a sequência.
4. Subagentes podem trabalhar em paralelo apenas quando os arquivos e decisões
   não colidem; findings voltam ao Lead, que distribui correções.
5. Ao fechar a frente, registre a transição no histórico datado e atualize
   `BACKLOG.md`/`ACCEPTANCE.md` sem promover hipótese a fato.

## fila de intervenção

| tipo | frente | necessário | estado |
| --- | --- | --- | --- |
| escopo | `E00-B` / `AC-012` | prova formal e trademark clearance não são gates por D-030; preservar obrigações legais aplicáveis | decidido |
| ambiente/permissão | `E01-A` / `E01-C` / `E01-D` | Node `24.18.0`/npm `<12` já disponível localmente; runner Windows/WSL e host Linux x64 autorizado continuam pendentes; nenhum segredo deve ser coletado | pendente |
| decisão técnica | `E01-B` / `E01-C` | bundle OpenCode fixado e inventário confiável de plugins/regras | pendente |
| escopo/aceite | `E02/E03` | manter 2A/2B como recortes verificados, sem promover os épicos sem os gates E00/E01 | pendente |

## transições recentes

| data | id | transição | evidência |
| --- | --- | --- | --- |
| 2026-08-27 | `DOC-001` | `in_progress → done` | PDF entendido, fontes/plano/status reorganizados e links validados |
| 2026-08-27 | `OVN-001` | `backlog → in_progress` | triagem delegada em ondas read-only; bloqueios humanos registrados acima |
| 2026-08-27 | `OVN-001` | triagem → correção/verificação | bridge sanitizado e associado a workspace; permissão alinhada à matriz; auditor exclui `node_modules`; compile/lint/typecheck locais passaram |
| 2026-08-27 | `OVN-T023/T030` | backlog → `review` | diagnóstico allowlisted, filtragem de eventos tardios e proteção de lifecycle aplicadas; testes oficiais pendentes |
| 2026-08-27 | `OVN-001` | verificação local ampliada | `test-build-scripts`: 270 testes/40 suites; `compile-client`: passou em `2.47 min` sob Node 26; a tentativa Node 24 terminou em `tsgo exited with code unknown` após ~13 min |
| 2026-08-29 | `OVN-D024` | UI residual de Agent Sessions removida | busca estática sem `agentSessionsWelcomePage`, `AgentSessionsWelcomePage` ou `openAgentSessionsWelcome` em `src`; eslint e `git diff --check` passaram nos cinco arquivos alterados |
| 2026-08-27 | `D-023` / `E09` | decisão confirmada | `serve` já é headless; manter `service-only`, sem poda ampla antes de auditoria de superfícies alcançáveis/empacotadas |
| 2026-08-27 | `OVN-001` / onda 1 | lanes 1A–1F executadas | auditoria E00-A, bloqueio humano E00-B, compile/teste E01-A, auditoria headless E01-B, preflight E01-C e matriz pura E01-D registrados; onda 2 não iniciada |
| 2026-08-27 | `OVN-T020/T030` / onda 2 | recortes 2A/2B verificados | runtime compile + suíte oficial Node 24/npm 11 passaram com 59 testes; cliente compile anterior + 8 testes browser passaram em Node 26; compile-client na matriz Node 24 falhou no worker tsgo; runner e integração E02/E03 continuam pendentes |
| 2026-08-26 | `E01-C/T-012` | implementação → `review` | bridge serializável, preflight fail-closed, compile/teste local e typecheck; runner/inventário real pendentes |
| 2026-08-29 | `CLI-003` | criada em `ready` | `Q-3` separada por decisão explícita: o destino do `code tunnel` e de `@microsoft/dev-tunnels-*` vira auditoria própria, fora do escopo da etapa A |
| 2026-08-29 | `CLI-001` / `CLI-002` | criadas em `ready`/`blocked` | auditoria somente-leitura do CLI em [`2026-08-29-cli-audit.md`](2026-08-29-cli-audit.md); decisões `D-027` (preservar Code Server) e `D-028` (`unigma-server` do próprio fork); plano [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md); nenhum código alterado |
| 2026-08-29 | `OVN-D024` / `T-100–T-104` | implementação → `review` | subsistema Agent Host, CAPI, SDK legado, registros de build e smoke/E2E removidos; busca estática sem import residual; runner, artefato e notices pendentes |
| 2026-08-30 | `E01-B` / `T-011` | contrato do cliente validado contra o binário real | `OpenCodeHttpClient` compilado conectou a `/usr/bin/opencode` `1.18.23` (health, OpenAPI `3.1.0`, `/path.directory`, SSE `server.connected`); `GET /provider` (`5 750 600` bytes) era rejeitada pelo limite de 4 MiB e o limite HTTP passou a 16 MiB, com o guarda de evento SSE mantido; teste opt-in `OPENCODE_REAL_E2E=1` adicionado; 61 testes + 1 pending por padrão, 62 com o E2E, `typecheck-client`, `test-build-scripts` 262/262 e eslint passaram sob Node `24.18.0`; prompt/streaming/permissão reais e bundle service-only continuam pendentes |
| 2026-08-30 | `E01-D` / `T-050/B.2` | scaffold → `partial` | resolver `ssh-remote` fail-closed, parsing sem segredo, probe `ssh -V` e gates locais implementados; transporte, `unigma-server`, host key e conexão real continuam bloqueados |
| 2026-08-29 | `CLI-001` / `T-110–T-113` | implementação → `review` | CLI Rust sem consumidores AHP, `PROTOCOL_VERSION=4`, módulos removidos, Code Server preservado; `cargo test` 33 testes e compile de `terminal-suggest` passaram; clippy baseline, Node 24/runner e notices pendentes |
| 2026-08-31 | `E02/E03` / `T-032/T-033` | backlog → implementação incremental | UI nativa passou a renderizar conteúdo/diff e aprovações; bridge mapeia `permission.asked`/`permission.replied` e o diff `SnapshotFileDiff`; compile/teste local anteriores passaram, runner e prompt real continuam pendentes |
| 2026-08-31 | `T-043` | implementação → `partial` | `/doc` do OpenCode `1.18.23` confirmou `/command` e `/skill`; contrato/catalogo transitório, parser e autocomplete nativos foram commitados. Retentativas Windows `33465962415` e Linux/WSL `33465963804` passaram; `@` continua textual até haver fonte de referências comprovada e T-044 permanece bloqueada por contrato intersessão |
| 2026-09-01 | `T-050` / `D-032` | contrato → implementação parcial | bootstrap SSH por push confirmado foi definido; validador puro do manifesto v1 passou em 9 testes focados. Transporte OpenSSH, geração do par, staging, ativação e VPS continuam pendentes; nenhuma escrita remota foi feita |
| 2026-09-01 | `T-050` / payload local | implementação parcial | checkout OpenCode `c2eacd72…`/1.18.23/MIT foi auditado; montador local do par com manifest SHA-256 passou 2 testes. O build externo, licença/notices de dependências, artefato final, staging e VPS ainda não foram executados |
| 2026-09-01 | providers/modelos | implementação parcial | runtime consulta `/provider?directory=` sob trust/preflight e emite IDs/rótulos sanitizados; painel nativo persiste a visibilidade global por usuário em `unigma.agent.hiddenModels`. Seleção por sessão exige modelo descoberto, usa `prompt_async.model` e só fica ativa na UI após ACK; validação no runner segue pendente |
| 2026-09-01 | OpenCode artifact | artefato produzido | `.github/workflows/opencode-linux-artifact.yml` fixou `OPENCODE_VERSION=1.18.23` e o run `33543332505` gerou `bin/opencode`, `LICENSE-opencode.txt` e `PROVENANCE.txt` do commit `c2eacd72…`; o binário respondeu `1.18.23`. Empacotamento no par e distribuição continuam pendentes |
| 2026-09-02 | `PR #9` | integrado na `main` | o conflito era restrito a dois workflows (`opencode-linux-artifact.yml` e `unigma-server-linux-artifact.yml`), cujas versões em `main` eram anteriores às da branch; resolvido sem perder conteúdo exclusivo. Merge `4f23bc2e` levou +17 200/−540 390 em 2 806 arquivos. Depois do merge, `unigma-linux-wsl-validation` (`33622281552`) e `unigma-server-linux-artifact` (`33622291887`) passaram **na `main`**. Os checks herdados do upstream (macOS, Monaco, chat-lib, Component Fixtures) já falhavam na `main` antes do PR e abortam em `Checkout microsoft/vscode`/`Setup system services`, antes de tocar no fork |
| 2026-09-02 | `CLI-001` / baseline de lints | baseline limpo | `cargo clippy -- -D warnings` passou sem lint pendente e `cargo test` somou 33 testes (28 + 5) sob o checkout atual; o `[patch.crates-io]` de `russh`/`russh-cryptovec`/`russh-keys` era resíduo — o próprio Cargo reportava que não entrava no grafo e não havia uso em `cli/src` —, foi removido e o lock perdeu três dependências `git` externas, sem alterar clippy nem os testes |
| 2026-09-02 | `E01-E` / validação | matriz Windows reexecutada | `unigma-self-hosted-validation` run `33613368047` passou na mesma ref, cobrindo o alvo Windows depois das mudanças de build |
| 2026-09-02 | `CLI-003` / `Q-3` | auditoria concluída, decisão ainda humana | os nove módulos de `cli/src/tunnels` servem ao Code Server/RPC preservado por `D-027` e nenhuma dependência Rust atual é exclusiva de Dev Tunnels; o CLI produz apenas o binário `code`. Restaram referências obsoletas: `extensions/tunnel-forwarding/src/extension.ts:271-280` invoca `code tunnel forward-internal`, que não existe mais no dispatch Rust, e `build/lib/i18n.resources.json` aponta `remoteTunnel`/`tunnelHost`, diretórios inexistentes. `tunnel-forwarding` compila localmente mas já é excluída da distribuição. Nada foi podado: a remoção depende de decisão explícita |
| 2026-09-02 | `E01-E` / validação | matriz oficial reexecutada na ref atual | `unigma-linux-wsl-validation` run `33612053543` passou depois das mudanças de build (esbuild no `gulpfile.reh.ts`, `remote/LICENSE`, correções de tipo em `unigmaAgent` e `ChangesetReviewActionViewItem`), confirmando ausência de regressão no alvo desktop Linux |
| 2026-09-02 | `T-050` / payload v1 | par montado e aceito pelo validador | com o artefato `09aa87ff…` e o OpenCode `1.18.23`, `build/unigma/make-payload.ts` produziu `server/unigma-server.tar.gz` (95 469 565 B), `bin/opencode` (185 661 568 B), `LICENSE-opencode.txt` e `manifest.json` (`totalSizeBytes` 281 131 133). `validateBootstrapManifest` aceitou o manifesto real (`valid: true`). Transporte OpenSSH, staging, ativação remota e VPS continuam pendentes |
| 2026-09-02 | `T-050` / `unigma-server` | artefato Linux x64 produzido | run `33610235193` gerou `server/unigma-server.tar.gz` com 3 224 entradas, `bin/unigma-server` executável, `extensions/`, `node_modules/`, `out/`, `node` e `product.json`, mais `PROVENANCE.txt` (commit `09aa87ff…`, node `24.18.0`) e `LICENSE-unigma-server.txt`. A causa da lentidão anterior era o server usar a trilha `gulp-tsb` com mangling enquanto o desktop já usava esbuild: alinhado o `gulpfile.reh.ts`, o empacotamento caiu para 44 s |
| 2026-09-02 | `T-050` / `unigma-server` | build do servidor ainda sem artefato | `.github/workflows/unigma-server-linux-artifact.yml` foi criado para empacotar `vscode-reh-linux-x64` como `server/unigma-server.tar.gz`. Os runs corrigiram defeitos reais do fork — `gulpfile.reh.ts` exigia `@github/copilot-linux-x64` sem `builtInExtensions` (`60e01a77`), a task `-ci` pressupunha compile prévio (`44a67eac`), `ChangesetReviewActionViewItem` promovia `updateChecked`/`getTooltip` a públicos e quebrava o mangler (`f6dfbc0e`) e o `tsgo` acusou três erros de tipo em `unigmaAgent` (`2df27a14`) — além de um bloqueio de ambiente: `/tmp` do WSL é tmpfs e mantinha `available` em 5.336 MB contra 11.021 MB fora dele (`51ac5631`). Nenhum artefato de servidor foi aceito até aqui |
