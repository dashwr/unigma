# unigma — backlog implementável

> **status:** backlog derivado da arquitetura aprovada em 2026-08-22. A E-00 tem
> build, artefato, auditoria técnica e smoke de núcleo Windows x64 e Linux x64
> reproduzidos no head `838ca94e`; a revisão legal/third-party e os direitos de
> branding continuam pendentes. O plano de fechamento está em
> [`planos/2026-08-26-e00-e01.md`](planos/2026-08-26-e00-e01.md).
> As demais tarefas além dos recortes 2A/2B continuam futuras. Este arquivo não
> autoriza distribuição ou publicação.

> feito: 2026-09-02 — T-052 implementou staging explícito com confirmação
> obrigatória, script POSIX entregue sem corpo em argv, payload tar em stdin,
> validação remota de manifesto/tamanho/SHA-256, extração e `mv -T` atômico sem
> apagar a versão anterior. O smoke separado passou localmente com o payload real
> Validado no runner com payload real (`33686239262`), incluindo idempotência e
> `GET /version` do servidor ativado. Matriz oficial e fiação do resolver
> permanecem pendentes.

> feito: 2026-09-02 — o auditor ganhou perfil explícito `--server` para o pacote
> REH Linux, com guarda de layout, identidade, gallery desabilitada, extensões
> proibidas/UI-only e conteúdo transitório; o workflow audita antes de publicar
> ou fazer upload, e a suíte cobre cinco fixtures sintéticas.

> feito: 2026-09-02 — implementado smoke de conexão SSH contra `sshd` efêmero,
> pré-populando o servidor a partir de `unigma-server-latest`, com host key e
> identidade descartáveis, verificação de `/version`, teardown e relatório. A
> execução real permanece pendente no runner self-hosted; o smoke não foi rodado
> localmente porque sobe um `sshd`.

> feito: 2026-09-02 — o transporte SSH passou a derivar caminhos de `$HOME` no
> host, usando um único `ControlMaster`; o handshake devolve o socket efetivo,
> o forward é adicionado por `ssh -O forward`, e o smoke local passou com 16
> checks. A suíte compilada da extensão passou com 63 testes.

> feito: 2026-09-02 — o trabalho da branch `work/2026-08-26-e00-e03` foi integrado
> na `main` pelo merge `4f23bc2e` (PR #9). O conflito era restrito a dois
> workflows cujas versões em `main` eram anteriores. Já na `main`,
> `unigma-linux-wsl-validation` (`33622281552`) e `unigma-server-linux-artifact`
> (`33622291887`) passaram. Isso não autoriza distribuição: notices, titularidade
> de licença e branding continuam pendentes.
>
> feito: 2026-09-02 — removida a extensão morta `tunnel-forwarding`, suas
> referências de build/lint, as specs `code-tunnel`/`code-tunnel-insiders` e as
> entradas i18n de diretórios inexistentes; a guarda do auditor contra esse nome
> foi mantida para rejeitar artefatos residuais. Code Server/RPC, port forwarding
> genérico do workbench e cleanup legado do instalador foram preservados. Também
> saíram os workflows presos a runners do upstream (`pr.yml`, `pr-node-modules.yml`,
> os quatro `pr-*-test.yml` e `copilot-setup-steps.yml`), que nunca puderam ser
> escalonados neste fork. `unigma-server-linux-artifact` (`33633940417`) e
> `unigma-linux-wsl-validation` (`33634579380`) passaram depois da poda.
>
> feito: overnight 2026-08-27 executou triagem E00–E03, aplicou correções locais
> no bridge, auditor e recortes estruturalmente independentes, e registrou evidência/bloqueios em
> [`status/2026-08-27-overnight.md`](status/2026-08-27-overnight.md); nenhum épico
> foi promovido sem runner, bundle ou revisão independente.
>
> feito: `test-build-scripts` passou com 270 testes/40 suites e `compile-client`
> passou em `2.47 min`; ambos são evidência local e não fecham os gates oficiais.
>
> feito: decisão `D-023` confirmou manter `service-only`; `opencode serve` já é
> headless, então a próxima etapa é auditar superfícies e aplicar somente patch
> mínimo comprovado.
>
> feito: plano de ondas E00–E03 criado em
> [`planos/2026-08-27-e00-e03-ondas.md`](planos/2026-08-27-e00-e03-ondas.md) e
> apontado pelo `AGENTS.md`; os recortes 2A/2B foram verificados e a onda 3 não
> foi iniciada.
>
> feito: onda 1 executada nas lanes 1A–1F; evidências e bloqueios foram
> consolidados em [`status/2026-08-27-overnight.md`](status/2026-08-27-overnight.md);
> os recortes 2A/T-020 e 2B/T-030 da onda 2 foram verificados localmente, sem
> promover E02/E03 a aceite.
>
> feito: 2026-08-29 — a implementação local da onda 1/T-100–T-104 removeu as
> contribuições e o subsistema Agent Host herdados, suas entradas de build/SDK e
> smoke/E2E, com busca estática sem imports residuais. O estado permanece
> `review`: compile, typecheck, testes, artefato e delta de notices ainda devem
> ser colhidos no runner oficial.
>
> feito: 2026-08-29 — removido o caminho residual de Agent Sessions Welcome da
> configuração de startup, layout, tema e walkthrough; a página órfã foi excluída.
>
> feito: 2026-08-29 — compatibilidade do runtime fixada em OpenCode `1.18.23`,
> com rejeição fail-closed de versões diferentes; compile/typecheck do cliente e
> 60 testes do runtime passaram sob Node `24.18.0`.
>
> feito: 2026-08-30 — matriz oficial verde no head `91867fb1`: Windows
> `33328903196` e Linux/WSL2 `33330427263`, ambos com pacote, auditoria de
> distribuição, smoke e evidência de artefato. Antes disso, dois defeitos do
> corte `D-024` foram corrigidos: `IAgentSessionsService` deixou de ser
> registrado enquanto 36 consumidores do stack de chat continuavam vivos — o
> customer `MainThreadChatSessions` quebrava o RPC do extension host — e
> `ChatStatusBarEntry` ficava fora do gate `isChatPanelEnabled`, mantendo um
> ícone sem destino cujo dashboard lia `defaultChatAgent` inexistente. A
> classificação dos gaps de notices root mostrou que as 7 "licenças ausentes"
> são falso positivo do parser e que 254 dos 978 manifest-only não são
> distribuídos; após remover as dependências Copilot da raiz e de `remote/`, o
> escopo root ficou em 695 manifest-only. A geração final depende do artefato
> CG do Azure DevOps.
>
> feito: 2026-08-30 — `D-032` desativa somente `workbench.panel.chat`; o smoke
> preserva os casos Integrated Browser independentes, declara os dois casos Chat
> como capability não suportada e usa fixture visual neutra. O auditor ganhou
> `--scope all|root|cli`; a CLI passa com zero manifest-only/licença ausente. O
> escopo root permanece pendente; os 7 avisos de licença são falso positivo do
> parser, e o notice final não foi regenerado após a poda de dependências.
>
> validado: 2026-08-30 — no head `ac74acec`, Windows (`33340526388`) e
> Linux/WSL2 (`33341927790`) passaram instalação limpa, pacote, auditoria,
> smoke e evidência após remover `@github/copilot` e `@github/copilot-sdk` da
> raiz e de `remote/`. Artefatos: Windows `9740716863` / `251764464` bytes;
> Linux `9741090425` / `178618673` bytes.
>
> validado: 2026-08-31 — o patch de contrato real OpenCode e a fronteira SSH
> fail-closed passaram novamente no mesmo head `d00521d6`: Windows
> `33345230165` e Linux/WSL2 `33347302898`; artefatos `9742391434` /
> `251783295` bytes e `9742755123` / `178649969` bytes.
>
> feito: 2026-08-29 — auditoria somente-leitura do CLI Rust registrada em
> [`status/2026-08-29-cli-audit.md`](status/2026-08-29-cli-audit.md). Ela separa o
> Code Server (necessário ao SSH remoto, preservado) do Agent Host/AHP herdado
> (removível) e originou as decisões `D-027` e `D-028`. Nenhum código foi alterado
> na auditoria.
>
> próximo plano: [`planos/2026-08-29-cli-ssh-remoto.md`](planos/2026-08-29-cli-ssh-remoto.md).
> Etapa A desacopla o Agent Host do CLI preservando `code_server.rs`, o bridge, o
> multiplexer, o protocolo e o `command-shell`; etapa B implementa e valida
> OpenSSH → `unigma-server` remoto → extension host remoto →
> `unigma-agent-runtime` → `opencode serve` (T-050/T-051/T-052/T-053). Os testes
> ficam concentrados no fim de cada etapa.
>
> feito local: 2026-08-29 — `CLI-001` removeu consumidores/módulos AHP do CLI Rust,
> fixou `PROTOCOL_VERSION=4`, preservou o Code Server e removeu o subcomando Agent
> das completions. `cargo test` passou com 33 testes e `terminal-suggest` compilou
> sem erros. O aceite permanece em `review`: clippy tem cinco lints baseline,
> Node 24/runner e a atualização de `cli/ThirdPartyNotices.txt` continuam pendentes.
>
> evidência runner: a execução [`33267418418`](https://github.com/dashwr/unigma/actions/runs/33267418418)
> passou no commit `a3300897`, com build Windows x64, auditoria de pacote, smoke,
> checks focados e contrato do runtime; o artefato não expirou. Clippy e notices
> continuam gates separados.
>
> evidência Linux: a execução [`33279351708`](https://github.com/dashwr/unigma/actions/runs/33279351708)
> passou no commit `e6b4e1bd` após a correção de retry/backoff para downloads do
> npm/node-gyp; build, auditoria, smoke e upload de evidência concluíram.

## como usar

- IDs `E-*` identificam épicos, `T-*` tarefas e `ST-*` subtarefas;
- dependências são bloqueios técnicos reais, não ordem burocrática;
- “responsável lógico” indica a frente que deve tomar a decisão ou executar o
  trabalho, não uma pessoa nomeada;
- caminhos do snapshot Code - OSS estão fixados pela base registrada em
  `docs/UPSTREAM.md`; caminhos próprios continuam sujeitos à implementação;
- qualquer decisão que altere escopo ou arquitetura volta para
  [DECISIONS.md](DECISIONS.md) antes de implementação.

## estado de execução da E-00

Registro consolidado do trabalho executado no checkout local `E:\unigma`, nos
clones temporários de validação e no runner self-hosted Windows. As execuções
finais `32930950550` e `32929454545` criaram evidência, auditoria técnica e
artefatos de teste Windows x64 e Linux x64; a revisão legal/third-party ainda
está pendente.

| frente | feito | ainda necessário |
| --- | --- | --- |
| T-001 upstream | tag `1.134.0`, SHA, Node, Electron e alvos registrados em `docs/UPSTREAM.md` e `DECISIONS.md` | validar compatibilidade de build/artefato em ambiente suportado |
| T-002 importação | snapshot importado; `upstream` configurado; licenças/notices preservados; método registrado; builds/artefatos de teste Windows x64 e Linux x64 reproduzidos | revisar a árvore upstream e os metadados empacotados antes de distribuição |
| T-003 harness | comandos reais registrados em `AGENTS.md`; `npm ci`, compile, empacotamento, auditoria e smoke de núcleo passaram em Windows x64 (`32930950550`) e Linux x64 (`32929454545`) | revisão final; `test-node` depende de `out/` |
| T-004 identidade | `README.md`, `product.json`, `resources/unigma/`, metadados próprios, filtros de extensões e auditor técnico ajustados; tar/ZIP finais inspecionados | concluir auditoria legal/licenças, inventário de terceiros e direitos dos ativos |

### bloqueios ambientais registrados

- `npm ci` no workspace sincronizado falhou com `TAR_ENTRY_ERROR`, `EBADF` e
  `EPERM`; a validação foi repetida em clone temporário com caminho curto;
- instalação completa encontrou `MSB8040` em `@vscode/native-watchdog`, pois o
  toolchain não possui bibliotecas Spectre do Visual Studio; não instalar esse
  componente sem autorização específica;
- as execuções históricas `32841175404` e `32841731686` falharam no bootstrap do
  Visual Studio e confirmaram que o runner não era elevado para instalar o
  componente; depois que o pré-requisito passou a estar disponível no runner,
  `32896363977` concluiu `npm ci`, checks, build e smoke Windows x64 com sucesso.
- o upstream orquestra a árvore nested pelo `npm install` no root, usando os
  scripts `preinstall`/`postinstall` de `package.json`,
  `build/npm/dirs.ts` e `build/npm/postinstall.ts`; `--ignore-scripts` deixa a
  árvore incompleta;
- `compile-client` é o menor compile sem Copilot. A tentativa oficial não foi
  feita porque requer toolchain nativo e o bloqueio conhecido é
  `MSB8040`/bibliotecas Spectre;
- em ciclos controlados anteriores, `compile-client` no checkout local avançou
  pelo pipeline principal, mas parou em `extensions/mermaid-markdown-features`
  porque o `esbuild` nested não está instalado; tentativas anteriores também
  encontraram `vscode-webview`, `@vscode/markdown-it-katex` e tipos de Node
  ausentes;
- a tentativa controlada mais recente, com dependências parciais, parou em
  `extensions/github-authentication` por tipos `mocha`/`node` ausentes;
- após muitos ciclos limitados de dependência nested, a caça incremental foi
  encerrada para não transformar E-00 em manutenção especulativa do upstream;
- no cross-build Linux `32901756829`, o runner confirmou WSL e Docker ausentes;
  `npm ci` e o compile do runtime passaram, mas o bundle esbuild Linux falhou
  com `The service was stopped`. O rerun foi cancelado durante `npm ci`; não
  houve artefato nem smoke Linux. A tentativa não prova compatibilidade Linux.
- a workflow manual `.github/workflows/unigma-linux-wsl-validation.yml` foi
  executada no run `32916035363`, commit `24464056`, no runner `WIREDNEOMKII`.
  Ubuntu WSL2 concluiu bootstrap de dependências/Node, `npm ci`, compile do
  runtime próprio, `vscode-linux-x64`, smoke de núcleo e escrita/upload da
  evidência; o artefato foi publicado como `unigma-linux-x64-32916035363`.
- `test-node` retornou código de processo 0, mas emitiu `ERR_MODULE_NOT_FOUND`
  para arquivos ausentes em `out/`; por isso não foi tratado como teste aprovado.
- auditorias npm relataram vulnerabilidades herdadas das dependências; não
  executar `npm audit fix` automaticamente.
- a revisão do artefato `unigma-linux-x64-32916035363` confirmou a presença de
  `LICENSE.txt` e do `ThirdPartyNotices.txt` raiz no tar, com hashes iguais aos
  do checkout; três notices adicionais de extensões também foram incluídos.
- o `product.json` do tar mantém identidade `unigma`, MIT, sem gallery/feed/report
  ou voz, mas o `resources/app/package.json` ainda expõe
  `Microsoft Corporation` e `https://github.com/microsoft/vscode.git` em autor e
  repositório. Isso bloqueia a revisão de identidade até correção ou justificativa.
- o tar não contém caminhos de Copilot, mas contém 27 caminhos GitHub, 13 de
  `microsoft-authentication` e dois binários MSAL. `builtInExtensions: []` não
  basta para afirmar que as superfícies upstream estão ausentes, pois o pacote
  recebe os diretórios compilados de `.build/extensions/**`.
- o wrapper do artefato inclui logs de smoke além do tar. A varredura local não
  encontrou chaves de autorização, Bearer ou access/refresh token nesses logs,
  mas o wrapper não é um pacote de release e não deve ser redistribuído.
- `audit-notices.ts` continua sem relatório executável no checkout porque importa
  `parse-notices.js`, inexistente ao lado de `parse-notices.ts`, e não há `tsx`.
  Não instalar ferramenta nem executar o scanner de licenças com rede sem nova
  necessidade explícita.

### resultado final da rodada 2026-08-26

- `5efc250d` adicionou o auditor sem dependências aos dois workflows e
  `838ca94e` corrigiu o último erro de tipo da view nativa;
- `32929454545` (Linux WSL2) e `32930950550` (Windows x64), ambos no head
  `838ca94e`, passaram `npm ci`, testes do runtime, compile/checks focados,
  empacotamento, auditoria e smoke, com artefatos publicados;
- a auditoria direta dos pacotes confirmou identidade própria, licença/notices
  preservados, metadados próprios, gallery nula e ausência das quatro extensões
  proibidas. Os ativos de plataforma empacotados coincidem com as fontes
  versionadas;
- esses resultados encerram o gate técnico de build/distribuição da E-00, mas
  não substituem o inventário legal completo nem a revisão independente dos
  direitos/originalidade da marca.

Os bloqueios históricos acima não foram classificados como bugs do unigma. A
evidência técnica de artefato/smoke para Windows x64 e Linux x64 está concluída;
a E-00 só pode ser marcada integralmente concluída após a revisão de distribuição
exigida por T-002/T-004.

## fontes e rastreabilidade

- arquitetura e fronteiras: [ARCHITECTURE.md](ARCHITECTURE.md);
- requisitos: [REQUIREMENTS.md](REQUIREMENTS.md);
- fluxos: [FLOWS.md](FLOWS.md);
- fontes de verdade: [DATA-MODEL.md](DATA-MODEL.md);
- evidências de aceite: [ACCEPTANCE.md](ACCEPTANCE.md);
- decisões aprovadas: [DECISIONS.md](DECISIONS.md).

## regras de execução

1. preservar as fontes de verdade: OpenCode, Git, OpenSSH, filesystem e
   Code - OSS; não criar banco ou cópia paralela;
2. iniciar OpenCode pelo CLI `opencode serve`, no máximo uma instância por
   extension host, reutilizada por sessões e limitada ao loopback;
3. a superfície principal do agente é contribuição nativa do workbench; não
   criar Webview para substituí-la;
4. workspace confiável, política do OpenCode e aprovação explícita precedem
   efeitos em arquivo, terminal, Git, MCP ou plugin;
5. patches de performance sobre Code - OSS exigem perfil antes/depois, escopo
   mínimo e regressão coberta; nunca desabilitar sandbox, GPU ou segurança do
   Electron;
6. não adicionar dependência, runner, compatibilidade, serviço, telemetria,
   RBAC ou infraestrutura fora do escopo aprovado.

# EPICS

| ID | Épico | Resultado | Pré-condição principal |
| --- | --- | --- | --- |
| E-00 | fundação upstream | fork reproduzível, identidade e comandos verificados | nenhuma |
| E-01 | contratos operacionais | contratos de UI, OpenCode, SSH, providers e integrações definidos | E-00/T-001 pode fornecer versão |
| E-02 | runtime OpenCode | processo filho supervisionado e cliente HTTP/SSE reutilizável | E-00 e E-01 |
| E-03 | workbench nativo | painel de agente integrado ao IDE sem Webview | E-00 e E-01 |
| E-04 | capacidades do agente | sessões, diffs, aprovações, worktrees, subagentes e configuração | E-02 e E-03 |
| E-05 | remoto SSH | agente e workspace operando no host remoto | E-01, E-02 e E-00 |
| E-06 | segurança e performance | fronteiras testadas e baseline/regressões mensuráveis | artefato executável |
| E-07 | qualidade e distribuição | testes, builds multiplataforma e gate de release | implementação integrada |
| E-08 | Intelligence Index/Autopilot | roteamento local opt-in, versionado, mensurável e integrado à UI nativa | E-01, E-02, E-03 e gates de E-06 |
| E-09 | perfil OpenCode service-only e bundle | decepador reproduzível, runtime bundled, atualização atômica e rollback | E-00/T-001 e E-01/T-011 |

# TASKS

## E-00 — fundação upstream

### T-001 — fixar upstream e matriz de plataforma

**status:** concluída; compatibilidade local ainda parcial e sem artefato.

- **objetivo:** escolher commit inicial de Code - OSS e registrar versões
  compatíveis de Node.js, Electron, ferramentas e Windows/Linux x64.
- **responsável lógico:** mantenedor de upstream/build.
- **dependências:** nenhuma.
- **arquivos/módulos prováveis:** `docs/DECISIONS.md`, `docs/REQUIREMENTS.md`,
  `package.json` e metadados do upstream após importação.
- **critérios de aceite:** commit, versões, cadência de atualização e fonte de
  cada versão estão registrados; Electron é compatível com o commit, não apenas
  “o mais novo”; nenhuma decisão de produto é ampliada.
- **testes necessários:** verificação de checkout limpo e compatibilidade
  declarada pelo upstream em Windows x64 e Linux x64.
- **riscos:** escolher uma base sem suporte ou com incompatibilidade de build;
  mitigação: registrar evidência e manter a matriz pequena.
- **paralelo:** pode rodar em paralelo com T-010, T-011, T-012 e T-013.
- **bloqueia:** T-002, T-003, T-004 e toda implementação dependente do upstream.

### T-002 — importar fork e preservar proveniência

**status:** concluída quanto à importação, proveniência e build de teste
multiplataforma; revisão final de distribuição ainda bloqueada.

- **objetivo:** importar Code - OSS no repositório `unigma` e aplicar apenas a
  identidade/proveniência mínima aprovada.
- **responsável lógico:** mantenedor de upstream/build + revisão legal.
- **dependências:** T-001.
- **arquivos/módulos prováveis:** `src/`, `build/`, `resources/unigma/`,
  `product.json`, notices e arquivos de licença do upstream.
- **critérios de aceite:** checkout reproduzível; marca Microsoft/VS Code não é
  apresentada como identidade do produto; notices, copyrights e licenças são
  preservados; nenhuma feature de agente é implementada nesta tarefa.
- **testes necessários:** inspeção de proveniência/licenças; build mínimo do
  upstream conforme comando verificado em T-003.
- **riscos:** importação incompleta ou violação de licença/identidade;
  mitigação: revisão de artefatos antes de qualquer UI própria.
- **paralelo:** precisa aguardar T-001; depois pode liberar T-003, T-004, T-020
  e T-030 em frentes separadas.
- **bloqueia:** todos os módulos que importam APIs concretas do Code - OSS.

### T-003 — registrar comandos e harness do upstream

**status:** concluída quanto ao registro do harness; validação de compile/build e
smoke de núcleo executada em Windows x64 e Linux x64.

- **objetivo:** descobrir e registrar comandos reais de desenvolvimento, teste,
  lint, typecheck, build e empacotamento, sem inventar um runner.
- **responsável lógico:** mantenedor de build/CI.
- **dependências:** T-002.
- **arquivos/módulos prováveis:** `package.json`, documentação upstream,
  `build/`, `AGENTS.md` ou seção operacional equivalente.
- **critérios de aceite:** cada comando registrado foi executado ou justificado
  como específico de plataforma; comandos ausentes permanecem explicitamente
  ausentes; o `AGENTS.md` é atualizado com fatos verificados.
- **testes necessários:** execução mínima dos comandos descobertos em ambiente
  limpo, sem instalar dependência especulativa.
- **riscos:** confundir script de desenvolvimento com pipeline de distribuição;
  mitigação: registrar escopo, plataforma e saída esperada de cada comando.
- **paralelo:** após T-002, pode rodar em paralelo com T-004 e T-030.
- **bloqueia:** T-070, T-082 e qualquer validação que dependa do harness.

### T-004 — definir identidade de distribuição e notices

**status:** concluída para a fundação e identidade inicial; a inspeção do tar
Linux foi executada, mas autoria empacotada, triagem de terceiros, direitos dos
ativos e release continuam bloqueados.

- **objetivo:** preparar branding original, metadados e inventário de licenças
  sem publicar nem incorporar a fonte Cinderblock sem verificação.
- **responsável lógico:** mantenedor de distribuição + revisão legal/UX.
- **dependências:** T-001; T-002 para validar os pontos reais do fork.
- **arquivos/módulos prováveis:** `resources/unigma/`, `product.json`, notices,
  `docs/PRODUCT.md`, `docs/DECISIONS.md`.
- **critérios de aceite:** identidade `unigma`/`unigma-code`, idioma, tagline e
  paleta estão mapeados; ativos não copiam OpenCode/Microsoft; inventário de
  terceiros tem origem e licença; não há reserva ou publicação implícita.
- **testes necessários:** revisão manual de artefatos e checagem de notices.
- **riscos:** colisão de marca ou ativo sem licença; mitigação: bloquear release
  e manter a fonte candidata fora do produto até validação.
- **paralelo:** pode rodar em paralelo com T-003 e E-01.
- **bloqueia:** T-084 e publicação.

## E-01 — contratos operacionais

**status:** os quatro contratos da E-01 estão documentados no checkout. T-010
tem implementação inicial e T-011/T-012/T-013 têm políticas/matrizes iniciais,
mas o fechamento exige evidência executável fail-closed. O plano de fechamento
separa o gate contratual do suporte funcional downstream; nenhum provider,
integração local ou SSH é anunciado sem teste real.

### T-010 — especificar domínio e RPC UI↔runtime

**status:** contrato TypeScript e handler RPC do runtime têm implementação
inicial, com testes-fonte para duplicidade, sessão ausente, concorrência,
rollback e redaction. A suíte compilada do working tree atual ainda precisa ser
executada no runner.

- **objetivo:** transformar `AgentCommand`/`AgentEvent` em contrato TypeScript
  versionado, com estados, erros, `requestId` e validação de fronteira.
- **responsável lógico:** arquitetura de runtime/workbench.
- **dependências:** nenhuma para a especificação; T-001 para anotar compatibilidade
  quando necessário.
- **arquivos/módulos prováveis:** `docs/FLOWS.md`, `docs/DATA-MODEL.md`,
  `src/vs/workbench/contrib/unigmaAgent/common/`.
- **critérios de aceite:** cobre iniciar/parar sessão, entrada, diff,
  aprovar/rejeitar, worktrees, configuração, resultados e erros; não expõe
  endpoint OpenCode à UI; payloads inválidos têm comportamento definido. A
  validação estrutural não mantém estado de sessões ou de `requestId`; erros de
  duplicidade e sessão inexistente devem ser produzidos e testados na camada de
  aplicação.
- **testes necessários:** casos de contrato para cada comando/evento, IDs
  duplicados e sessão inexistente como erros da camada de aplicação, além de
  payload inválido.
- **riscos:** contrato grande demais ou acoplado ao OpenCode; mitigação: tipos
  internos estáveis e adaptador único.
- **paralelo:** pode rodar em paralelo com T-001, T-011, T-012 e T-013.
- **bloqueia:** T-020, T-030, T-031, T-060 e integrações UI/runtime.

### T-011 — definir compatibilidade OpenCode e providers

**status:** matriz documental e fixture interna alinhadas aos 15 pares
método/path consultados pelo cliente; `/usr/bin/opencode` `1.18.23` foi
verificado por SHA-256 e passou no probe real isolado de health, OpenAPI,
workspace, SSE, sessão e operações mínimas. Nenhum provider/modelo é anunciado
como suportado.

> feito: 2026-08-30 — o `OpenCodeHttpClient` compilado foi validado contra o
> binário real `1.18.23`. `GET /provider`, operação requerida, responde com
> `5 750 600` bytes e era rejeitada pelo limite único de 4 MiB; o limite de
> resposta HTTP subiu para 16 MiB e o guarda de evento SSE ficou em 4 MiB. Um
> teste de integração opt-in (`OPENCODE_REAL_E2E=1` mais versão exata) cobre
> health, `/doc`, `/path`, SSE e as operações do perfil; a suíte padrão continua
> sem depender do executável externo.

- **objetivo:** enumerar versão/protocolo HTTP/SSE, endpoints usados, eventos,
  tratamento de reinício e conjunto inicial de providers/modelos permitido.
- **responsável lógico:** integração OpenCode + responsável de produto.
- **dependências:** T-001 para registrar a combinação testada; interfaces
  documentadas do OpenCode como fonte.
- **arquivos/módulos prováveis:** `docs/DECISIONS.md`, `docs/REQUIREMENTS.md`,
  `docs/ACCEPTANCE.md`, adaptador futuro em `infrastructure/opencode/`.
- **critérios de aceite:** suporte concreto é listado por capacidade; falhas e
  incompatibilidade geram eventos; credenciais permanecem no OpenCode; nada é
  anunciado além do que será testado.
- **testes necessários:** fixture/servidor controlado cobrindo endpoints e
  eventos escolhidos; teste de versão incompatível.
- **riscos:** API mudar ou suporte amplo virar promessa; mitigação: contrato
  mínimo, matriz versionada e fallback apenas para erro explícito.
- **paralelo:** pode rodar em paralelo com T-010, T-012 e T-013.
- **bloqueia:** T-021, T-022, T-024, T-042 e AC-003/AC-008.

### T-012 — definir política local de MCP, plugins e regras

**status:** preflight sanitizado, revalidação no extension host, bridge
serializável workbench↔extension host e testes-fonte de recusa implementados. O
inventário conectado de plugin/regra, a suíte compilada e a evidência contra
OpenCode real continuam pendentes; não há suporte funcional anunciado.

- **objetivo:** definir fontes, formato, confiança, carregamento, recusa e
  isolamento das integrações locais encaminhadas ao OpenCode.
- **responsável lógico:** segurança + integração OpenCode.
- **dependências:** T-001; não depende de implementação.
- **arquivos/módulos prováveis:** `docs/FLOWS.md`, `docs/REQUIREMENTS.md`,
  `docs/ACCEPTANCE.md`, settings e adaptadores de configuração futuros.
- **critérios de aceite:** somente fontes explícitas e autorizadas; sem catálogo,
  Marketplace ou instalação silenciosa; comportamento em workspace não confiável
  e configuração inválida está definido.
- **testes necessários:** carregamento, recusa, workspace não confiável e logs
  sem segredos.
- **riscos:** permitir execução arbitrária por configuração; mitigação: trust,
  validação e aprovação antes do efeito.
- **paralelo:** pode rodar em paralelo com T-010, T-011 e T-013.
- **bloqueia:** T-042, T-060 e AC-005.

### T-013 — definir contrato de SSH remoto

**status:** política pura e matriz fail-closed implementadas, com smoke local das
recusas. Transporte, provisionamento, `known_hosts` e conexão real continuam
pendentes. Host remoto Windows permanece recusado por este contrato e não é
suporte publicado.

- **objetivo:** fixar matriz de host/cliente, provisionamento permitido,
  `known_hosts`, agente SSH, falhas e versão do servidor remoto.
- **responsável lógico:** integração remota + segurança operacional.
- **dependências:** T-001; não depende de implementação.
- **arquivos/módulos prováveis:** `docs/FLOWS.md`, `docs/REQUIREMENTS.md`,
  `docs/ACCEPTANCE.md`, `extensions/unigma-remote-ssh/`.
- **critérios de aceite:** não solicita/copia senha ou chave; define onde o
  extension host e `opencode serve` rodam; incompatibilidades são recusadas de
  forma observável; matriz Windows/Linux é explícita.
- **testes necessários:** conexão aceita, host não confiável, versão incompatível,
  perda de conexão e caminho remoto sem cópia do workspace.
- **riscos:** suporte remoto amplo demais ou provisionamento inseguro;
  mitigação: OpenSSH existente e matriz mínima testável.
- **paralelo:** pode rodar em paralelo com T-010, T-011 e T-012.
- **bloqueia:** T-050, T-051, T-052, T-053 e AC-007.

## E-02 — runtime OpenCode

### T-020 — criar esqueleto de `unigma-agent-runtime`

**status:** recorte 2A verificado em Node `24.18.0`/npm `11.16.0`; compile e a
suíte oficial do runtime passaram com 59 testes. Runner multiplataforma e
integração E02/E03 ainda estão pendentes.

- **objetivo:** criar a extensão interna com camadas `application`, `domain` e
  `infrastructure`, ativação preguiçosa e ponto de RPC.
- **responsável lógico:** engenharia de runtime.
- **dependências:** T-002, T-003 e T-010.
- **arquivos/módulos prováveis:** `extensions/unigma-agent-runtime/`, manifesto,
  `src/application/`, `src/domain/`, `src/infrastructure/`, `test/`.
- **critérios de aceite:** extensão compila pelo harness upstream; não possui
  UI Webview; ativação não inicia OpenCode sem demanda; fronteiras de módulo são
  verificáveis.
- **testes necessários:** ativação lazy, descarte de recursos e contrato RPC.
- **riscos:** extensão virar camada genérica ou iniciar processos ansiosamente;
  mitigação: um caso de uso por vez e teste de ciclo de vida.
- **paralelo:** após T-010, pode rodar em paralelo com T-030 e T-050.
- **bloqueia:** T-021 a T-024 e integração local.

### T-021 — supervisionar CLI `opencode serve`

**status:** implementação inicial, testes fonte e execução compilada do runtime
passaram nos runs finais; teste contra um binário OpenCode fixado permanece
pendente.

- **objetivo:** iniciar, aguardar, reutilizar e encerrar somente o processo
  criado pelo runtime, com uma instância por extension host.
- **responsável lógico:** engenharia de runtime/processos.
- **dependências:** T-020 e T-011.
- **arquivos/módulos prováveis:** `infrastructure/opencode/ProcessManager`,
  ativação da extensão e testes de processo.
- **critérios de aceite:** start/stop idempotentes; porta/endpoint ficam no
  loopback; processo é reutilizado entre sessões; falha de start, crash e host
  encerrado viram eventos explícitos; processo alheio nunca é morto.
- **testes necessários:** processo ausente, pronto, timeout, crash, reinício,
  duas sessões e encerramento do extension host.
- **riscos:** processo órfão, corrida de inicialização ou exposição LAN;
  mitigação: ownership explícito, timeout e teste de concorrência.
- **paralelo:** depois de T-020, pode rodar em paralelo com T-022 e T-023.
- **bloqueia:** T-024, T-051 e AC-003.

### T-022 — implementar cliente HTTP/SSE OpenCode

**status:** adapter, fixture estrutural local e testes compilados executados nos
runs finais; compatibilidade real permanece condicional a T-011.

- **objetivo:** encapsular os endpoints documentados e converter eventos SSE em
  tipos internos, sem vazar transporte para a UI.
- **responsável lógico:** engenharia de integração OpenCode.
- **dependências:** T-020, T-010 e T-011.
- **arquivos/módulos prováveis:** `infrastructure/opencode/OpenCodeClient`,
  `SseSubscriber`, schemas e testes de contrato.
- **critérios de aceite:** somente HTTP/SSE documentados; valida payloads;
  preserva ordem por sessão; reconexão/erro/incompatibilidade são eventos;
  nenhum token, prompt ou diff é logado por padrão.
- **testes necessários:** fixture HTTP/SSE, stream interrompido, evento inválido,
  resposta de erro e reconexão.
- **riscos:** duplicar estado do OpenCode ou perder eventos; mitigação: adaptador
  único, sequência por sessão e snapshots descartáveis.
- **paralelo:** depois de T-020, pode rodar em paralelo com T-021 e T-023.
- **bloqueia:** T-024, T-032, T-033, T-042 e AC-003.

### T-023 — implementar armazenamento mínimo e diagnóstico redigido

**status:** armazenamento mínimo, redaction e testes compilados executados nos
runs finais; integração no fluxo de sessão permanece pendente.

- **objetivo:** persistir somente referência de sessão/configuração permitida e
  produzir logs locais com correlação sem conteúdo sensível.
- **responsável lógico:** runtime + segurança de dados.
- **dependências:** T-020 e T-010.
- **arquivos/módulos prováveis:** `infrastructure/storage/`, settings,
  `workspaceState`, `globalState`, output channel `Unigma` e testes.
- **critérios de aceite:** não cria banco; não salva prompt, diff, token, chave,
  senha ou workspace; aprovações pendentes não são restauradas; listeners e
  buffers transitórios são descartados.
- **testes necessários:** persistência/reabertura de referência, limpeza,
  inspeção de logs e ausência de segredos.
- **riscos:** retenção acidental de dados ou logs verbosos; mitigação: allowlist
  de campos e testes de redaction.
- **paralelo:** depois de T-020, pode rodar em paralelo com T-021 e T-022.
- **bloqueia:** T-024, T-040 e T-061.

### T-024 — integrar caso de uso local ponta a ponta

- **objetivo:** conectar RPC, processo, cliente e armazenamento para criar/
  retomar sessão, enviar entrada, receber resultado e expor erro.
- **responsável lógico:** engenharia de runtime.
- **dependências:** T-021, T-022, T-023 e T-010.
- **arquivos/módulos prováveis:** `application/session/`, `domain/`, composição
  da extensão e testes de integração local.
- **critérios de aceite:** uma interação percorre CLI → HTTP/SSE → OpenCode →
  evento RPC; sessões não criam processos adicionais; falhas são observáveis;
  efeitos seguem trust/permissão.
- **testes necessários:** servidor OpenCode controlado, sessão, evento, erro,
  reinício e duas sessões no mesmo processo.
- **riscos:** acoplamento indevido entre UI e endpoint ou corrida de eventos;
  mitigação: caso de uso contra interfaces internas e teste determinístico.
- **paralelo:** após concluída, libera E-04 e pode integrar em paralelo com T-031.
- **bloqueia:** T-031/T-032 de integração, T-040, T-041, T-042 e T-081.

## E-03 — workbench nativo

### T-030 — criar contribuição nativa `unigmaAgent`

**status:** recorte 2B verificado localmente; compile do cliente e teste browser
focado passaram. Integração de sessão/controle, matriz oficial e runner ainda
estão pendentes.

- **objetivo:** registrar contribuição de workbench, comandos, painel e ciclo de
  vida sem criar Webview ou acesso direto à rede/processo.
- **responsável lógico:** engenharia do workbench Code - OSS.
- **dependências:** T-002, T-003 e T-010.
- **arquivos/módulos prováveis:** `src/vs/workbench/contrib/unigmaAgent/browser/`,
  `common/`, registro de comandos/partes e testes do workbench.
- **critérios de aceite:** contribuição carrega sob demanda; usa componentes
  nativos; comunicação passa pelo RPC; estados vazio/carregando/erro existem;
  nenhuma chamada HTTP, filesystem ou processo parte da UI.
- **testes necessários:** registro, ativação lazy, comando sem runtime e teste
  de fronteira arquitetural.
- **riscos:** patch amplo no workbench ou criação de renderer extra; mitigação:
  escopo mínimo e revisão de dependências.
- **paralelo:** após T-002/T-010, pode rodar em paralelo com T-020 e T-050.
- **bloqueia:** T-031 a T-034 e AC-014.

### T-031 — implementar superfície de sessão

- **objetivo:** apresentar sessões, entrada do usuário, estados e resultados
  através do contrato RPC.
- **responsável lógico:** engenharia de UI nativa.
- **dependências:** T-030 e T-010; integração real com T-024 para teste ponta a ponta.
- **arquivos/módulos prováveis:** `unigmaAgent/browser/session/`, modelos de
  estado, comandos e testes visuais/funcionais.
- **critérios de aceite:** cria/retoma sessão; mostra loading, vazio, sucesso e
  erro; entrada não acessa OpenCode diretamente; histórico/renderização é
  incremental e limitado à sessão ativa.
- **testes necessários:** unidade de redução de eventos, teclado/foco,
  integração RPC e sessão indisponível.
- **riscos:** retenção de histórico completo ou UI bloqueante; mitigação:
  virtualização, descarte e perfil de streaming.
- **paralelo:** pode rodar em paralelo com T-021/T-022; precisa aguardar T-030.
- **bloqueia:** T-032, T-033 e integração UI final.

### T-032 — renderizar streaming e estados de conexão

> feito: 2026-08-31 — bridge aceita o envelope real de `message.part.updated`,
> traduz status estruturado e a UI nativa acumula conteúdo por delta; validação
> do runner e reconexão sem duplicação continuam pendentes.

- **objetivo:** transformar eventos SSE em atualização incremental, com conexão,
  reconexão, erro e cancelamento observáveis.
- **responsável lógico:** UI nativa + runtime.
- **dependências:** T-031, T-022 e T-024.
- **arquivos/módulos prováveis:** `unigmaAgent/browser/stream/`, adaptadores de
  eventos e componentes de lista virtualizada.
- **critérios de aceite:** eventos ordenados por sessão; UI permanece responsiva;
  reconexão não duplica conteúdo; buffers/listeners são liberados ao sair.
- **testes necessários:** stream longo, burst de eventos, interrupção,
  reconexão, cancelamento e medição de CPU/RSS.
- **riscos:** crescimento ilimitado de memória e renderização excessiva;
  mitigação: limite de estado e virtualização medidos.
- **paralelo:** depois de T-031, pode rodar em paralelo com T-033 e T-034.
- **bloqueia:** AC-003, AC-014 e parte de AC-015.

### T-033 — implementar diff e aprovação explícita

> feito: 2026-08-31 — diff `SnapshotFileDiff` e respostas reais de permissão
> (`permission.asked`/`permission.replied`) atravessam o contrato privado; a UI
> só retira a pendência após a confirmação do runtime. Runner e bundle oficial
> ainda não validaram o recorte ponta a ponta.

- **objetivo:** apresentar alteração, decisão do usuário e resultado de
  aprovação/rejeição sem autoaprovação ou restauração de pendência.
- **responsável lógico:** UI nativa + segurança de agente.
- **dependências:** T-031, T-024 e T-060.
- **arquivos/módulos prováveis:** `unigmaAgent/browser/diff/`, comandos de
  aprovação, integração com diff/editor do workbench.
- **critérios de aceite:** diff é revisável; aprovar/rejeitar exige ação explícita;
  política do OpenCode não é contornada; resultado/recusa aparece; pendência
  antiga não é presumida válida após reinício.
- **testes necessários:** diff vazio/grande, aprovação, rejeição, sessão reiniciada,
  workspace não confiável e ação RPC inválida.
- **riscos:** aplicar alteração sem consentimento ou duplicar diff na memória;
  mitigação: confirmação centralizada e consulta à fonte de verdade.
- **paralelo:** pode rodar em paralelo com T-032 e T-034 após T-060.
- **bloqueia:** AC-004, T-081 e gate de segurança.

### T-034 — aplicar temas, idioma e acessibilidade

- **objetivo:** entregar inglês padrão, pacote `pt-BR`, tokens roxos e estados
  acessíveis na contribuição nativa.
- **responsável lógico:** UI/UX + localização.
- **dependências:** T-030 e T-004; não depende do runtime para tokens/idioma.
- **arquivos/módulos prováveis:** temas, tokens, `nls`, contribuição de idioma,
  `resources/unigma/`, `unigmaAgent/browser/`.
- **critérios de aceite:** quatro famílias de fundo usam tokens consistentes;
  foco/teclado/contraste funcionam; inglês é padrão; `pt-BR` ativa pelo
  mecanismo do Code - OSS; nenhum ativo copia identidade alheia.
- **testes necessários:** revisão visual nos temas, navegação por teclado,
  contraste, localização e snapshot/manual quando suportado.
- **riscos:** acessibilidade sacrificada por customização ou ativo sem licença;
  mitigação: componentes nativos e revisão de identidade.
- **paralelo:** pode rodar em paralelo com T-031, T-032 e T-033 após T-030.
- **bloqueia:** AC-010, AC-011 e AC-012.

## E-04 — capacidades do agente

### T-040 — fechar ciclo de sessões, retomada e reconexão

- **objetivo:** suportar criação/retomada conforme OpenCode, reconexão e
  encerramento, mantendo apenas referências locais.
- **responsável lógico:** runtime + UI nativa.
- **dependências:** T-024, T-031, T-032 e T-023.
- **arquivos/módulos prováveis:** `application/session/`, `OpenCodeClient`,
  `unigmaAgent/browser/session/`, `workspaceState`.
- **critérios de aceite:** referência correta por workspace; processo é
  reutilizado; reinício não restaura aprovação; falha produz estado acionável.
- **testes necessários:** reabertura, troca de workspace, reconexão, crash e
  limpeza de referência.
- **riscos:** sessão de workspace errado ou estado obsoleto; mitigação: chave
  composta e validação com OpenCode.
- **paralelo:** pode rodar em paralelo com T-041 e T-042 após T-024.
- **bloqueia:** AC-004 e integração MVP.

### T-041 — integrar subagentes e worktrees

- **objetivo:** expor somente as operações suportadas de subagente/worktree,
  delegando execução ao OpenCode e Git.
- **responsável lógico:** runtime + integração Git.
- **dependências:** T-010, T-011, T-024 e T-030; T-033 para revisão/efeitos.
- **arquivos/módulos prováveis:** `application/worktree/`, `application/subagent/`,
  `infrastructure/git/`, UI de sessão e comandos.
- **critérios de aceite:** lista/cria/seleciona worktree por Git; ciclo de
  subagente é observável; caminhos não são copiados para banco; efeitos exigem
  confiança/aprovação conforme política.
- **testes necessários:** Git temporário, worktree inválido, subagente concluído,
  falha e limpeza.
- **riscos:** conflito de branches, processos órfãos ou escopo de subagente não
  suportado; mitigação: conjunto inicial explícito e ownership.
- **paralelo:** pode rodar em paralelo com T-040 e T-042 após T-024.
- **bloqueia:** AC-006.

### T-042 — integrar providers, MCP, plugins e regras autorizados

- **objetivo:** apresentar/encaminhar configurações locais conforme políticas,
  sem reimplementar protocolos nem transportar segredos.
- **responsável lógico:** integração OpenCode + segurança.
- **dependências:** T-011, T-012, T-024 e T-030.
- **arquivos/módulos prováveis:** settings, `application/config/`, adaptador
  OpenCode e UI de configuração.
- **critérios de aceite:** somente integrações da matriz aprovada aparecem;
  configuração inválida é recusada; workspace não confiável bloqueia efeito;
  tokens ficam fora de logs e armazenamento unigma.
- **testes necessários:** provider/modelo aprovado, MCP/plugin permitido,
  fonte recusada, configuração inválida e workspace não confiável.
- **riscos:** execução de código arbitrário, segredo duplicado ou catálogo
  acidental; mitigação: allowlist/política local e revisão de fronteira.
- **paralelo:** pode rodar em paralelo com T-040 e T-041 após T-024.
- **bloqueia:** AC-005, AC-008 e gate de segurança.

### T-043 — integrar atalhos de ferramentas e skills

> parcial: 2026-08-31 — parser nativo de `@`/`/`, catálogo RPC sanitizado e
> consulta comprovada a `/command` + `/skill` foram implementados. `@` permanece
> referência textual de arquivo/agente sem catálogo especulativo; a validação
> de build/teste passou no Windows `33465962415` e Linux/WSL `33465963804`.

> extensão: 2026-09-01 — runtime agora descobre e sanitiza modelos de
> `GET /provider` por workspace, sem expor credenciais, headers, options ou
> custos. O painel/toggle global `unigma.agent.hiddenModels` foi integrado no
> escopo de usuário. O runtime aceita seleção por sessão apenas para par já
> descoberto e o envia no schema `prompt_async.model`; a UI só mostra ativo após
> o ACK do runtime. A validação no runner continua pendente.

- **objetivo:** oferecer `@` para ferramentas e `/` para skills na superfície
  nativa do agente, encaminhando a seleção pelo contrato do OpenCode.
- **responsável lógico:** workbench nativo + runtime OpenCode.
- **dependências:** T-024, T-030, T-031 e T-012.
- **arquivos/módulos prováveis:** `src/vs/workbench/contrib/unigmaAgent/`,
  contrato RPC e adaptador OpenCode.
- **critérios de aceite:** ferramentas/skills são resolvidos somente a partir de
  fontes autorizadas; estados desconhecidos são observáveis; foco e teclado
  funcionam; a UI não acessa processo, rede ou segredo diretamente.
- **testes necessários:** resolução válida/inválida, trust, aprovação, teclado,
  acessibilidade e sessão indisponível.
- **riscos:** duplicar catálogo do OpenCode ou criar execução paralela;
  mitigação: referências transitórias e OpenCode como fonte de verdade.
- **paralelo:** pode rodar com T-044 após T-031, sem editar o mesmo contrato.
- **bloqueia:** AC-027.

### T-044 — integrar mensagens intersessão e chips de agentes

- **objetivo:** expor mensagens entre sessões locais e chips de agente/subagente
  com estados `thinking`, `typing` e `idle`.
- **responsável lógico:** runtime + workbench nativo.
- **dependências:** T-024, T-031, T-032 e T-041.
- **arquivos/módulos prováveis:** `application/subagent/`, eventos RPC e
  `unigmaAgent/browser/`.
- **critérios de aceite:** a relação pai/filha usa IDs do OpenCode; mensagens
  respeitam a sessão e a autoridade corretas; chips não inventam estado nem
  persistem conteúdo; a UI permanece incremental e responsiva.
- **testes necessários:** sessão pai/filha, mensagem entregue/recusada, mudança
  de estado, encerramento, reconexão e ausência de duplicação de histórico.
- **riscos:** criar um bus paralelo ou confundir colaboração com sincronização;
  mitigação: transporte local, fonte OpenCode e estado transitório.
- **paralelo:** pode rodar com T-043 após T-031; T-045 é independente no contrato.
- **bloqueia:** AC-027.

### T-045 — definir protocolo de controle remoto dormente

- **objetivo:** definir tipos versionados para controle remoto futuro sem ativar
  listener, cloud, colaboração em tempo real ou backend no MVP.
- **responsável lógico:** arquitetura de runtime + segurança.
- **dependências:** T-010, T-024 e T-061.
- **arquivos/módulos prováveis:** contrato RPC, `domain/` e testes de schema;
  nenhum servidor novo.
- **critérios de aceite:** serialização, versão, capacidades e recusas são
  testáveis; não há socket/listener, fila, sincronização ou persistência; o
  protocolo não contorna trust, aprovação ou política do OpenCode.
- **testes necessários:** payload válido/inválido, versão incompatível, ausência
  de ativação e inspeção do artefato.
- **riscos:** protocolo dormente virar API pública ou colaboração implícita;
  mitigação: flag inexistente em runtime, sem endpoint e documentação explícita.
- **paralelo:** pode rodar com T-043/T-044 sem editar a UI.
- **bloqueia:** AC-028.

## E-05 — remoto SSH

> feito: 2026-09-02 — `remoteStagingPlan.ts` calcula, sem qualquer I/O, o plano de
> staging e ativação a partir do manifesto validado: diretório versionado por
> commit, verificação de tamanho e hash por arquivo, extração do tar.gz do
> servidor e ativação atômica, sem remover a versão anterior. A suíte da extensão
> passou com 48 testes e o plano foi conferido contra o `manifest.json` real do
> par `09aa87ff…`. Falta apenas executar o transporte contra um host real.

> feito parcial: 2026-08-30 — `unigma-remote-ssh` passou a registrar a autoridade
> `ssh-remote`, validar aliases/targets sem segredo, testar disponibilidade do
> OpenSSH apenas com `ssh -V` e aplicar gates fail-closed antes de qualquer
> conexão. O transporte, o `unigma-server`, a host key e a matriz real continuam
> bloqueados: este ambiente não possui servidor nem host keys configuradas.

### T-050 — criar/adaptar autoridade remota OpenSSH

> feito parcial: 2026-09-01 — `bootstrapManifest` valida em memória o contrato
> estrito v1 do par `unigma-server` + `unigma+opencode`, incluindo hashes,
> tamanhos, commit/target e caminhos seguros. Ainda não há gerador de artefato,
> conexão, cópia, escrita ou ativação remota.

> extensão: 2026-09-01 — `build/unigma/make-payload.ts` monta localmente o
> par a partir de dois binários explícitos, copia a licença OpenCode somente se
> ela for fornecida e gera `manifest.json` com SHA-256. A fonte auditada é
> OpenCode `1.18.23`/MIT no commit `c2eacd72…`; build do checkout, notices e
> qualquer distribuição continuam pendentes.

> feito: 2026-09-02 — o artefato `unigma-server` Linux x64 foi produzido no
> runner WSL (run `33610235193`) e o par v1 foi montado localmente com o OpenCode
> `1.18.23`; `validateBootstrapManifest` aceitou o `manifest.json` real. Duas
> correções de build tornaram isso possível: o servidor passou a ser empacotado
> por esbuild, como o alvo desktop já fazia, em vez da trilha `gulp-tsb` com
> mangling (44 s contra mais de 40 min sem terminar), e `remote/LICENSE` passou a
> existir para que o pacote do servidor carregue a licença. Transporte OpenSSH,
> staging, ativação remota e VPS continuam pendentes.

> extensão: 2026-09-02 — o payload v1 passou a transportar o servidor como
> `server/unigma-server.tar.gz` completo, não um wrapper isolado, e
> `.github/workflows/unigma-server-linux-artifact.yml` empacota esse arquivo no
> runner WSL. O artefato ainda **não** foi produzido: os runs expuseram e
> corrigiram quatro defeitos reais (empacotamento Copilot exigido sem
> `builtInExtensions`, uso da task `-ci` sem compile prévio, membros `protected`
> promovidos a públicos em `ChangesetReviewActionViewItem` e três erros de tipo
> em `unigmaAgent`) e um problema de ambiente (`/tmp` do WSL é tmpfs e consumia
> ~5,5 GB de RAM, deixando ~5,3 GB disponíveis). Transporte, staging, ativação e
> VPS continuam pendentes.

- **objetivo:** integrar `unigma-remote-ssh` ao modelo de autoridade remota do
  Code - OSS usando OpenSSH existente.
- **responsável lógico:** engenharia remota.
- **dependências:** T-002, T-003, T-013 e a etapa A de
  [`planos/2026-08-29-cli-ssh-remoto.md`](planos/2026-08-29-cli-ssh-remoto.md),
  que deixa o CLI sem o Agent Host e com o Code Server intacto.
- **arquivos/módulos prováveis:** `extensions/unigma-remote-ssh/src/`, manifesto,
  adaptadores OpenSSH e testes; do lado do servidor, `cli/src/tunnels/code_server.rs`
  e o entry point `command-shell`, preservados por `D-027`.
- **servidor remoto:** `unigma-server` construído deste fork (`D-028`), acoplado
  por commit ao cliente; `D-032` exige push SSH confirmado do par
  `unigma-server` + `unigma+opencode`, com manifesto/hashes e ativação atômica.
- **critérios de aceite:** usa `known_hosts` e agente/chaves do usuário; não
  solicita nem persiste segredos; host remoto possui extension host compatível;
  falhas são observáveis.
- **testes necessários:** conexão, host rejeitado, autenticação externa,
  timeout, desconexão e cleanup.
- **riscos:** provisionamento inseguro ou divergência do Code - OSS;
  mitigação: seguir autoridade upstream e matriz T-013.
- **paralelo:** pode rodar em paralelo com E-02/E-03 após T-013 e T-002.
- **bloqueia:** T-051 e testes remotos.

### T-051 — iniciar runtime no host remoto

- **objetivo:** fazer o extension host remoto executar/reutilizar `opencode serve`
  no workspace remoto, sem copiar projeto ou iniciar processo local indevido.
- **responsável lógico:** engenharia remota + runtime.
- **dependências:** T-050, T-021, T-022 e T-023.
- **arquivos/módulos prováveis:** `unigma-remote-ssh/`, runtime, resolução de
  host/paths e ciclo de vida remoto.
- **critérios de aceite:** OpenCode roda no destino, dentro do extension host
  remoto hospedado pelo `unigma-server` — não em substituição a ele; caminhos/Git/
  worktrees são remotos; loopback é do host remoto e nunca é exposto ao desktop;
  encerramento limpa apenas processo criado.
- **testes necessários:** sessão remota, Git remoto, dois workspaces, perda SSH,
  reconexão e processo remoto órfão.
- **riscos:** confundir loopback local/remoto ou vazar workspace; mitigação:
  testes de caminho e processo por host.
- **paralelo:** pode rodar em paralelo com T-031/T-032, mas precisa T-050.
- **bloqueia:** T-052 e AC-007.

### T-052 — integrar fluxo de agente remoto

- **objetivo:** conectar UI nativa e runtime remoto preservando o mesmo contrato
  de sessão, diff, aprovação e erro.
- **responsável lógico:** runtime + workbench + remoto.
- **dependências:** T-051, T-024, T-032 e T-033.
- **arquivos/módulos prováveis:** RPC, resolução de autoridade remota,
  `unigmaAgent/browser/` e testes de integração SSH.
- **critérios de aceite:** agente opera no host do workspace; diff/terminal/Git
  referem-se ao destino correto; aprovação continua explícita; erro SSH é
  distinguível de erro OpenCode.
- **testes necessários:** matriz definida em T-013, sessão/diff/aprovação remota,
  desconexão e reconexão.
- **riscos:** mistura de estado local/remoto; mitigação: contexto de autoridade
  em cada sessão e teste de isolamento.
- **paralelo:** pode rodar em paralelo com T-041/T-042 após T-051.
- **bloqueia:** AC-007 e smoke remoto.

### T-053 — fechar testes de compatibilidade SSH

- **objetivo:** executar a matriz remota suportada e registrar recusas fora dela.
- **responsável lógico:** QA remoto.
- **dependências:** T-013, T-051 e T-052.
- **arquivos/módulos prováveis:** `extensions/unigma-remote-ssh/test/`, fixtures
  de host e `docs/ACCEPTANCE.md`.
- **critérios de aceite:** cada combinação suportada tem evidência; combinações
  incompatíveis falham de modo acionável; nenhum segredo aparece em logs.
- **testes necessários:** integração SSH em hosts Windows/Linux conforme matriz.
- **riscos:** ambiente de teste não reproduzir usuários reais; mitigação:
  registrar pré-condições e não declarar suporte além da matriz.
- **paralelo:** pode rodar em paralelo com T-081 após T-052.
- **bloqueia:** AC-013 se o smoke incluir remoto e gate MVP remoto.

## E-06 — segurança e performance

### T-060 — aplicar trust e gates de aprovação

- **objetivo:** centralizar exigência de workspace confiável, política OpenCode e
  aprovação explícita antes de efeitos locais/remotos.
- **responsável lógico:** segurança de produto + runtime/workbench.
- **dependências:** T-010, T-012, T-013, T-020 e T-030.
- **arquivos/módulos prováveis:** guardas de `application/`, comandos nativos,
  configuração de trust e testes de permissão.
- **critérios de aceite:** workspace não confiável não executa agente/MCP/plugin/
  terminal remoto; ação não é autoaprovada; recusa é visível e auditável sem
  segredo; política do OpenCode permanece autoridade.
- **testes necessários:** cada efeito bloqueado/desbloqueado, RPC inválido,
  aprovação duplicada e mudança de trust durante sessão.
- **riscos:** bypass por caminho alternativo; mitigação: gate único na aplicação,
  não apenas no botão visual.
- **paralelo:** depois de T-020/T-030, pode rodar em paralelo com T-021/T-022.
- **bloqueia:** T-033, T-041, T-042, T-052 e AC-009.

### T-061 — validar fronteiras e redaction

- **objetivo:** validar entradas externas e impedir persistência/log de tokens,
  credenciais, chaves, prompts e conteúdo sensível por padrão.
- **responsável lógico:** segurança de aplicação.
- **dependências:** T-010, T-022, T-023 e T-030.
- **arquivos/módulos prováveis:** schemas RPC/SSE, logs, storage, adaptadores
  OpenSSH/OpenCode e regras de análise.
- **critérios de aceite:** payload inválido é rejeitado antes da aplicação;
  logs são redigidos; filesystem e rede têm fronteiras corretas; revisão não
  encontra interceptação ou bypass.
- **testes necessários:** fuzz/fixtures de payload, inspeção de logs, strings de
  segredo, erro de transporte e tentativa de acesso indevido.
- **riscos:** redaction incompleta ou validação apenas superficial; mitigação:
  allowlist de campos e testes negativos.
- **paralelo:** pode rodar em paralelo com T-060 e T-070 após runtime inicial.
- **bloqueia:** T-062, T-081 e AC-009.

### T-070 — criar instrumentação de baseline

- **objetivo:** medir startup, RSS por processo e CPU nos perfis limpo, idle,
  streaming e SSH, por plataforma.
- **responsável lógico:** performance/QA.
- **dependências:** T-003 para harness; T-002 para artefato executável.
- **arquivos/módulos prováveis:** `test/performance/`, `build/`, documentação de
  métricas e artefatos de baseline.
- **critérios de aceite:** procedimento reproduzível, amostra e ambiente são
  registrados; processos são identificados; dados não dependem de telemetria.
- **testes necessários:** repetição local e execução Windows/Linux x64 quando o
  ambiente estiver disponível.
- **riscos:** comparar máquinas ou perfis diferentes; mitigação: baseline por
  plataforma e perfil fixo.
- **paralelo:** após T-003, pode rodar em paralelo com E-01, E-02 e E-03.
- **bloqueia:** T-071, T-072, T-073 e AC-015.

### T-071 — publicar baseline inicial

- **objetivo:** executar o harness e versionar baseline do Code - OSS + unigma
  mínimo antes de otimizações.
- **responsável lógico:** performance/QA.
- **dependências:** T-070 e artefato de T-002; T-003.
- **arquivos/módulos prováveis:** `docs/`, `test/performance/baselines/`, CI.
- **critérios de aceite:** baseline contém startup/RSS/CPU por cenário e
  plataforma; limitações e margem de variação estão documentadas; não há meta
  numérica inventada para hardware não medido.
- **testes necessários:** repetição estatística mínima e revisão de outliers.
- **riscos:** baseline contaminado por ambiente; mitigação: perfil limpo,
  metodologia e descarte justificado.
- **paralelo:** após T-070, pode rodar em paralelo com T-061 e T-080.
- **bloqueia:** decisão de qualquer patch de performance.

### T-072 — otimizar aplicação e UI com evidência

- **objetivo:** reduzir custo evitável de renderer/estado/processo por ativação
  lazy, virtualização, descarte e reuso, sem alterar segurança.
- **responsável lógico:** performance + workbench/runtime.
- **dependências:** T-031, T-032, T-071 e fluxo integrado T-024.
- **arquivos/módulos prováveis:** `unigmaAgent/browser/`, runtime, listeners,
  buffers e pontos medidos do workbench.
- **critérios de aceite:** cada mudança tem perfil antes/depois; não duplica
  fontes de verdade; responsividade e memória melhoram ou não regressam dentro
  da variação; testes cobrem descarte.
- **testes necessários:** perfis T-070, streaming longo, troca de sessão,
  encerramento e testes funcionais completos.
- **riscos:** otimização prematura ou perda de eventos; mitigação: uma hipótese
  por patch e rollback simples.
- **paralelo:** otimizações independentes podem rodar em paralelo se não editarem
  o mesmo módulo; cada uma precisa de baseline T-071.
- **bloqueia:** T-074 e AC-015.

### T-073 — avaliar patches mínimos sobre Code - OSS

- **objetivo:** aplicar patch no upstream somente se T-071 provar gargalo que a
  aplicação não resolve; manter patch isolado e preparado para upstream.
- **responsável lógico:** mantenedor Code - OSS + performance.
- **dependências:** T-071 e diagnóstico reproduzível; T-072 deve ser descartado
  ou insuficiente para o gargalo.
- **arquivos/módulos prováveis:** ponto mínimo em `src/`, `build/` ou Electron
  empacotado pelo Code - OSS; teste de regressão e documentação.
- **critérios de aceite:** causa, ganho e custo estão medidos; patch é mínimo,
  não desativa sandbox/GPU/segurança, não cria fork do Electron e possui teste;
  correção genérica tem caminho para contribuição upstream.
- **testes necessários:** perfil antes/depois, regressão do fluxo afetado,
  build Windows/Linux e revisão de segurança.
- **riscos:** dívida de rebase, regressão ou falsa economia de memória;
  mitigação: não aplicar sem evidência e manter rollback.
- **paralelo:** pode rodar em paralelo com T-072 somente em ponto/módulo distinto;
  caso contrário precisa aguardar T-072.
- **bloqueia:** T-074 e aprovação de performance do MVP.

### T-074 — fechar regressão de performance

- **objetivo:** comparar implementação final ao baseline e estabelecer limites
  versionados por plataforma.
- **responsável lógico:** performance/QA.
- **dependências:** T-072 e, se executada, T-073.
- **arquivos/módulos prováveis:** `test/performance/`, baselines, CI e
  `docs/ACCEPTANCE.md`.
- **critérios de aceite:** perfis limpo/idle/streaming/SSH têm evidência; RSS,
  CPU e startup não regressam sem justificativa aprovada; falhas bloqueiam gate.
- **testes necessários:** suíte de performance repetida em Windows/Linux x64.
- **riscos:** flutuação mascarar regressão; mitigação: margem documentada e
  repetição controlada.
- **paralelo:** pode rodar em paralelo com parte de T-082 após artefato estável.
- **bloqueia:** AC-015 e gate final.

### T-062 — executar revisão e suíte de segurança

- **objetivo:** consolidar testes de trust, fronteiras, segredos, licenças de
  integração e ausência de bypass.
- **responsável lógico:** segurança + QA.
- **dependências:** T-060 e T-061; T-033/T-042 para superfície completa.
- **arquivos/módulos prováveis:** testes de runtime/workbench/SSH, revisão de
  configuração e `docs/ACCEPTANCE.md`.
- **critérios de aceite:** AC-009 passa com evidência reproduzível; nenhum
  segredo aparece em logs/artefatos; ações não autorizadas são recusadas.
- **testes necessários:** suíte negativa local/remota, revisão de dependências e
  inspeção de artefatos.
- **riscos:** cobertura falsa por testar somente caminho feliz; mitigação:
  matriz de recusas e revisão independente.
- **paralelo:** pode rodar com T-074 após integração mínima.
- **bloqueia:** T-081, T-083 e gate final.

## E-07 — qualidade e distribuição

### T-080 — completar testes unitários e de contrato

- **objetivo:** cobrir domínio, RPC, validação, mapeamento de eventos, Git e
  adaptador HTTP/SSE com o harness do Code - OSS.
- **responsável lógico:** QA de engenharia.
- **dependências:** módulos de T-020/T-022/T-030 e contratos T-010/T-011.
- **arquivos/módulos prováveis:** `extensions/*/test/`, `src/.../unigmaAgent/`
  e fixtures.
- **critérios de aceite:** testes determinísticos cobrem sucesso, erro,
  reconexão, payload inválido, permissão e descarte; nenhum segundo runner.
- **testes necessários:** unitários e contrato documentados no harness verificado.
- **riscos:** fixture divergir do OpenCode real; mitigação: contrato explícito e
  integração controlada posterior.
- **paralelo:** pode rodar em paralelo com T-071, T-031 e T-050 após contratos.
- **bloqueia:** T-081 e CI final.

### T-081 — integração local e aceitação funcional

- **objetivo:** provar sessão, evento, diff e aprovação com IDE + runtime +
  OpenCode controlado.
- **responsável lógico:** QA de integração.
- **dependências:** T-024, T-032, T-033, T-040, T-041, T-042, T-062 e T-080.
- **arquivos/módulos prováveis:** fixtures OpenCode, testes de integração,
  `docs/ACCEPTANCE.md`.
- **critérios de aceite:** AC-003 a AC-006 e AC-009 passam com evidência; nenhum
  processo extra por sessão; falhas e aprovações são observáveis.
- **testes necessários:** fluxo feliz e recusas de sessão/diff/worktree/provider.
- **riscos:** integração esconder defeitos unitários; mitigação: manter camadas
  anteriores obrigatórias.
- **paralelo:** pode rodar em paralelo com T-053 e T-074 se o artefato estiver
  estável; precisa aguardar os itens listados.
- **bloqueia:** T-083 e gate MVP.

### T-082 — configurar CI sem infraestrutura de aplicação

- **objetivo:** automatizar harness, lint/typecheck/build/testes e matriz Windows/
  Linux no CI aprovado, sem backend ou runner adicional.
- **responsável lógico:** build/CI.
- **dependências:** T-003, T-080 e comandos reais do upstream; T-062 para job
  de segurança quando disponível.
- **arquivos/módulos prováveis:** `.github/workflows/`, `build/`, `package.json`.
- **critérios de aceite:** jobs reproduzem comandos verificados; falha bloqueia
  merge/artefato; segredos não são necessários para testes locais; plataformas
  x64 estão identificadas.
- **testes necessários:** execução de workflow em cada plataforma e artefato de
  logs sem conteúdo sensível.
- **riscos:** CI divergir do ambiente local ou exigir serviço cloud do produto;
  mitigação: usar apenas automação de build/teste.
- **paralelo:** pode rodar com T-081/T-074 quando scripts e testes existirem.
- **bloqueia:** T-083.

### T-083 — empacotar e executar smoke Windows/Linux

- **objetivo:** gerar artefatos MVP x64 e validar inicialização mínima em ambas
  as plataformas.
- **responsável lógico:** build/release + QA multiplataforma.
- **dependências:** T-002, T-003, T-081, T-082 e T-062.
- **arquivos/módulos prováveis:** `build/`, `resources/unigma/`, scripts de
  empacotamento e artefatos fora do repositório.
- **critérios de aceite:** artefatos reproduzíveis iniciam; identidade/notices
  estão presentes; OpenCode e SSH falham de modo acionável quando ausentes;
  AC-013 tem evidência em Windows x64 e Linux x64.
- **testes necessários:** smoke de inicialização, workspace confiável/não
  confiável, runtime ausente e verificação de arquitetura x64.
- **riscos:** empacotar binário/ativo não autorizado ou diferença de plataforma;
  mitigação: inventário T-004 e smoke separado por sistema.
- **paralelo:** precisa aguardar T-081/T-082; depois pode rodar em paralelo com
  T-074 e T-084.
- **bloqueia:** T-085 e qualquer release.

### T-084 — auditoria legal e de identidade pré-release

- **objetivo:** revisar licenças, notices, marca, endpoints, binários e uso de
  marketplaces antes de qualquer publicação.
- **responsável lógico:** revisão legal + mantenedor de distribuição.
- **dependências:** T-004 e T-083.
- **arquivos/módulos prováveis:** artefatos, `resources/unigma/`, notices,
  `product.json`, inventário de dependências e `docs/DECISIONS.md`.
- **critérios de aceite:** AC-001, AC-002 e AC-012 têm evidência; pendências de
  domínio, certificado e reserva não são tratadas como autorização.
- **testes necessários:** inspeção de artefatos e checklist de licença/identidade.
- **riscos:** publicação de marca colidente ou notice ausente; mitigação: gate
  bloqueante e autorização específica.
- **paralelo:** pode rodar em paralelo com T-074 após T-083.
- **bloqueia:** T-085 e publicação.

### T-085 — gate de aceitação do MVP

- **objetivo:** consolidar evidências de AC-001 a AC-029 e declarar o que passou,
  falhou ou permanece fora da entrega, incluindo E-08 e E-09 quando fizerem
  parte da entrega integrada.
- **responsável lógico:** release manager + QA principal.
- **dependências:** T-034, T-041, T-042, T-053, T-062, T-074, T-081, T-083,
  T-084, T-094 e T-099.
- **arquivos/módulos prováveis:** `docs/ACCEPTANCE.md`, relatório de evidências,
  artefatos e changelog futuro.
- **critérios de aceite:** AC-001 a AC-029 têm evidência reproduzível quando
  fizerem parte do escopo da entrega; falha ou lacuna bloqueia a declaração de
  pronto; relatório referencia commit, plataforma, comando, artefato, patchset e
  versão do bundle. Direção documental de E-08/E-09 não é evidência de
  implementação.
- **testes necessários:** suíte completa unitária, contrato, integração, SSH,
  segurança, performance, visual, Autopilot/roteador e smoke multiplataforma.
- **riscos:** aceitar por documentação sem execução ou esconder suporte parcial;
  mitigação: regra de evidência do `ACCEPTANCE.md`.
- **paralelo:** não deve iniciar antes das dependências; revisão do relatório
  pode ser distribuída por AC após os testes.
- **bloqueia:** declaração de MVP, release e publicação.

## E-08 — Intelligence Index/Autopilot

**status:** frente futura; a direção está documentada em RQ-015 a RQ-021, D-016 e
F-005, mas nenhuma tarefa abaixo foi implementada, integrada ou aceita. Os
exemplos numéricos da direção, inclusive `~49`, não são valores normativos.

### T-086 — definir contrato e configuração do router

- **objetivo:** transformar a direção do router em contrato privado TypeScript e
  schema local versionado, cobrindo `autopilotEnabled`, `selectedModel`,
  `persistSelectedModel`, `routerModel`, `maxModel`, referências de índice/custo,
  bypass, timeout, fallback e política de privacidade sem duplicar credenciais do
  OpenCode.
- **responsável lógico:** arquitetura de runtime/workbench + segurança.
- **dependências:** T-010, T-011 e T-012; T-060 e T-061 são gates da implementação
  real de trust, validação e redaction.
- **arquivos/módulos prováveis:** `extensions/unigma-agent-runtime/src/domain/router/`,
  `extensions/unigma-agent-runtime/src/application/router/`,
  `src/vs/workbench/contrib/unigmaAgent/common/`, schema de settings e testes de
  contrato.
- **critérios de aceite:** **direção documental:** o contrato descreve versões,
  campos, estados, erros, fontes permitidas e a diferença entre bypass, seleção
  persistida e roteamento; não declara suporte funcional. **implementação real:**
  o runtime valida versão, campos e combinações antes de decidir, rejeita
  configuração inválida, atravessa trust/política do OpenCode e não registra
  prompt, raciocínio ou segredo.
- **testes necessários:** unidade do schema, versões incompatíveis, campos
  desconhecidos, combinações inválidas de `autopilotEnabled`/
  `persistSelectedModel`, fronteira RPC e inspeção de logs redigidos.
- **riscos:** contrato acoplado ao provider, configuração permissiva ou segredo
  duplicado; mitigação: tipos internos, allowlist de campos e credenciais mantidas
  no OpenCode.
- **paralelo:** depois dos contratos de E-01, pode avançar em paralelo com T-070,
  T-080 e o trabalho de UI que não dependa dos eventos finais.
- **bloqueia:** T-087, T-088, AC-016 e toda implementação de E-08.

### T-087 — versionar índice de inteligência e custo sem ranking universal

- **objetivo:** definir fonte local explícita, versão, proveniência, unidade de
  custo, evidência de pesquisa e tratamento de atualização, ausência ou
  ambiguidade para o `intelligence index`, sem criar catálogo remoto, cache
  distribuído ou ranking universal; `~49` permanece somente ilustrativo.
- **responsável lógico:** produto/avaliação de modelos + segurança de dados.
- **dependências:** T-086 para referências e schema; T-011 para a matriz de
  modelos autorizados e T-012 para fontes locais explícitas.
- **arquivos/módulos prováveis:** `extensions/unigma-agent-runtime/src/domain/router/IntelligenceIndex`,
  `extensions/unigma-agent-runtime/src/domain/router/ModelCost`, settings de
  referências versionadas e fixtures de índice/custo.
- **critérios de aceite:** **direção documental:** a especificação separa índice
  aproximado, custo e elegibilidade, registra fonte/versão/revisão, não chama o
  índice de verdade universal e não fixa nenhum valor numérico. **implementação
  real:** somente referências locais explícitas e compatíveis são carregadas;
  referência ausente, vencida ou ambígua é recusada de modo observável, sem
  inventar ranking, sincronizar catálogo ou registrar prompt, raciocínio ou
  segredo.
- **testes necessários:** fixtures de versões válidas/incompatíveis, fonte
  ausente, custo sem unidade, custo ambíguo, índice fora da fonte e verificação de
  que nenhum catálogo remoto ou ranking global é criado.
- **riscos:** falsa precisão, custo desatualizado ou autoridade indevida da
  classificação; mitigação: proveniência, versão explícita, revisão e falha
  fechada para dados insuficientes.
- **paralelo:** após T-086, pode rodar em paralelo com T-088 sem editar o caller
  da Luna; a integração da seleção aguarda ambas.
- **bloqueia:** T-089, T-090, T-092, T-093 e AC-017.

### T-088 — integrar chamada curta `Luna medium`

- **objetivo:** implementar, quando `routerModel` estiver configurado e disponível
  no OpenCode, uma chamada `Luna medium` sem contexto adicional de sessão,
  workspace ou histórico, sem pensamento longo e com schema de saída curto e
  estruturado.
- **responsável lógico:** integração OpenCode/runtime + segurança de aplicação.
- **dependências:** T-086, T-011, T-022, T-024 e T-061.
- **arquivos/módulos prováveis:** caller do router em
  `extensions/unigma-agent-runtime/src/application/router/`, adaptador
  `infrastructure/opencode/`, schemas de request/response e fixtures HTTP/SSE.
- **critérios de aceite:** **direção documental:** o contrato lista somente a
  configuração autorizada, o payload mínimo, a ausência de contexto/pensamento
  longo e o schema curto, sem endpoint ou credencial oculta. **implementação
  real:** fixture/integração controlada comprova que apenas campos permitidos são
  enviados e que a saída é validada; indisponibilidade é observável e nenhum
  prompt, raciocínio ou segredo aparece em logs ou persistência.
- **testes necessários:** unidade do payload mínimo e schema curto, contrato com
  fixture OpenCode, resposta extra ou inválida, modelo indisponível e integração
  sem contexto de sessão/workspace/histórico.
- **riscos:** vazamento acidental de contexto, drift do schema ou chamada a
  endpoint não autorizado; mitigação: allowlist, adaptador único, timeout e
  fixture negativa.
- **paralelo:** após T-086, pode rodar em paralelo com T-087; a implementação
  real precisa aguardar T-022, T-024 e T-061.
- **bloqueia:** T-089, T-090, T-092, T-093 e AC-018.

### T-089 — selecionar o modelo elegível de menor custo

- **objetivo:** implementar a decisão que estima o índice necessário, filtra
  modelos configurados e autorizados, aplica o teto explícito de `maxModel` e
  escolhe o candidato elegível de menor custo conforme a mesma versão/unidade;
  `maxModel` não vira ranking universal nem valor fixo.
- **responsável lógico:** engenharia de domínio/runtime + avaliação de modelos.
- **dependências:** T-086, T-087, T-088, T-060 e T-061.
- **arquivos/módulos prováveis:** `extensions/unigma-agent-runtime/src/domain/router/ModelSelector`,
  casos de uso de decisão, tipos de elegibilidade e testes de tabela/propriedade.
- **critérios de aceite:** **direção documental:** comparador, desempate,
  elegibilidade, custos ausentes e semântica de `maxModel` ficam versionados e
  explícitos; `~49` ou outro exemplo não é transformado em limite. **implementação
  real:** testes demonstram seleção do menor custo que atinge o índice e respeita
  `maxModel`, somente entre modelos autorizados; sem candidato ou dado confiável,
  a decisão não escala silenciosamente, não cria ranking universal e não registra
  prompt, raciocínio ou segredo.
- **testes necessários:** unidade para limiar de índice, teto `maxModel`, empate,
  custo ausente/ambíguo, modelo não autorizado e seleção determinística; contrato
  e integração com a saída curta do router.
- **riscos:** escolher modelo incapaz, comparar custos incompatíveis ou tratar
  índice como verdade objetiva; mitigação: versão/unidade obrigatórias,
  allowlist e fallback seguro.
- **paralelo:** após T-087 e T-088, pode rodar em paralelo com a preparação dos
  estados de UI; a política de fallback final aguarda esta decisão.
- **bloqueia:** T-090, T-092, T-093 e AC-019.

### T-090 — implementar bypass, fallback, timeout e privacidade

- **objetivo:** fechar o ciclo de segurança do router: Autopilot desligado e
  `persistSelectedModel` devem bypassar a chamada; erro, indisponibilidade,
  privacidade restritiva, ausência de candidato ou timeout devem retornar com
  segurança ao `selectedModel` validado, sem autoescalada nem tentativa ilimitada.
- **responsável lógico:** segurança de produto + runtime/workbench.
- **dependências:** T-086, T-088, T-089, T-024, T-060 e T-061.
- **arquivos/módulos prováveis:** caso de uso de roteamento/fallback em
  `extensions/unigma-agent-runtime/src/application/router/`, política de timeout,
  eventos RPC e testes de redaction/privacidade.
- **critérios de aceite:** **direção documental:** a matriz define bypass,
  fallback, timeout configurável, divulgação da chamada adicional, custo e
  implicação de privacidade, sem contornar trust, aprovação, política do OpenCode
  ou entitlement. **implementação real:** cada falha usa o modelo selecionado ou
  produz erro bloqueante visível quando ele não é válido; timeout é limitado,
  fallback é observável e nenhum prompt, raciocínio ou segredo é logado ou
  persistido.
- **testes necessários:** unidade da matriz de estados, relógio/fake timeout,
  router indisponível, custo/indexo inválido, restrição de privacidade, modelo
  selecionado ausente, retry único ou inexistente e inspeção de logs.
- **riscos:** duplicar prompt, ocultar custo, prender a sessão ou contornar uma
  política de autorização; mitigação: fallback único para seleção validada,
  orçamento/timeout explícito e gate na aplicação.
- **paralelo:** depois de T-089, pode avançar com testes unitários de T-092 se as
  interfaces estiverem estáveis; integração visual aguarda seus eventos.
- **bloqueia:** T-091, T-092, T-093 e AC-020.

### T-091 — implementar UI nativa acessível do Autopilot

- **objetivo:** entregar o toggle `Autopilot!` na contribuição nativa do
  workbench, opt-in, operável por teclado e tecnologias assistivas, com estados
  desligado, pronto, roteando, selecionado, bypass, fallback, timeout/erro e
  bloqueado por privacidade, respeitando `prefers-reduced-motion`.
- **responsável lógico:** UI nativa/workbench + acessibilidade/localização.
- **dependências:** T-030, T-031, T-032, T-034, T-086 e T-090.
- **arquivos/módulos prováveis:** `src/vs/workbench/contrib/unigmaAgent/browser/autopilot/`,
  `common/` para eventos, comandos, nls, tokens de tema e testes de workbench.
- **critérios de aceite:** **direção documental:** estados, rótulos, foco,
  teclado, nome acessível, contraste, aparência mais escura desligada, cor
  principal ligada e movimento reduzido são especificados sem declarar UI pronta.
  **implementação real:** a UI nativa renderiza todos os estados e mensagens
  acionáveis sem Webview ou acesso direto a rede/processo; o teste demonstra
  `prefers-reduced-motion` sem animação excessiva e inclui evidência renderizada
  do build/teste real quando a UI existir.
- **testes necessários:** redução de estado, comando de teclado, foco/ARIA,
  contraste/localização, estados de erro/fallback, preferência de movimento
  reduzido e captura/snapshot ou passo de reprodução da UI renderizada.
- **riscos:** toggle ambíguo, movimento inacessível, estado visual mentiroso ou
  vazamento de diagnóstico sensível; mitigação: componentes nativos, estados do
  runtime e revisão com preferência de movimento reduzido.
- **paralelo:** a casca visual pode ser preparada após T-030/T-034 em paralelo
  com T-087/T-089; integração dos estados aguarda T-090 e não deve compartilhar
  fixtures de UI com T-081 sem coordenação.
- **bloqueia:** T-093, T-094 e AC-021.

### T-092 — executar testes unitários e de contrato do router

- **objetivo:** cobrir com o harness existente as decisões de configuração,
  índice/custo, chamada curta Luna, seleção, bypass, fallback, timeout e
  privacidade, separando falhas de unidade das de contrato OpenCode.
- **responsável lógico:** QA de engenharia + runtime.
- **dependências:** T-086, T-087, T-088, T-089 e T-090.
- **arquivos/módulos prováveis:** `extensions/unigma-agent-runtime/test/router/`,
  fixtures de contrato OpenCode, testes de schema e inspeção do canal de saída
  `Unigma`.
- **critérios de aceite:** **direção documental:** a matriz de testes identifica
  sucesso, recusas, dados ausentes, timeout, fallback e redaction e continua
  marcada como plano até executar. **implementação real:** o harness aprovado
  executa testes determinísticos unitários e de contrato, sem segundo runner,
  cobrindo payload inválido, versão incompatível, seleção e fallback; asserções
  negativas provam ausência de log de prompt, raciocínio e segredo.
- **testes necessários:** suíte unitária, fixtures HTTP/SSE controladas, casos
  negativos de schema/versão/custo/modelo e varredura de logs/artefatos sem dados
  sensíveis.
- **riscos:** fixture feliz demais ou teste que só procura strings conhecidas;
  mitigação: matriz negativa, dados sintéticos e revisão do contrato contra a
  interface documentada.
- **paralelo:** após T-090, pode rodar em paralelo com T-091; não declarar
  integração nem aceite visual com esta tarefa isolada.
- **bloqueia:** T-093, T-094 e AC-022.

### T-093 — validar integração e métricas de custo

- **objetivo:** provar o fluxo local controlado do Autopilot com IDE/runtime/
  OpenCode, incluindo bypass, seleção, fallback e timeout, e medir custo/latência
  da chamada adicional e do modelo escolhido sem telemetria, upload ou log de
  prompt.
- **responsável lógico:** QA de integração + performance de runtime.
- **dependências:** T-024, T-090, T-091 e T-092.
- **arquivos/módulos prováveis:** fixtures OpenCode, testes de integração em
  `extensions/unigma-agent-runtime/test/integration/`, testes do workbench,
  `test/performance/` e relatório local de métricas versionado.
- **critérios de aceite:** **direção documental:** método, unidade, versão de
  índice/custo, amostra, latência, timeout e distinção entre custo do router e do
  modelo final são definidos sem prometer cobrança real ou telemetria. **implementação
  real:** fixture/IDE demonstra os caminhos de bypass, roteamento, fallback e
  timeout, registra somente métricas e referências permitidas, e fornece
  evidência renderizada quando a UI existir; nenhum prompt, raciocínio, segredo ou
  conteúdo de workspace aparece nos logs/artefatos.
- **testes necessários:** integração local com OpenCode controlado, repetição de
  cenários com e sem Autopilot, custo ausente/ambíguo, timeout, privacidade,
  inspeção de logs, CPU/RSS quando aplicável e captura da UI renderizada.
- **riscos:** confundir estimativa local com fatura do provider, métrica
  não-reproduzível ou fixture sensível; mitigação: unidade declarada, dados
  sintéticos, versão do índice/custo e nenhuma telemetria.
- **paralelo:** depois de T-091/T-092, pode rodar em paralelo com T-081/T-074
  somente em fixtures e módulos distintos; se houver compartilhamento, precisa
  aguardar a outra suíte.
- **bloqueia:** T-094, T-085 e AC-023.

### T-094 — executar revisão final da frente

- **objetivo:** revisar contrato, configuração, índice, chamada Luna, seleção,
  fallback, privacidade, UI, testes e métricas contra RQ-015 a RQ-021, declarando
  separadamente direção documental, implementação real, lacunas e suporte não
  testado.
- **responsável lógico:** revisão independente de segurança/produto + QA
  principal.
- **dependências:** T-062, T-091, T-092 e T-093.
- **arquivos/módulos prováveis:** código e testes de router, contribuição
  `unigmaAgent`, configurações, artefatos de teste, `docs/ACCEPTANCE.md` e
  relatório de evidências.
- **critérios de aceite:** **direção documental:** checklist e matriz de
  rastreabilidade ficam registrados sem alterar status para concluído. **implementação
  real:** revisão de código, configuração, logs, testes e artefatos confirma
  fallback seguro, ausência de bypass, nenhum log de prompt/raciocínio/segredo,
  custos e privacidade explícitos e evidência renderizada real quando houver UI;
  qualquer lacuna mantém AC-016 a AC-024 bloqueados.
- **testes necessários:** revisão independente da matriz negativa, suíte final de
  segurança, unitária/contrato/integração, inspeção de artefatos e validação das
  capturas/renderizações de UI.
- **riscos:** aceitar documentação como prova, omitir um caminho de falha ou
  anunciar suporte de provider/modelo não testado; mitigação: gate bloqueante,
  evidência por critério e declaração explícita de lacunas.
- **paralelo:** não deve iniciar antes de T-091/T-092/T-093 e T-062; a revisão de
  evidências pode ser distribuída por critério depois que os testes terminarem.
- **bloqueia:** T-085, AC-024 e declaração de suporte do E-08.

## E-09 — perfil OpenCode service-only e bundle

**status:** direção confirmada em 2026-08-26 e refinada em 2026-08-27; `opencode
serve` já é headless, mas o perfil bundled, o decepador e a atualização atômica
ainda não foram implementados ou aceitos. Não fazer poda ampla sem auditoria de
superfícies alcançáveis/empacotadas. Ver
[`OPENCODE-SERVICE-ONLY.md`](OPENCODE-SERVICE-ONLY.md).

### T-095 — inventariar superfícies e fixar a fronteira service-only

- **objetivo:** mapear no upstream OpenCode o harness que deve permanecer e as
  superfícies TUI/onboarding/interativas que serão removidas ou redirecionadas.
- **estado factual em 2026-08-26:** além do inventário CLI de
  `/usr/bin/opencode` `1.18.23`, o checkout upstream
  `/home/dasher/projects/unigma/opencode` foi analisado em `dev`, HEAD
  `c2eacd72afc4a4984564c393e15ab30011057269`, com árvore limpa. O mapa de
  módulos, donos e decisões está em
  [`OPENCODE-SERVICE-ONLY.md`](OPENCODE-SERVICE-ONLY.md). T-095 está concluída
  no recorte estático pré-patch; o probe continua sendo do binário instalado,
  não de um executável construído a partir desse commit. T-096 tem um rascunho
  local não commitado no worktree candidato. O candidato passou typecheck,
  build Linux service-only, smoke, dois testes in-process, probe loopback e
  reaplicação em uma segunda árvore limpa; também passou os testes focados de
  sessão/evento/diff/autorização e os modos `coverage`/`auth` do exercício HTTP.
  O modo `effect` excedeu o timeout de 900 segundos. Segue sem patchset
  versionado no unigma, manifesto, pipeline, validação Windows ou artefato
  aceito.
- **responsável lógico:** mantenedor OpenCode + arquitetura de produto.
- **dependências:** T-001, T-003 e T-011.
- **arquivos/módulos prováveis:** checkout upstream OpenCode, matriz de
  compatibilidade e `docs/OPENCODE-SERVICE-ONLY.md`.
- **critérios de aceite:** cada superfície tem decisão e evidência; sessões,
  tool loop, permissões, compaction, limites, retries, plugins, MCP, skills,
  streaming e subagentes têm dono explícito; nenhum código é removido por
  varredura cega.
- **testes necessários:** inventário repetível contra o commit fixado e probe
  headless antes do patch.
- **riscos:** confundir UI com harness ou assumir comportamento do SDK `dev`;
  mitigação: `/doc`, commit e matriz versionados.
- **paralelo:** pode rodar com T-043/T-044 depois que o contrato for registrado.
- **bloqueia:** T-096 e AC-025/AC-026.

### T-096 — aplicar patchset reproduzível do decepador

- **objetivo:** produzir o perfil `service-only` a partir do upstream, com patch
  pequeno, identificado, reaplicável e separado do código do unigma.
- **responsável lógico:** mantenedor OpenCode/build.
- **dependências:** T-095, T-003 e T-011.
- **arquivos/módulos prováveis:** checkout/patches do OpenCode, `build/` e
  documentação de proveniência.
- **critérios de aceite:** o patch remove/redireciona apenas as superfícies
  decididas; mantém o harness e o contrato HTTP/SSE; não altera instalação,
  credencial ou dados do usuário; falha de aplicação interrompe o pipeline.
- **testes necessários:** aplicação em checkout limpo, rebuild, health, `/doc`,
  sessão, evento, permissão e ausência das entradas interativas previstas.
- **riscos:** fork permanente ou regressão silenciosa do harness; mitigação:
  patchset mínimo, revisão e teste contra upstream fixado.
- **paralelo:** não pode compartilhar a mesma árvore de patch com outro trabalho.
- **bloqueia:** T-097 e AC-025/AC-026.

### T-097 — gerar bundle versionado com manifesto

- **objetivo:** empacotar `unigma+opencode` por plataforma e registrar
  proveniência, hashes, versão, patchset e resultados do pipeline.
- **responsável lógico:** build/release + integração OpenCode.
- **dependências:** T-096, T-003, T-062 e T-083.
- **arquivos/módulos prováveis:** `build/`, workflows, manifesto de artefato e
  `docs/OPENCODE-COMPATIBILITY.md`.
- **critérios de aceite:** o artefato é determinístico dentro da matriz de
  plataforma; binários não entram no repositório; auditoria preserva licenças e
  notices; configuração/credenciais/sessões ficam fora do bundle.
- **testes necessários:** build Windows/Linux x64, hash, layout, probe do
  executável bundled e inspeção de separação de dados.
- **riscos:** empacotar dados do usuário ou anunciar o probe errado como release;
  mitigação: manifesto e auditoria bloqueantes.
- **paralelo:** builds de plataformas diferentes seguem a regra do runner e não
  rodam em paralelo no mesmo host.
- **bloqueia:** T-098, T-099 e AC-026.

### T-098 — implementar troca atômica e rollback do bundle

- **objetivo:** definir e implementar a substituição do bundle somente com o
  processo parado, preservando a versão corrente até a validação do candidato.
- **responsável lógico:** build/release + runtime desktop.
- **dependências:** T-097, T-023 e T-021.
- **arquivos/módulos prováveis:** launcher/empacotamento, diretórios de aplicação
  e testes de atualização; não criar serviço remoto.
- **critérios de aceite:** candidato inválido não substitui a versão corrente;
  troca válida é atômica; rollback restaura o bundle anterior; configuração,
  credenciais, sessões e histórico permanecem intactos.
- **testes necessários:** processo ativo, processo parado, interrupção durante a
  troca, candidato inválido, rollback e reabertura de sessão.
- **riscos:** corrupção do aplicativo ou migração acidental de dados; mitigação:
  staging local, rename atômico e diretórios de dados separados.
- **paralelo:** somente depois de T-097 e sem compartilhar o diretório de bundle.
- **bloqueia:** T-099 e AC-026.

### T-099 — fechar suporte do bundle por evidência

- **objetivo:** validar a combinação upstream + patchset + executável + plataforma
  e separar probe de desenvolvimento, candidato e suporte oficial.
- **responsável lógico:** QA/release + revisão de segurança e produto.
- **dependências:** T-097, T-098, T-011, T-062 e T-083.
- **arquivos/módulos prováveis:** manifesto, artefatos, probes, auditoria e
  `docs/ACCEPTANCE.md`.
- **critérios de aceite:** health, `/doc`, `/path`, SSE, sessão, diff, permissão,
  restart e fluxo `OpenCodeClient` passam no bundle; toda falha bloqueia suporte;
  a matriz publica exatamente versão, hash, alvo e patchset testados.
- **testes necessários:** processo real bundled, incompatibilidade, restart,
  reconexão, logs redigidos e inspeção de artefato em Windows/Linux x64.
- **riscos:** declarar compatibilidade sem testar o bundle ou provider/modelo;
  mitigação: gate por combinação e nenhuma promessa além da evidência.
- **paralelo:** pode revisar AC-025/AC-026 em paralelo com E-08 somente em
  artefatos e fixtures separados.
- **bloqueia:** T-085, AC-025 e AC-026.

# SUBTASKS quando uma tarefa exigir decomposição

As seguintes subtarefas tornam explícitas as partes que podem ser distribuídas
sem criar edições concorrentes artificiais:

## T-010 — contrato RPC

- **ST-010-A:** catalogar comandos, eventos, estados e erros em
  `docs/FLOWS.md` — responsável arquitetura; paralelo com ST-010-B.
- **ST-010-B:** definir tipos, versão e `requestId` em
  `src/vs/workbench/contrib/unigmaAgent/common/` — responsável TypeScript;
  aguarda ST-010-A para não divergir do contrato.
- **ST-010-C:** escrever fixtures de payload válido/inválido — responsável QA;
  pode rodar após ST-010-B e bloqueia T-080.

## T-021/T-022 — runtime

- **ST-022-A:** mapear endpoints e eventos OpenCode aprovados — responsável
  integração; bloqueado por T-011.
- **ST-021-A:** implementar estado do processo/ownership — responsável runtime;
  pode rodar em paralelo com ST-022-B.
- **ST-022-B:** implementar transporte HTTP/SSE e reconexão — responsável
  integração; pode rodar em paralelo com ST-021-A, sem editar os mesmos módulos.
- **ST-022-C:** integrar ambos no `OpenCodeClient` e validar fixture — aguarda
  ST-021-A e ST-022-B; bloqueia T-024.

## T-030/T-034 — workbench

- **ST-030-A:** registrar contribuição, comandos e partes — responsável
  workbench; bloqueia ST-030-B.
- **ST-030-B:** implementar estados vazios/loading/erro — responsável UI; pode
  rodar em paralelo com ST-034-A.
- **ST-034-A:** definir tokens e temas — responsável UX; pode rodar em paralelo
  com ST-030-B.
- **ST-034-B:** localização, foco, teclado e contraste — aguarda ST-030-B e
  ST-034-A; bloqueia AC-010/011.

## T-070/T-073 — performance

- **ST-070-A:** definir procedimento e perfis — responsável performance;
  bloqueia ST-070-B.
- **ST-070-B:** coletar baseline por plataforma — responsável QA/performance;
  pode rodar em paralelo por sistema operacional.
- **ST-073-A:** reproduzir gargalo e atribuir causa — aguarda baseline;
  bloqueia qualquer patch.
- **ST-073-B:** aplicar/testar patch mínimo ou registrar “não aplicar” — aguarda
  ST-073-A; bloqueia T-074 apenas se houver patch.

# GRAFO LÓGICO DE DEPENDÊNCIAS

## caminho crítico

```text
T-001
  -> T-002 -> T-003
           -> T-004
T-010 + T-011 + T-012 + T-013
  -> T-020 -> T-021 + T-022 + T-023 -> T-024
T-010 + T-002 + T-003
  -> T-030 -> T-031 -> T-032
T-012 + T-013 + T-020/T-030 -> T-060/T-061
T-024 + T-032 + T-060 -> T-033
T-024 + T-033 + T-060 -> T-081
T-003 + T-070 -> T-071 -> T-072/T-073 -> T-074
T-080 + T-081 + T-062 + T-082 -> T-083
T-004 + T-083 -> T-084
T-034 + T-041 + T-042 + T-053 + T-074 + T-081 + T-083 + T-084
  -> T-085
T-010 + T-011 + T-012 + T-060/T-061
  -> T-086 -> T-087 + T-088 -> T-089 -> T-090
T-030 + T-034 + T-086 + T-090 -> T-091
T-086/T-087/T-088/T-089/T-090 -> T-092
T-024 + T-091 + T-092 -> T-093 -> T-094
T-094 + T-085 -> gate final da frente E-08/MVP
T-024 + T-030 + T-031 + T-012 -> T-043
T-024 + T-031 + T-032 + T-041 -> T-044
T-010 + T-024 + T-061 -> T-045
T-001 + T-003 + T-011 -> T-095 -> T-096 -> T-097 -> T-098 -> T-099
T-099 + T-085 -> gate final do bundle E-09/MVP
```

## PODE RODAR EM PARALELO

- antes do fork: T-010, T-011, T-012 e T-013 podem ser especificadas em
  paralelo; T-001 é a única dependência comum de compatibilidade;
- depois de T-002/T-003: T-020, T-030, T-050 e T-070 podem seguir em frentes
  distintas, respeitando seus contratos;
- dentro do runtime: T-021, T-022 e T-023 não editam o mesmo módulo e podem
  rodar em paralelo após T-020;
- dentro do workbench: T-031, T-032, T-033 e T-034 podem ser distribuídas por
  área após o esqueleto e o contrato;
- capacidades T-040, T-041 e T-042 podem rodar em paralelo após T-024;
- T-043 e T-044 podem rodar em paralelo após seus contratos e dependências;
- T-045 pode rodar em paralelo com T-043/T-044, sem criar servidor ou listener;
- remoto T-050/T-051 e a trilha local de UI/runtime podem avançar em paralelo;
- T-061, T-070, T-080 e preparação de CI podem avançar assim que suas entradas
  existirem;
- T-053, T-074 e T-084 podem ser executadas em paralelo após o artefato integrado
  correspondente.
- em E-08, T-087 e T-088 podem rodar em paralelo depois de T-086, sem compartilhar
  o caller/schema da outra frente;
- T-091 e T-092 podem rodar em paralelo depois de T-090, desde que UI e fixtures
  não editem os mesmos arquivos; T-093 só começa após ambos;
- T-093 só pode compartilhar fixtures com T-081/T-074 mediante coordenação; caso
  contrário, as suítes permanecem separadas.
- T-095 pode ser especificada em paralelo com E-04 após T-011; T-096/T-097/T-098
  não devem compartilhar a árvore de patch com outra frente.

## PRECISA AGUARDAR

- T-002 precisa aguardar T-001;
- T-020 e T-030 precisam aguardar importação e comandos mínimos de T-002/T-003;
- T-021/T-022 precisam aguardar contratos T-010/T-011;
- T-033 precisa aguardar o gate T-060, não apenas a existência visual do botão;
- T-051 precisa aguardar T-050 e o contrato T-013;
- T-072/T-073 precisam aguardar baseline T-071;
- T-083 precisa aguardar integração, segurança e CI;
- T-085 precisa aguardar todas as evidências de aceitação, inclusive T-094 quando
  E-08 fizer parte da entrega;
- T-086 precisa aguardar T-010/T-011/T-012 e os gates T-060/T-061 para execução;
- T-087 e T-088 precisam aguardar o contrato T-086; T-088 também precisa de
  T-022/T-024;
- T-089 precisa aguardar o índice/custo de T-087 e a chamada curta de T-088;
- T-090 precisa aguardar T-089 e os gates de segurança T-060/T-061;
- T-091 precisa aguardar T-030/T-034 e os eventos de T-090;
- T-092 precisa aguardar T-086 a T-090; T-093 precisa aguardar T-091/T-092;
- T-094 precisa aguardar T-062 e T-093.
- T-043 precisa aguardar T-024/T-030/T-031/T-012; T-044 precisa aguardar
  T-024/T-031/T-032/T-041; T-045 precisa aguardar T-010/T-024/T-061.
- T-096 precisa aguardar T-095; T-097 precisa aguardar T-096; T-098 precisa
  aguardar T-097; T-099 precisa aguardar T-097/T-098 e as evidências de T-011.
- T-085 precisa aguardar T-099 quando o bundle service-only fizer parte da
  entrega.

## BLOQUEIA OUTRA TAREFA

- T-001 bloqueia toda escolha de versão e importação;
- T-003 bloqueia qualquer comando oficial de build/teste/CI;
- T-010 bloqueia a UI nativa e o runtime compartilhado;
- T-011 bloqueia cliente OpenCode e providers;
- T-012 bloqueia MCP/plugins/regras;
- T-013 bloqueia a trilha SSH;
- T-021/T-022/T-023 bloqueiam a integração local T-024;
- T-024 bloqueia as capacidades do agente;
- T-060/T-061 bloqueiam aprovação, integrações sensíveis e segurança;
- T-071 bloqueia qualquer patch de performance;
- T-081/T-082 bloqueiam empacotamento;
- T-083/T-084 bloqueiam o gate de release T-085;
- T-086 bloqueia índice, chamada Luna e toda seleção do E-08;
- T-087/T-088 bloqueiam a seleção T-089;
- T-089 bloqueia fallback/timeout/privacidade T-090;
- T-090 bloqueia a integração final da UI T-091;
- T-091/T-092 bloqueiam a integração e as métricas T-093;
- T-093 bloqueia a revisão final T-094, que bloqueia T-085 e AC-016 a AC-024.
- T-043/T-044 bloqueiam AC-027; T-045 bloqueia AC-028;
- T-095 bloqueia todo o pipeline service-only; T-096 bloqueia T-097;
  T-097 bloqueia T-098/T-099; T-099 bloqueia T-085 e AC-025/AC-026.

## ordem de execução recomendada

1. T-001 e T-010/T-011/T-012/T-013 em paralelo;
2. T-002 → T-003, com T-004 em paralelo após a proveniência;
3. T-020/T-030/T-050/T-070 em paralelo conforme contratos;
4. T-021/T-022/T-023 e T-031/T-034 em paralelo;
5. T-024 → T-040/T-041/T-042, enquanto T-051 avança na trilha remota;
6. T-060/T-061, testes T-080 e coleta T-071 em paralelo;
7. T-032/T-033/T-052, depois T-081 e T-053;
8. T-072/T-073 → T-074, CI T-082 e empacotamento T-083;
9. T-084;
10. T-086 → (T-087 + T-088) → T-089 → T-090;
11. T-091 + T-092 → T-093 → T-094;
12. T-095 → T-096 → T-097 → T-098 → T-099;
13. T-043 + T-044 + T-045 e T-099 → T-085.

Esse particionamento maximiza paralelismo por fronteira: runtime, workbench,
SSH, performance e CI têm responsáveis e diretórios distintos. Quando duas
tarefas precisarem editar o mesmo arquivo, a dependência deve ser explicitada ou
o trabalho deve ser dividido em subtarefas por módulo.

## registro da rodada — 2026-08-26

- foi criado `docs/planos/2026-08-26-e00-e01.md` com três barreiras rígidas para o
  fechamento atual de E-00/E-01;
- a onda 1 reúne E00-A, E01-A/T-010, E01-B/T-011 e E01-D/T-013, que não
  compartilham arquivos de implementação; E00-B ficou na onda 2 por compartilhar
  `docs/status/THIRD-PARTY-REVIEW.md` com E00-A;
- a onda 2 contém E00-B e E01-C/T-012, sendo que T-012 depende da versão e da
  configuração observadas em T-011;
- a onda 3 é E01-E: evidência final, testes, validação Linux/Windows sequencial
  e atualização dos documentos de aceite;
- nenhuma tarefa técnica foi marcada como concluída por esta reorganização;
  permanecem válidos os estados, bloqueios e evidências registrados acima.

## resultado da onda 1 — 2026-08-26

Execução da onda 1 encerrada com os estados abaixo. A onda 2 foi iniciada
parcialmente em E01-C/T-012; a onda 3 não foi iniciada. Nenhum item foi
promovido a concluído quando o teste exigido ficou bloqueado.

### E00-A — parcial/bloqueada

- o auditor de notices passou a executar diretamente com Node, sem `tsx` global;
- a execução encontrou 79 notices, 1.393 nomes em manifests, 72 sobrepostos,
  7 `notice-only`, 1.321 `manifest-only`, 7 licenças não declaradas e 7
  divergências notice/manifest; não encontrou duplicatas;
- hashes de licença/notices foram conferidos; `node --check` dos auditores passou;
- `docs/status/THIRD-PARTY-REVIEW.md` e
  `docs/status/2026-08-26-third-party-inventory.md` receberam a evidência e as
  limitações observadas;
- a frente permanece bloqueada por lacunas de classificação, ausência local dos
  tar/ZIP finais e falta de dependências para `test-build-scripts`.

### E01-A / T-010 — parcial

- o handler RPC passou a rejeitar `sessionId` cuja referência pertence a outro
  workspace;
- foram adicionados casos para workspace divergente, duplicidade concorrente,
  retry após rollback e dispose;
- `npm test` não carregou a suíte compilada porque `mocha` está ausente e `tsc`
  também não está disponível localmente; não houve instalação de dependências;
- `git diff --check` passou. A suíte compilada exigida continua pendente.

### E01-B / T-011 — parcial

- `/usr/bin/opencode` `1.18.23` foi sondado em loopback; o SHA-256 Linux
  registrado foi `f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f`;
- passaram health, OpenAPI, `/doc`, `/path`, `/event`, `server.connected`,
  sessão, status, detalhe, mensagens, diff, `prompt_async`, abort, permissão
  sintética, providers/configuração sem credencial, restart e nova assinatura
  SSE;
- o adaptador passou a usar `/path.directory` como autoridade quando presente,
  com `worktree` como possível raiz Git pai; a política padrão de restart ficou
  limitada a uma tentativa;
- a matriz e os adaptadores receberam as evidências. Nenhum provider/modelo foi
  anunciado e o binário externo não foi tratado como bundle suportado;
- a suíte compilada continua bloqueada por `mocha`; SHA Windows, manifesto que
  prove a origem do binário Linux, SSE interrompido/reconexão do cliente, eventos
  reais de prompt, diff não vazio e permissão real continuam pendentes.

### E01-D / T-013 — parcial

- a matriz/política SSH fail-closed foi validada para Windows/Linux x64 → host
  Linux x64 e recusas de host Windows, arquitetura fora da matriz, trust,
  chaves/hosts inválidos, OpenSSH ausente, destino inválido, transporte perdido
  e gates ausentes;
- foram adicionados testes para gate ausente e para garantir saída declarativa
  sem instruções de credencial, fallback ou replay;
- o teste-fonte foi bloqueado pela ausência do artefato compilado
  `remoteSshPolicy.js`; `tsc` não está disponível localmente;
- não houve conexão SSH, alteração de `known_hosts` ou uso de credenciais.

### nota operacional

`sudo` pode ser executado quando indispensável **somente mediante autorização
explícita pelo askpass/interação do usuário**. Isso não autoriza execução
automática, armazenamento de senha ou contorno das regras de privilégio; não foi
usado nesta onda.

## resultado parcial da onda 2 — 2026-08-26

### E01-C / T-012 — parcial

- o contrato privado de transporte foi versionado e validado na fronteira, com
  comandos/eventos serializáveis, versão, `requestId`, erros sanitizados e sem
  configuração bruta ou segredo;
- o bridge passou a encaminhar comandos por
  `unigma.agent.runtime.transport.send` e eventos por
  `unigma.agent.runtime.transport.event`; o retorno de objeto com métodos/eventos
  por `executeCommand` foi removido;
- o runtime revalida trust e preflight imediatamente antes de
  `ProcessManager.ensureStarted()`, recusa `unknownOrigin` na composição de
  produção sem classificador de plugin/regra, rejeita request duplicado e sessão
  desconhecida, valida eventos e encerra conexão/processo de forma assíncrona;
- o workbench classifica MCP e aceita somente classificações sanitizadas para
  plugin/regra. Como o inventário de plugin/regra ainda não está conectado, a
  view mantém `sourceInventoryComplete: false` e recusa o startup;
- foram adicionados/ajustados testes-fonte para contrato, bridge, ativação,
  eventos inválidos, duplicidade, sessão ausente e inventário incompleto;
- uma revisão independente somente de leitura confirmou as correções de
  revalidação, duplicidade, sessão, eventos e teardown, sem findings novos
  altos/médios;
- passaram checagens de sintaxe TypeScript, smoke puro da política, parsing dos
  manifestos e `git diff --check`;
 - a suíte oficial ainda não foi executada: `node_modules` não existe e
  `npm ci --no-audit --no-fund` exige Node `24.18.0`, enquanto o ambiente usa
  `v26.7.0`; por isso `mocha`, `gulp` e `tsc` continuam ausentes;
- a instalação de dependências foi autorizada pelo responsável, mas ainda não
  foi concluída. O próximo comando autorizado é `npm ci --no-audit --no-fund`
  neste checkout, após disponibilizar o Node fixado; nenhum `sudo`, instalação
  global ou `--ignore-scripts` deve ser usado.

### E00-B / AC-012

- escopo ajustado por `D-030`: prova formal de autoria e trademark clearance não
  bloqueiam a entrega FOSS; a frente deve remover identidade upstream visível e
  preservar copyright, licenças e notices aplicáveis.

### estado operacional

- branch `work/2026-08-26-e00-e03`, HEAD observado `709cccdb`;
- alterações permanecem sem commit e misturadas ao working tree compartilhado da
  onda 1; nenhum reset, push ou artefato novo foi produzido;
- após a instalação, executar compile/testes do runtime e `npm run
  typecheck-client`, registrar a saída e só então decidir se T-012 permanece
  parcial ou pode avançar para E01-E.
- feito: instruções operacionais do repositório consolidadas em `AGENTS.md`.
