# unigma — arquitetura

> **status: arquitetura aprovada em 2026-08-22.** A aprovação não autoriza
> implementação, importação de fork, distribuição nem publicação. As direções
> de produto confirmadas continuam em [PRODUCT.md](PRODUCT.md), os requisitos
> em [REQUIREMENTS.md](REQUIREMENTS.md) e as decisões em
> [DECISIONS.md](DECISIONS.md).

## 1. premissas e limites

### confirmados

- unigma é um IDE open-source derivado de Code - OSS, para Windows x64 e Linux
  x64 (RQ-001, RQ-012);
- o MVP inclui OpenCode, sessões, diffs, aprovações, SSH, MCP/plugins/regras,
  subagentes, worktrees, providers e modelos locais/APIs (RQ-002 a RQ-008);
- browser agent, cloud/agendador e colaboração em tempo real não pertencem ao
  MVP (NR-001 a NR-003);
- integrações não podem extrair credenciais, interceptar tráfego ou contornar
  entitlement (RQ-103, RQ-104).

### consequência arquitetural

O MVP é uma aplicação **desktop local-first**. Não há um serviço unigma
remoto. Um backend, banco de dados central, conta própria, RBAC de equipe,
fila distribuída, cache distribuído ou infraestrutura de cloud não resolvem
nenhum requisito atual; portanto não entram nesta arquitetura.

## 2. visão do sistema

```text
┌────────────────────────── unigma desktop ──────────────────────────┐
│ Code - OSS / Electron                                                │
│                                                                       │
│  workbench + terminal + git + temas                                  │
│       │                                                               │
│       ├── contribuição nativa unigmaAgent                            │
│       │     └── painel, comandos, diff e aprovações                  │
│       ├── extensão interna unigma-agent-runtime                      │
│       │     ├── application/service layer                            │
│       │     ├── adaptador HTTP + SSE do OpenCode                     │
│       │     └── armazenamento local mínimo                           │
│       │                                                               │
│       └── extensão unigma-remote-ssh                                 │
│             └── transporte SSH e servidor remoto versionado          │
└──────────────────────────────────────────────────────────────────────┘
             │ loopback no host local ou no host remoto
             ▼
       opencode serve
             │
       providers / modelos / MCP configurados e autorizados

fontes de verdade externas: Git/worktrees, OpenSSH, OpenCode e sistema de
arquivos do workspace.
```

**motivo:** concentra a lógica no desktop que já precisa existir e deixa o
OpenCode ser o runtime de agente. Evita uma API própria que só repetiria o
protocolo documentado do OpenCode.

### harness oficial e perfil `service-only`

O backend local do agente é o OpenCode; não existe um backend remoto do unigma.
O único harness oficial é o bundle `unigma+opencode`, preparado pelo pipeline
do [perfil service-only](OPENCODE-SERVICE-ONLY.md). O perfil preserva o harness
de execução do OpenCode — sessões, tool loop, compaction, limites, retries,
plugins, MCP, skills, permissões, streaming, subagentes e providers configurados
— e redireciona as superfícies de TUI, onboarding, prompts interativos,
navegação e UI redundante para o workbench nativo.

O “decepador” é uma transformação de build reproduzível:

```text
commit upstream -> patch service-only -> testes -> artefato versionado
```

Ele não altera uma instalação do usuário. O manifesto do bundle registra commit,
patchset, versão, hashes, alvo e evidências. Configuração, credenciais, sessões
e histórico permanecem fora do bundle; atualização e rollback trocam somente o
artefato do aplicativo e exigem que o processo esteja parado.

`opencode serve` já é headless; isso resolve a forma de execução, não a política
de distribuição. A análise service-only deve verificar as superfícies realmente
alcançáveis/empacotadas e aplicar apenas um patch mínimo comprovado, sem remover o
harness por varredura cega.

## 3. stack

| área | escolha aprovada | motivo |
| --- | --- | --- |
| shell desktop | Code - OSS/Electron | é a base definida do produto; evita reimplementar editor, terminal e workbench |
| linguagem do código próprio | TypeScript | é a linguagem nativa da base e das extensões Code - OSS |
| UI de agente | contribuição nativa do workbench, TypeScript/DOM/CSS do Code - OSS | evita um renderer Webview/Chromium adicional e torna o agente parte do IDE |
| runtime de agente | um processo do perfil bundled `opencode serve` por extension host, gerenciado pela extensão interna | OpenCode é o único harness oficial; reutilizar o processo evita custo por sessão |
| integração remota | extensão de autoridade remota sobre OpenSSH | preserva o modelo remoto do IDE sem backend unigma |
| persistência | settings, `workspaceState`, `globalState` e `SecretStorage` do Code - OSS | dados locais mínimos, sem novo banco |
| VCS/worktrees | Git instalado pelo usuário | Git já é a fonte de verdade para repositórios e worktrees |
| build/testes | ferramentas já presentes no Code - OSS e testes TypeScript da extensão | evita segundo sistema de build ou runner |

Versões exatas de Code - OSS, Node.js e Electron ficam fixadas no commit
upstream escolhido no início do fork. A regra é usar o Electron estável mais
recente **compatível com esse commit upstream** e acompanhar atualizações de
segurança do upstream. Não atualizar Electron isoladamente nem criar um fork
do runtime antes de um perfil reproduzível provar um gargalo que não possa ser
resolvido na aplicação.

### política de performance e memória

1. o agente não abre Webview nem renderer Chromium próprio; usa a árvore,
   editor de diff, painel e DOM nativos do workbench;
2. `unigma-agent-runtime` ativa sob demanda e mantém no máximo um processo
   OpenCode por extension host local ou remoto, reutilizado entre sessões;
3. streams SSE são consumidos e renderizados incrementalmente; listas de
   mensagens/diffs são virtualizadas e estado de visualização é limitado ao
   necessário para a sessão ativa;
4. nenhum prompt, diff, índice de workspace ou evento é duplicado em cache
   próprio; OpenCode, Git e filesystem continuam fontes de verdade;
5. painéis, listeners e buffers são descartados ao encerrar sessão ou
   workspace; processos que unigma iniciou são encerrados junto ao host;
6. o pipeline mede inicialização, RSS por processo e CPU em perfil limpo,
   idle, streaming ativo e SSH remoto. O baseline é versionado por plataforma
   antes de estabelecer limites de regressão;
7. não desabilitar sandbox, GPU, segurança de renderer ou outros mecanismos do
   Electron para perseguir memória aparente. Essas mudanças só trocam custo por
   risco e não são otimização.
8. patches de performance sobre Code - OSS são permitidos somente com perfil
   reproduzível antes/depois, escopo mínimo e teste de regressão. Se a correção
   for genérica, ela deve ser preparada para contribuição upstream; não manter
   um fork preventivo do Electron.

**motivo:** Electron tem custo inevitável, mas renderer extra, processo por
sessão, histórico duplicado e ativação ansiosa são custos evitáveis. Patches
sobre Code - OSS atacam o produto real; um fork preventivo do Electron
aumentaria manutenção e superfície de segurança sem evidência de ganho.

## 4. frontend e organização do desktop

### workbench

O Code - OSS permanece responsável por editor, explorador, terminal, SCM,
comandos, configurações, temas e acessibilidade. A contribuição nativa do
agente é a exceção explícita à regra “extensão antes de patch”: ela evita uma
segunda superfície Chromium e permite UX de primeira classe. Alterações no
núcleo além de branding, empacotamento e essa contribuição exigem medição que
justifique seu custo de manutenção.

A apresentação e a coordenação pertencem ao unigma. A TUI e os comandos de uso
direto do OpenCode não são uma segunda UI do produto; o perfil service-only os
remove ou redireciona sem duplicar o harness de execução.

### contribuição nativa `unigmaAgent`

Fica no workbench do Code - OSS e entrega comandos, painel, estados de
carregamento/erro/vazio, revisão de diff e aprovações. Ela usa somente os
componentes e o DOM internos do workbench; não cria Webview, processo Node,
conexão HTTP nem acesso direto ao filesystem.

### `unigma-agent-runtime`

É uma extensão interna instalada junto ao produto e dividida em:

- **application:** casos de uso de sessão, envio de mensagem, revisão de diff,
  aprovação, subagente, worktree e configuração;
- **domain:** tipos internos de sessão, aprovação e evento; sem chamadas a
  `vscode`, HTTP ou processo;
- **infrastructure:** cliente OpenCode, assinante SSE, armazenamento VS Code,
  processo filho e adaptadores Git.

A contribuição nativa e a extensão comunicam-se por RPC interno, tipado e
versionado. Toda operação privilegiada atravessa o runtime; a UI não tem acesso
direto a processo, rede, segredo ou arquivo.

### temas e localização

Tokens semânticos próprios ficam no pacote de temas, não espalhados em CSS de
funcionalidades. O tema base aplica a paleta roxa; variantes aplicam os mesmos
tokens a fundos branco, lilás, preto e roxo-escuro. A UI inicia em inglês;
`pt-BR` é entregue como pacote de idioma. A marca e fontes só entram após
verificação de direitos (RQ-010, RQ-011).

## 5. backend, banco, autenticação e RBAC

| item | decisão aprovada para o MVP | motivo |
| --- | --- | --- |
| backend unigma | inexistente | não há recurso cloud, conta ou colaboração a servir |
| banco de dados | inexistente | estado relevante pertence a Code - OSS, OpenCode, Git ou OpenSSH |
| autenticação unigma | inexistente | o único usuário é o usuário local do sistema operacional |
| autorização unigma | confiança do workspace + aprovação explícita de ações do agente | protege recursos locais sem criar identidade própria |
| RBAC | inexistente | RBAC pressupõe múltiplos principais e recurso compartilhado, ambos fora do escopo |

Credenciais de providers pertencem ao OpenCode. Credenciais e chaves SSH
pertencem ao OpenSSH/agente SSH e ao sistema operacional. unigma não lê, copia
nem transmite esses segredos. Se, no futuro, uma configuração própria exigir
segredo, ela usa exclusivamente `SecretStorage`; o MVP não cria esse caso.

## 6. autorização e segurança operacional

1. comandos de agente, MCP, plugin, terminal remoto e abertura de workspace
   exigem workspace confiável;
2. a extensão inicia o OpenCode somente no loopback do host em que o extension
   host executa; não expõe porta LAN;
3. a extensão usa a API HTTP/SSE pública do OpenCode; não intercepta tráfego,
   tokens ou caches OAuth;
4. mudanças de arquivo, comandos e operações Git originadas pelo agente são
   apresentadas ao usuário e dependem da política de permissão do OpenCode e
   de aprovação explícita na UI; unigma não contorna nem autoaprova a política;
5. MCP/plugins no MVP são configurados localmente por fonte explícita e
   confiável. Não há catálogo, instalação silenciosa ou marketplace Microsoft;
6. SSH usa o cliente OpenSSH, `known_hosts` e agente/chaves já administrados
   pelo usuário. Senhas e chaves não são solicitadas, registradas ou
   persistidas por unigma;
7. toda entrada de UI, configuração de workspace e evento externo é
   validada na fronteira antes de chegar à camada de aplicação.

**motivo:** a superfície crítica é o computador do usuário. Segurança útil
aqui é conter privilégios e preservar a decisão humana, não construir IAM.

## 7. APIs e contratos importantes

### APIs externas

- **OpenCode:** HTTP para comandos/sessões e SSE para eventos. Este é o único
  protocolo de agente usado pelo MVP. ACP fica fora do caminho crítico até
  existir uma necessidade concreta que HTTP/SSE não cubra;
- **OpenSSH:** processo de transporte para a extensão remota; não há API
  unigma exposta na rede;
- **Git:** processos locais para listar e criar worktrees; Git continua a fonte
  de verdade;
- **MCP e providers:** configurados e executados pelo OpenCode por interfaces
  autorizadas. unigma apresenta e encaminha configuração; não reimplementa os
  protocolos.

### contrato UI nativa ↔ runtime de agente

O contrato é privado, TypeScript e versionado. Ele é transportado pelo RPC
interno Code - OSS e contém apenas:

```text
AgentCommand: iniciar/parar sessão, enviar entrada, pedir revisão,
              aprovar/rejeitar ação, listar worktrees, aplicar configuração.
AgentEvent:   estado da sessão, conteúdo apresentado, diff disponível,
              pedido de permissão, resultado ou erro.
```

Cada comando carrega um `requestId`; cada evento identifica a sessão OpenCode
correspondente. O conteúdo transportado é validado no runtime. IDs, payloads
detalhados e mapeamentos de endpoint pertencem ao adaptador OpenCode, para que
mudanças de API não vazem à UI.

### contrato extensão ↔ OpenCode

`OpenCodeClient` é a única interface que conhece endpoints HTTP/SSE. A camada
de aplicação recebe tipos internos estáveis e não importa o SDK nem detalhes do
transporte. Falha de conexão, reinício do processo e incompatibilidade de API
viram eventos explícitos, nunca exceções ignoradas na UI.

## 8. execução local e remota

### local

`unigma-agent-runtime` inicia e supervisiona um processo `opencode serve` do
bundle oficial associado ao extension host. Ele aguarda a disponibilidade do
serviço, conecta-se por loopback, o reutiliza entre sessões e encerra somente o
processo que criou quando o host encerra. Um executável externo pode ser usado
em probe de desenvolvimento, mas isso não transforma a versão observada em
runtime bundled suportado.

### SSH

`unigma-remote-ssh` implementa a autoridade remota do Code - OSS com OpenSSH e
instala/inicia apenas um servidor remoto com versão compatível do cliente. No
workspace remoto, `unigma-agent-runtime` executa no extension host remoto e
inicia o OpenCode naquele host; assim caminhos, Git, terminal, worktrees e ferramentas
do agente pertencem ao mesmo ambiente do projeto.

**motivo:** executar OpenCode na máquina remota elimina cópia de workspace e
ambiguidade de caminho. O transporte não ganha acesso além do que o SSH do
usuário já concedeu.

## 9. modelo de dados e armazenamento

Não há banco. Dados são locais e têm a seguinte fonte de verdade:

| conceito | fonte de verdade | persistência em unigma |
| --- | --- | --- |
| sessão e histórico de agente | OpenCode | apenas referência de sessão para reabrir UI, quando disponível |
| eventos e diffs em andamento | OpenCode/SSE | memória; descartável após encerrar a sessão |
| aprovação pendente | OpenCode e UI ativa | memória; não é restaurada automaticamente |
| workspace/configuração visual | settings do Code - OSS | escopo usuário ou workspace, conforme configuração |
| configuração de provider/MCP/plugin | OpenCode/configuração explícita do usuário | unigma não duplica segredos |
| worktree/branch | Git | nenhuma cópia; consulta sob demanda |
| destino e confiança SSH | OpenSSH/Code - OSS | nenhuma cópia de chave ou senha |
| logs locais | diretório de logs do Code - OSS | retenção local administrada pelo aplicativo |

Não há sincronização, retenção de conta, telemetria, perfil remoto ou backup
próprio. Caso um requisito futuro exija persistência compartilhada, ele deve
introduzir modelo de dados, criptografia, retenção e autorização como uma
decisão nova — não como extensão invisível deste modelo.

## 10. filas, jobs, cache e armazenamento de arquivos

- **filas/jobs:** inexistentes. O OpenCode administra seu trabalho. A extensão
  só serializa start/stop do processo e preserva a ordem dos eventos por sessão;
- **cache:** apenas estado efêmero de UI e último snapshot necessário para
  renderização. É descartável e não é compartilhado;
- **arquivos:** workspace, Git e worktrees permanecem no sistema de arquivos
  local/remoto. Não há object storage, upload ou espelhamento;
- **jobs agendados:** inexistentes; agendador é explicitamente posterior ao
  MVP.

## 11. observabilidade

- canal de saída `Unigma` para diagnóstico operacional local;
- logs estruturados locais com `requestId` e referência de sessão, sem entrada
  de prompt, segredo, chave SSH, token ou conteúdo de arquivo por padrão;
- mensagens de erro acionáveis na UI, incluindo indisponibilidade do OpenCode,
  erro de SSH e recusa de permissão;
- nenhuma telemetria, analytics ou envio de logs no MVP;
- logs de transporte OpenCode/OpenSSH permanecem em suas próprias ferramentas;
  unigma referencia a origem sem copiá-los indiscriminadamente.

## 12. testes

| nível | escopo |
| --- | --- |
| unitário | camada de aplicação, validação de mensagens, mapeamento de eventos e decisões de permissão |
| contrato | adaptador HTTP/SSE contra fixture/servidor controlado compatível com a API OpenCode documentada |
| integração local | extensão + processo OpenCode controlado, sessão, evento, diff e aprovação |
| integração SSH | conexão a host de teste, extension host remoto, OpenCode remoto e worktree Git temporário |
| smoke de distribuição | inicialização de artefato Windows x64 e Linux x64 |
| segurança | workspace não confiável, mensagem RPC inválida, segredo ausente nos logs e ação rejeitada |
| performance | perfil limpo, idle, streaming e SSH remoto; tempo de inicialização, RSS por processo e CPU comparados ao baseline da mesma plataforma |
| visual/manual | temas, idioma inglês/`pt-BR`, contraste, teclado e foco |

Usar o harness já adotado pelo Code - OSS para build/teste e adicionar testes
somente no pacote que mudou. Não adicionar um segundo runner sem necessidade.

## 13. infraestrutura e deploy

### infraestrutura

Não há infraestrutura de aplicação: nenhum servidor, VPC, banco, fila,
cache, bucket, CDN ou secret manager unigma no MVP. O CI é a única automação
remota necessária.

### pipeline

1. checkout limpo do upstream OpenCode e do fork em `unigma-code`;
2. aplicação do patchset service-only, identificado e reaplicável;
3. build reproduzível usando versões fixadas pelo upstream;
4. lint, testes do harness, testes de contrato HTTP/SSE e smoke por plataforma;
5. geração do bundle versionado `unigma+opencode` para Windows x64 e Linux x64;
6. auditoria de licenças/notices, identidade, hashes e separação dos dados do
   usuário;
7. publicação ou atualização somente após autorização explícita de release.

GitHub Actions é a opção recomendada para CI por acompanhar o identificador
público proposto e eliminar infraestrutura própria. A assinatura de binários,
notarização e canal de atualização automática ficam fora da primeira
distribuição pública até existirem certificados, política de release e direito
de marca validados.

## 14. estrutura de diretórios após importar Code - OSS

```text
unigma/
├── src/
│   └── vs/workbench/contrib/unigmaAgent/
│       ├── browser/             # contribuição nativa: painel, diff e comandos
│       └── common/              # contratos RPC e tipos sem UI
├── extensions/
│   ├── unigma-agent-runtime/
│   │   ├── src/
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   └── infrastructure/  # OpenCode CLI, HTTP/SSE, Git e storage
│   │   └── test/
│   └── unigma-remote-ssh/
│       ├── src/
│       └── test/
├── resources/unigma/            # branding e metadados de distribuição
├── build/                        # empacotamento e pipeline do bundle, se necessário
├── docs/
└── product.json                  # identidade e endpoints permitidos
```

Não criar pacotes compartilhados, monorepo adicional, microsserviços ou camada
de abstração genérica antes de haver duplicação concreta. Os módulos só se
comunicam por APIs públicas do Code - OSS ou pelos contratos privados descritos
na seção 7.

## 15. fronteiras de módulo

| módulo | pode conhecer | não pode conhecer |
| --- | --- | --- |
| `unigmaAgent` nativo | contrato RPC, estado para renderizar e componentes do workbench | processo, segredos, HTTP e SSH |
| application | interfaces de agente, Git e armazenamento | endpoints OpenCode, DOM e detalhes de transporte |
| infrastructure/OpenCode | HTTP, SSE e ciclo de vida do processo | componentes visuais |
| infrastructure/Git | CLI/API Git e worktrees | UI e credenciais de provider |
| `unigma-agent-runtime` | execução local/remota de OpenCode e casos de uso | DOM, componentes do workbench e marca |
| `unigma-remote-ssh` | SSH, transporte remoto e versão de servidor | sessão, prompt ou provider do agente |
| Code - OSS upstream | workbench, extensões e pontos de integração | lógica específica de produto, salvo branding/build e patch de performance medido |

## arquitetura aprovada

Um fork desmarcado de Code - OSS, com uma contribuição nativa `unigmaAgent` no
workbench, a extensão interna `unigma-agent-runtime` para executar o perfil
bundled service-only do CLI `opencode serve` e integrar HTTP/SSE local/remotamente,
e `unigma-remote-ssh` para transporte OpenSSH. O sistema não tem backend remoto,
banco, conta, RBAC, fila distribuída, cache distribuído ou cloud no MVP. Git,
OpenSSH e OpenCode continuam fontes de verdade. Patches de performance são
aplicados sobre Code - OSS somente quando medidos; Electron permanece upstream
compatível. O decepador e o bundle são definidos em
[OPENCODE-SERVICE-ONLY.md](OPENCODE-SERVICE-ONLY.md), mas ainda não têm
implementação aceita.

## riscos

1. **upstream Code - OSS:** contribuição nativa e patches de performance criam
   custo de rebase. Mitigação: cada patch precisa de perfil, teste e escopo
   mínimo; preferir contribuição upstream quando aplicável.
2. **SSH remoto:** provisionar um servidor compatível em Windows/Linux é a
   parte mais sensível do MVP. Mitigação: isolar em extensão própria e testar
   matriz local/remota desde o início.
3. **evolução do OpenCode:** endpoints/eventos podem mudar. Mitigação:
   adaptador único, contratos internos e testes de contrato.
4. **execução de agente:** MCP, terminal e worktrees ampliam a superfície de
   efeitos locais. Mitigação: workspace trust, fontes explícitas e aprovação.
5. **identidade/distribuição:** `unigma` tem colisões públicas conhecidas e a
   disponibilidade de `unigma-code` não é garantia de marca. Mitigação: não
   publicar antes de validação jurídica e reserva autorizada.
6. **perfil OpenCode:** patches service-only podem divergir do upstream ou
   separar incorretamente apresentação e harness. Mitigação: patchset mínimo,
   manifesto de proveniência, probe por versão e rollback atômico.

## trade-offs

| escolha | ganho | custo aceito |
| --- | --- | --- |
| sem backend/cloud | rapidez, privacidade e baixo custo operacional | sem colaboração, sync ou scheduler |
| OpenCode separado | menor acoplamento e uso de API documentada | supervisionar processo e compatibilidade |
| contribuição nativa do workbench | menos RAM e UX de primeira classe | maior custo de rebase que uma webview |
| runtime interno separado da UI | processo OpenCode reutilizável e fronteira clara | RPC interno e supervisão de ciclo de vida |
| patches Code - OSS medidos | otimiza o produto real | exige baseline e disciplina de manutenção |
| OpenSSH nativo | não duplica autenticação/segredos | suporte remoto é dependente do ambiente SSH |
| nenhum catálogo de extensões | menor risco legal e de supply chain | descoberta/instalação menos conveniente |
| OpenCode bundled service-only | processo e UX sob uma fronteira clara | manter patchset, bundle, hashes e rollback |

## decisões remanescentes

Não há decisão arquitetural pendente. Antes de qualquer distribuição pública,
ainda será necessária validação jurídica de marca/identidade e autorização
específica para reserva de identificadores, certificados de assinatura e
publicação. Os contratos operacionais ainda pendentes estão enumerados em
[REQUIREMENTS.md](REQUIREMENTS.md#requisitos-ainda-não-definidos).
