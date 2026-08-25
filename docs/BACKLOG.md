# unigma — backlog implementável

> **status:** backlog derivado da arquitetura aprovada em 2026-08-22. A E-00 permanece
> parcialmente concluída: há build, artefato e smoke de núcleo Windows x64, mas
> Linux x64 e a revisão final de distribuição continuam pendentes. As demais
> tarefas continuam futuras. Este arquivo não autoriza distribuição ou publicação.

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
clones temporários de validação e no runner self-hosted Windows. A execução
`32896363977` criou evidência e artefato de teste Windows x64; uma tentativa
cross Linux `32901756829` não criou artefato, então Linux ainda está pendente.

| frente | feito | ainda necessário |
| --- | --- | --- |
| T-001 upstream | tag `1.134.0`, SHA, Node, Electron e alvos registrados em `docs/UPSTREAM.md` e `DECISIONS.md` | validar compatibilidade de build/artefato em ambiente suportado |
| T-002 importação | snapshot importado; `upstream` configurado; licenças/notices preservados; método registrado | concluir build mínimo reproduzível; revisar a árvore upstream antes de distribuição |
| T-003 harness | comandos reais registrados em `AGENTS.md`; checks locais históricos e `npm ci`, compile, checks focados e empacotamento Windows x64 passaram no run `32896363977` | validar por plataforma Linux; `test-node` depende de `out/` |
| T-004 identidade | `README.md`, `product.json`, `resources/unigma/` e revisão inicial de terceiros ajustados | auditoria legal/licenças completa, revisão de integrações upstream e artefatos finais |

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
- `test-node` retornou código de processo 0, mas emitiu `ERR_MODULE_NOT_FOUND`
  para arquivos ausentes em `out/`; por isso não foi tratado como teste aprovado.
- auditorias npm relataram vulnerabilidades herdadas das dependências; não
  executar `npm audit fix` automaticamente.

Esses bloqueios não foram classificados como bugs do unigma. A E-00 só pode ser
marcada integralmente concluída quando houver build mínimo reproduzível e
evidência de artefato/smoke para Windows x64 e Linux x64, além da revisão de
distribuição exigida por T-002/T-004.

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

**status:** concluída quanto à importação e proveniência; build de artefato ainda
bloqueado por dependências/toolchain do ambiente.

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

**status:** concluída quanto ao registro do harness; validação parcial executada,
com compile/build ainda bloqueado.

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

**status:** concluída para a fundação e identidade inicial; auditoria legal,
triagem completa de terceiros e release continuam bloqueados.

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
tem contrato implementado e validado; T-011, T-012 e T-013 continuam
especificações documentais condicionais, sem suporte funcional. A E-01 não
declara suporte de OpenCode, providers, integrações locais ou SSH.

### T-010 — especificar domínio e RPC UI↔runtime

**status:** contrato TypeScript implementado e validado, com validação estrutural
e teste de contrato; runtime e integração funcional permanecem nas tarefas
posteriores.

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

**status:** especificação documental condicional; versão, checksum e binário
OpenCode não foram fixados nem testados, portanto nenhum suporte funcional ou de
release é declarado.

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

**status:** especificação documental condicional, sem suporte funcional;
implementação e evidências de carregamento, recusa, trust e redaction continuam
pendentes.

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

**status:** especificação documental condicional, sem suporte funcional; conexão,
provisionamento e execução da matriz continuam pendentes. Host remoto Windows
permanece recusado por este contrato e não é suporte publicado.

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

**status:** implementação inicial e testes fonte adicionados; execução e teste
contra um binário OpenCode fixado permanecem pendentes.

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

**status:** adapter e fixture estrutural local adicionados; compatibilidade real
permanece condicional a T-011 e os testes ainda não foram executados neste
checkout.

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

**status:** armazenamento mínimo, redaction e testes fonte adicionados; execução
e integração no fluxo de sessão permanecem pendentes.

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

## E-05 — remoto SSH

### T-050 — criar/adaptar autoridade remota OpenSSH

- **objetivo:** integrar `unigma-remote-ssh` ao modelo de autoridade remota do
  Code - OSS usando OpenSSH existente.
- **responsável lógico:** engenharia remota.
- **dependências:** T-002, T-003, T-013.
- **arquivos/módulos prováveis:** `extensions/unigma-remote-ssh/src/`, manifesto,
  adaptadores OpenSSH e testes.
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
- **critérios de aceite:** OpenCode roda no destino; caminhos/Git/worktrees são
  remotos; loopback é do host remoto; encerramento limpa apenas processo criado.
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

- **objetivo:** consolidar evidências de AC-001 a AC-015 e declarar o que passou,
  falhou ou permanece fora da entrega, incluindo a frente E-08 quando ela fizer
  parte da entrega integrada.
- **responsável lógico:** release manager + QA principal.
- **dependências:** T-034, T-041, T-042, T-053, T-062, T-074, T-081, T-083,
  T-084 e T-094.
- **arquivos/módulos prováveis:** `docs/ACCEPTANCE.md`, relatório de evidências,
  artefatos e changelog futuro.
- **critérios de aceite:** AC-001 a AC-024 têm evidência reproduzível quando
  fizerem parte do escopo da entrega; falha ou lacuna bloqueia a declaração de
  pronto; relatório referencia commit, plataforma, comando e artefato. Direção
  documental de E-08 não é evidência de implementação.
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
11. T-091 + T-092 → T-093 → T-094 → T-085.

Esse particionamento maximiza paralelismo por fronteira: runtime, workbench,
SSH, performance e CI têm responsáveis e diretórios distintos. Quando duas
tarefas precisarem editar o mesmo arquivo, a dependência deve ser explicitada ou
o trabalho deve ser dividido em subtarefas por módulo.
