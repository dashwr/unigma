# unigma — decisões

## estado deste documento

Registro consolidado. As decisões arquiteturais aprovadas não autorizam sua
implementação; cada alteração de código continua exigindo início explícito do
trabalho.

## decisões confirmadas

| ID | Decisão/direção | Estado | Evidência |
| --- | --- | --- | --- |
| D-001 | O projeto se chama `unigma`. | confirmado | S-01 |
| D-002 | A direção é um IDE open-source baseado em Code - OSS com integração profunda ao OpenCode. | confirmado | S-01 |
| D-003 | Browser agent, cloud/agendador e colaboração em tempo real ficam para fase posterior. | confirmado | S-01 |
| D-004 | Não usar credenciais extraídas, interceptação de tráfego ou bypass de entitlement. | confirmado | S-01 |
| D-005 | O código próprio de unigma usa licença MIT. | confirmado | S-06 |
| D-006 | O MVP inclui todas as capacidades de escopo declarado, exceto browser agent, cloud/agendador e colaboração em tempo real. | confirmado | S-01, S-06 |
| D-007 | A identidade usa inglês por padrão, pacote `pt-BR`, paleta roxo/magenta/violeta, sheen metálico controlado, temas sobre os fundos declarados e tagline “There's no secret.”. | confirmado | S-06, S-16 |
| D-008 | A marca será original: lettering geométrico/block-like é apenas referência de princípio para construção própria por blocos verticais roxos, sem cópia de lettering, ícone, proporções, composição ou outros elementos identificáveis. A imagem fornecida pelo responsável é referência visual, não ativo distribuível. | confirmado | S-01, S-06, S-16 |
| D-009 | O MVP atende Windows x64 e Linux x64. | confirmado em 2026-08-22 | S-08 |
| D-010 | `unigma` permanece nome do produto; `unigma-code` é o identificador público proposto. | confirmado em 2026-08-22 | S-08 |
| D-011 | OpenCode é o runtime primário de agente do IDE; desempenho e memória são prioridades de produto. | confirmado em 2026-08-22 | S-09 |
| D-012 | Patches de performance podem ser aplicados sobre Code - OSS quando uma necessidade reproduzível os justificar; não haverá fork preventivo do Electron. | confirmado em 2026-08-22 | S-10 |
| D-013 | A arquitetura desktop local-first documentada em `ARCHITECTURE.md` está aprovada: contribuição nativa `unigmaAgent`, `unigma-agent-runtime` com CLI `opencode serve` por HTTP/SSE, OpenSSH remoto, dados locais mínimos e ausência de backend/banco/RBAC/cloud no MVP. | aprovado em 2026-08-22 | S-11 |
| D-014 | O fork Code - OSS será desmarcado e preservará avisos, licenças e copyrights aplicáveis em toda distribuição. | aprovado em 2026-08-22 | S-02, S-03, S-11 |
| D-015 | O upstream inicial é `microsoft/vscode` na tag `1.134.0`, commit `474a349ad5b745e512ef86b864d1c74f7264dd7a`; a matriz declarada usa Node.js `24.18.0`, Electron `42.8.1`, Windows x64 e Linux x64. Atualizações acompanham releases/patches verificáveis do upstream. | aprovado em 2026-08-22 | S-12 |
| D-016 | O produto adota classificação aproximada por `intelligence index` e roteamento local limitado a modelos configurados/autorizados pelo OpenCode, com `Autopilot!` opt-in, `persistSelectedModel`, fallback seguro e os limites de custo, privacidade e UI descritos abaixo. | direção de produto confirmada; detalhes operacionais e validação pendentes | S-17 |
| D-017 | OpenCode é o único harness/backend local oficial do produto; a distribuição oficial é `unigma+opencode`. | confirmado em 2026-08-26 | S-18 |
| D-018 | O bundle oficial usa um perfil `service-only`: preserva o harness de execução do OpenCode e remove/redireciona TUI, onboarding, prompts interativos, navegação e UI redundante para o unigma. | direção confirmada; patch e validação pendentes | S-18 |
| D-019 | O “decepador” é uma cadeia reproduzível `commit upstream → patch service-only → testes → artefato versionado`; não muta instalações do usuário. | direção confirmada; pipeline pendente | S-18 |
| D-020 | Atualizações autorizadas trocam o bundle atomicamente com o processo parado, mantendo rollback e os dados do usuário fora do artefato. | direção confirmada; implementação e evidência pendentes | S-18 |
| D-021 | A direção do agente inclui `@` para ferramentas, `/` para skills, mensagens entre sessões locais e chips de estado; o protocolo de controle remoto é construído dormente, sem ativação no MVP. | direção confirmada; contratos e implementação pendentes | S-18 |
| D-022 | Codex/Claude Code podem ser extensões externas instaladas pelo usuário, mas não têm suporte oficial nem são harness do unigma; `unigma+pi` é experimental e plugins/MCP/rules/skills oficiais usam os mecanismos nativos do OpenCode. | confirmado em 2026-08-26 | S-18 |
| D-023 | `opencode serve` já é o entrypoint headless; isso não equivale ao perfil de distribuição `service-only`. Não haverá poda ampla por inferência: primeiro auditar superfícies alcançáveis e aplicar somente o patch mínimo comprovado, mantendo `unigma+opencode` como alvo oficial. | confirmado em 2026-08-27 | resposta do responsável nesta rodada |
| D-024 | O subsistema herdado `src/vs/platform/agentHost/**` e suas superfícies de UI, build, configuração e E2E são retirados do produto. O harness oficial continua sendo `unigma+opencode`; MCP, Terminal Profiles, Copilot geral, `unigmaAgent` e o runtime próprio não são substituídos por compatibilidade Agent Host. | confirmado em 2026-08-28 | resposta do responsável nesta rodada |
| D-025 | `AC-012` exige esforço proporcional a um projeto FOSS não monetizado cujos assets foram criados pelo próprio responsável: autodeclaração assinada, proveniência dos assets e busca documentada de colisão de marca. `AC-001` permanece integralmente aplicável. | substituído por D-030 | resposta do responsável nesta rodada |
| D-026 | O OpenCode é consumido em três camadas: binário do usuário validado por contrato, bundle de release upstream fixado e não modificado, e poda `service-only` opcional. `T-096` não é caminho crítico. | confirmado em 2026-08-28 | resposta do responsável nesta rodada |
| D-030 | O responsável não exige prova formal de autoria/proveniência dos assets nem trademark clearance para liberar o produto FOSS. A frente de branding deve remover identidades upstream da experiência do usuário e manter somente copyright, licenças, notices e demais obrigações legais aplicáveis; segurança técnica e integridade da cadeia de dependências continuam gates. | confirmado em 2026-08-29 | resposta do responsável nesta rodada |
| D-031 | A primeira entrega de `CLI-002` assume `unigma-server` pré-instalado no host remoto. O cliente não provisiona, copia ou atualiza o servidor nesta etapa; push/tarball ficam para uma fase posterior com contrato próprio. | confirmado em 2026-08-30 | resposta do responsável nesta rodada |
| D-032 | Substitui D-031 para a entrega SSH: após gates OpenSSH/trust e confirmação explícita por host, o cliente envia pela própria sessão SSH o par versionado `unigma-server` + `unigma+opencode`, validado por manifesto/hashes e instalado atomicamente na área do usuário remoto. Não há download/CDN, elevação, instalação global, cópia de workspace ou automação de OAuth/plugins. | confirmado em 2026-09-01 | resposta do responsável nesta rodada |
| D-032 | A distribuição unigma desativa somente a superfície `workbench.panel.chat`; serviços compartilhados necessários a MCP, inline chat, terminal/notebook e `unigmaAgent` permanecem. Comandos e smoke devem declarar essa capability indisponível sem fallback ou skip genérico. | confirmado em 2026-08-30 | resposta do responsável nesta rodada |
| D-035 | O staging remoto retém por padrão 2 versões (ativa + anterior) e poda versões mais antigas, por mtime, somente após ativação; a VPS usa retenção 1 e falha de poda não invalida ativação. | confirmado em 2026-09-03 | resposta do responsável nesta rodada |
| D-036 | A baseline de compatibilidade do `unigma-server` Linux é GLIBC 2.28 / GLIBCXX 3.4.25, já declarada pelo produto; o build passa a obedecê-la compilando os addons nativos contra o sysroot vendorizado. O gate de símbolos falha também em GLIBCXX e CXXABI, divergindo deliberadamente do upstream. | confirmado em 2026-09-03 | defeito em `33784052687`; correção em `33796510313` e `33797399848` |

### D-016 — direção confirmada e limites

- Modelos configurados e localmente autorizados pelo OpenCode recebem um
  `intelligence index` aproximado baseado em pesquisa/evidência versionada. O
  índice não é verdade universal e não cria catálogo remoto.
- Quando aplicável, a tarefa recebe uma estimativa de índice necessário. O
  roteador escolhe o modelo elegível de menor custo definido por configuração
  verificável que atinja esse índice e respeite o teto explícito de `maxModel`.
  `maxModel` não é ranking universal. `~49`, ou qualquer outro exemplo
  numérico, é apenas ilustrativo e não normativo.
- `Autopilot!` é opt-in: desligado usa o modelo selecionado sem roteamento;
  ligado permite roteamento antes de cada prompt. `persistSelectedModel` evita o
  roteador antes do prompt e mantém o modelo selecionado.
- O roteador usa `Luna medium` sem contexto, sem pensamento longo e com saída
  estruturada curta somente quando configurado e disponível no OpenCode. Não há
  credenciais nem endpoints ocultos.
- Em erro ou timeout, o fallback é o modelo selecionado. Prompt, raciocínio e
  segredo não são registrados; o custo e a implicação de privacidade da chamada
  adicional devem ser explícitos.
- O toggle desligado é visualmente mais escuro; ligado usa a cor principal do
  tema com movimento sutil quando a preferência de movimento reduzido não o
  impedir, sem animação excessiva.

Este registro confirma direção, não implementação ou suporte funcional.

### D-017 a D-022 — harness, bundle e capacidades do agente

- O OpenCode continua sendo a fonte de verdade do harness: sessões, tool loop,
  permissões, compaction, limites, retries, plugins, MCP, skills, providers,
  streaming e subagentes não devem ser reimplementados no workbench.
- O unigma é dono da apresentação e da coordenação. O patch service-only retira
  superfícies duplicadas, mas não apaga código upstream por varredura cega nem
  transforma o runtime em um segundo harness.
- O bundle contém somente o runtime versionado; configuração, credenciais,
  sessões, histórico e demais dados do usuário permanecem fora dele. Não há
  download automático, servidor central ou telemetria implícitos.
- `@`, `/`, mensagens intersessão e chips pertencem à experiência nativa do
  agente. O controle remoto dormente não reabre colaboração em tempo real,
  cloud ou backend no MVP.
- Extensão externa não é integração oficial. O unigma não cria catálogo,
  carregador ou adaptador para transformar Codex/Claude Code em harness.
- `opencode serve` headless resolve a ausência de TUI durante a execução, mas não
  prova sozinho a fronteira de distribuição: o bundle ainda precisa de
  proveniência, allowlist de superfícies, auditoria e separação de UI/CLI
  redundante. A poda deve ser mínima e baseada em evidência.

### D-024 — retirada do Agent Host herdado

- A retirada inclui a implementação de plataforma, transportes, protocolo AHP,
  providers/contribuições de Agent Sessions, comandos de Agents Window,
  entrypoints de build, smoke/E2E, configuração `chat.agentHost.*` e artefatos
  de SDK que existiam somente para esse caminho.
- Tipos realmente compartilhados por Chat, MCP, sessões e feedback devem viver em
  módulos neutros mínimos; não se mantém shim, reexport ou cópia integral do
  protocolo sob outro nome.
- A remoção não autoriza apagar o runtime `unigma-agent-runtime`, a extensão
  `unigma-remote-ssh`, MCP geral, Terminal Profiles, Copilot CLI geral ou a
  integração OpenCode.

### D-025 — esforço proporcional de branding

- A conclusão de AC-012 requer autodeclaração assinada de autoria, licença e
  autorização de distribuição, referência à proveniência versionada dos assets e
  busca documentada de `unigma`/`unigma-code` em USPTO, EUIPO, INPI, npm, PyPI,
  GitHub e domínio.
- A decisão não reduz a obrigação de AC-001: licenças, notices e copyrights do
  código incorporado continuam exigindo inventário e revisão completos.

### D-026 — camadas de consumo do OpenCode

- O binário selecionado pelo usuário é resolvido por `PATH` ou override explícito
  e validado por `/doc` antes de iniciar uma sessão.
- O bundle de release upstream é fixado por versão/hash e permanece sem mutação;
  `service-only` é uma poda explícita e auditada de superfícies redundantes.
- Não há download silencioso, catálogo, provider oculto, credential injection ou
  segundo harness no workbench.

### D-027 — o Code Server do CLI é preservado; só o Agent Host sai

> confirmada em 2026-08-29, a partir da auditoria em
> [`status/2026-08-29-cli-audit.md`](status/2026-08-29-cli-audit.md).

- `D-024` se aplica ao CLI Rust, mas **não** ao Code Server. `code_server.rs`,
  `server_bridge.rs`, `server_multiplexer.rs`, `protocol.rs`, o RPC genérico de
  `control_server.rs` e o entry point `command-shell` são infraestrutura do SSH
  remoto e permanecem no produto.
- Saem do CLI o subsistema `agent_host*`, o supervisor, o registry de endpoints,
  os módulos órfãos `commands/agent*.rs`, as flags `--agent-host-bridge-*` e as
  dependências AHP que existiam só para esse caminho.
- `code tunnel` e `@microsoft/dev-tunnels-*` **não** são cortados nesta frente. O
  destino deles é a frente separada `CLI-003`, uma auditoria própria cujo
  resultado volta aqui como decisão; ela não bloqueia o desacoplamento do Agent
  Host nem o SSH remoto.

### D-028 — o servidor remoto é o `unigma-server` do próprio fork

> confirmada em 2026-08-29.

- O host remoto executa o servidor construído a partir deste fork
  (`serverApplicationName: "unigma-server"`), não o servidor Code - OSS upstream:
  o extension host remoto precisa das extensões internas do unigma.
- Cliente e servidor são acoplados por commit; incompatibilidade falha fechado e
  não tenta fallback local.
- A forma de entrega do servidor — pré-instalado, enviado pelo cliente pela
  própria sessão OpenSSH ou baixado de um endpoint próprio — permanece **aberta**
  e está registrada como `Q-2` em
  [`planos/2026-08-29-cli-ssh-remoto.md`](planos/2026-08-29-cli-ssh-remoto.md).
  Publicar o servidor é distribuição e depende de `E00-A`/`E00-B`.

### D-029 — o CLI volta a anunciar `PROTOCOL_VERSION=4`

> confirmada em 2026-08-29, após a pesquisa do wire protocol e a revisão
> independente do patch em `cli/`.

- `PROTOCOL_VERSION` é o wire protocol MsgPack do `command-shell/control_server`,
  não o protocolo do Code Server nem um pareamento genérico de clientes.
- A versão `4` é a última versão sem as capacidades AHP; `5` e `6` eram
  extensões do Agent Host removido. O CLI não deve anunciar capacidades que não
  existem.
- Clientes que exigem `5`/`6` devem falhar fechado; não há fallback silencioso
  para outro protocolo ou outro servidor. A matriz de clientes suportados ainda
  precisa ser colhida no runner.

### D-033 — o hash do manifesto aparece na confirmação de escrita remota

> confirmada em 2026-09-02, ao implementar `T-052`.

- A regra geral do projeto é não exibir hashes: eles poluem a saída e raramente
  ajudam quem lê. A confirmação de `§5` do contrato SSH é a exceção.
- Ali o valor tem função real para uma pessoa: é o que permite conferir o que
  está prestes a ser escrito numa máquina remota, antes de autorizar.
- A exceção é estreita. O hash continua proibido em log, em relatório de smoke,
  em provenance exibida e em qualquer saída de agente.
- A confirmação em si é obrigatória e falha fechado; ausência de callback ou
  resposta negativa recusa a escrita.

### D-034 — os caminhos remotos são derivados no host, não no cliente

> confirmada em 2026-09-02, ao implementar `T-051`.

- O cliente não sabe o `$HOME` do host remoto, e o host é a fonte de verdade
  sobre si mesmo. O script de bootstrap deriva os caminhos de `$HOME` e valida
  remotamente home inválido e limite de endereço de socket.
- Isso colide com `ssh -L <porta>:<socket>`, que exige o caminho no momento em
  que a sessão é criada, e o sshd não expande `~`. A saída é `ControlMaster`:
  uma conexão, uma autenticação, o handshake devolve o `socketPath` efetivo e o
  encaminhamento é acrescentado com `ssh -O forward`. A alternativa recusada era
  uma sessão de sondagem extra só para ler o home.
- A convenção de caminho vive numa tabela de templates única, consumida pelo
  TypeScript e pelo shell, para que as duas metades não possam divergir.

### D-035 — retenção limitada do staging remoto

- `stageRemotePayload` aceita retenção inteira maior ou igual a 1 e usa 2 por
  padrão: a versão ativa e a anterior ficam disponíveis para rollback.
- Depois da ativação atômica, somente diretórios cujo nome é exatamente um
  commit de 40 caracteres hexadecimais são candidatos; a ordem é o tempo de
  modificação, nunca o nome do hash.
- A VPS usa retenção 1 para não acumular builds. Toda remoção recursiva passa
  pela guarda `safe_rm`; a versão recém-ativada é explicitamente excluída. Uma
  falha de poda emite status próprio, mas não desfaz nem invalida a ativação.

### D-036 — a baseline glibc do servidor passa a valer no build

- A baseline adotada é GLIBC 2.28 / GLIBCXX 3.4.25. Ela não é nova: já está em
  `resources/server/bin/helpers/check-requirements-linux.sh`, empacotado dentro
  do próprio servidor, e em `src/vs/server/node/remoteAgentEnvironmentImpl.ts`.
  A decisão é que o build obedeça ao que o produto afirma.
- O build ignorava essa baseline. `.github/workflows/unigma-server-linux-artifact.yml`
  chamava `npm ci` sem nenhuma variável `VSCODE_REMOTE_*`, então o ramo remoto de
  `build/npm/postinstall.ts` apagava `CC`/`CXX` e o node-gyp compilava com o
  compilador e os headers da própria distro do runner.
- A evidência é a execução `33784052687`, que carregou cada `.node` do servidor
  já ativado numa VPS real, com o Node empacotado do próprio servidor:
  `native.addons.checked=8`, `loaded=1`, `rejected=6`. Os addons exigiam
  `GLIBC_2.38`, `GLIBCXX_3.4.31`, `CXXABI_1.3.15` e, no `node-pty`,
  `GLIBC_2.42`. Ficavam mortos `node-pty`, `@vscode/sqlite3`,
  `@parcel/watcher`, `@vscode/spdlog` e `kerberos`; `GET /version` seguia verde
  porque não depende de nenhum deles.
- O `native.glibc.compiler=2.28` do mesmo relatório não contradizia isso: é o
  piso do único componente sadio, o Node baixado de nodejs.org por
  `build/gulpfile.reh.ts`, enquanto os sete addons compilados localmente eram
  silenciosamente mais novos.
- Divergência deliberada do upstream:
  `build/azure-pipelines/linux/verify-glibc-requirements.sh` encerra com erro
  apenas em GLIBC, somente imprime aviso em GLIBCXX e nunca inspeciona CXXABI.
  O gate deste fork falha nos três, porque `@vscode/spdlog` e `kerberos`
  quebraram exatamente em GLIBCXX e CXXABI e passariam por um gate fiel ao
  upstream.
- O gate vive em `build/unigma/verify-server-symbol-baseline.sh` e roda depois de
  `audit-distribution.ts --server` e antes do tar e da publicação, para que um
  artefato em violação não chegue ao depósito de onde os smokes remotos montam o
  par.
- Efeito medido, no mesmo host que expôs o defeito: artefato `33796510313` com 9
  objetos ELF inspecionados e todos dentro da baseline, e smoke `33797399848` com
  `native.modules.loaded=7`, `rejected=0`. O único módulo que segue sem carregar é
  `@vscode/deviceid/build/Release/windows.node`, binário de Windows que não deve
  carregar em Linux. O risco antecipado — gcc 8.5 recusar fontes modernas — não se
  materializou.

### detalhes de D-016 ainda abertos

- fórmula, escala e estimativa do `intelligence index`, com sua comparação ao
  teto `maxModel`;
- pesquisa, fontes, versionamento, evidência e revisão da classificação;
- preços, unidade de custo, configuração verificável, atualização e custos
  ausentes ou ambíguos;
- lista de modelos elegíveis, disponibilidade no OpenCode e mapeamento das
  configurações locais;
- timeout, fallback detalhado e forma de explicitar a chamada adicional, custo e
  privacidade;
- tokens, contraste, estados, foco, teclado e acessibilidade visual do toggle,
  incluindo movimento reduzido.

## decisões que exigem intervenção

As direções D-016 a D-028 estão confirmadas; suas definições operacionais,
patches, artefatos e validações permanecem abertas e não autorizam suporte por si
só. Continuam pendentes de resposta do responsável, sem bloquear a etapa A do
plano de 2026-08-29:

- valor final de `constants::PROTOCOL_VERSION` no CLI após a remoção do Agent
  Host (`Q-1`);
- estratégia de entrega do `unigma-server` ao host remoto (`Q-2`, ver D-028);
- destino do `code tunnel` e das dependências `@microsoft/dev-tunnels-*` (`Q-3`).

## validação de identificadores

| ID | Resultado em 2026-08-22 | Fonte | Consequência |
| --- | --- | --- | --- |
| V-001 | `github.com/unigma` existe e aponta para organização pública “UNIST Enigma”. | GitHub API | não usar como identificador do projeto |
| V-002 | `unigma.com` está registrado até 2027. | Verisign RDAP | não usar sem direito explícito |
| V-003 | npm `unigma` retornou 404; `unigma.dev` retornou 404 no RDAP. | npm Registry, RDAP | disponibilidade não garantida |
| V-004 | GitHub, npm, `unigma-code.com` e `unigma-code.dev` retornaram 404 nas consultas públicas. | GitHub API, npm Registry, RDAP | candidato disponível, sem reserva ou garantia |

## questões técnicas adiadas

As seguintes questões não alteram a arquitetura aprovada e serão determinadas
ao detalhar o MVP: patchset e pipeline do perfil service-only, manifesto e
rollback do bundle, contratos de comportamento da UI, provisionamento SSH,
fontes/suportes concretos de MCP/plugin/provider, baselines numéricos de
performance e os detalhes abertos de D-016. `Cinderblock`
permanece candidata não incorporada e exige verificação de disponibilidade,
licença, pesos e direitos de uso antes de qualquer incorporação.

## regra de atualização

Após cada resposta do responsável, registrar a decisão com data, resposta,
justificativa e documentos afetados; então atualizar os requisitos, fluxos,
modelo de dados, arquitetura e aceitação impactados. Não reabrir decisões sem
evidência ou mudança explícita de escopo.
