# unigma — critérios de aceitação

## estado deste documento

Os critérios abaixo são objetivos, mas só podem ser executados quando houver
um artefato de implementação. Eles verificam os requisitos declarados; não
criam comportamento adicional.

RQ-015 a RQ-021 e D-016 registram direção de produto para Intelligence Index e
Autopilot, não suporte implementado. Os recortes de domínio e testes de T-086 a
T-092 já existem, mas as linhas AC-016 a AC-024 permanecem bloqueadas até haver
integração E2E e evidência reproduzível; nenhum exemplo numérico, inclusive
`~49`, é um valor fixo ou normativo.

RQ-022 a RQ-028, RQ-105 e D-017 a D-022 registram a direção de harness, bundle e
capacidades do agente. O bundle Linux com OpenCode `1.18.23` já existe e passa
por saúde/listagem de sessões, mas as linhas AC-025 a AC-028 permanecem
bloqueadas até haver artefato compatível com o critério, testes e evidência de suporte correspondentes;
patchset, pipeline e auditoria implementados não equivalem a bundle
`service-only` aceito. AC-029 registra uma fronteira de suporte, não uma
capacidade adicional do runtime.

| ID | Relacionado a | Critério objetivo e testável | Estado de execução |
| --- | --- | --- | --- |
| AC-001 | RQ-001, RQ-102 | Para toda distribuição que incorpore código de Code - OSS, a revisão de entrega confirma a presença dos avisos, licenças e copyrights aplicáveis. | bloqueado: os artefatos finais preservam os notices conhecidos, mas o inventário completo de terceiros/licenças e a classificação do escopo root ainda estão pendentes; o escopo root atual registra 695 entradas `manifest-only` e os sete avisos de licença são falso positivo do parser |
| AC-002 | RQ-001, RQ-101 | A revisão de identidade e artefatos de distribuição não encontra marca, ícones, binários oficiais, endpoints/chaves Microsoft ou uso do Visual Studio Marketplace sem direito documentado. | parcial/bloqueado: os dois pacotes finais têm metadados próprios, gallery nula e não contêm as quatro extensões externas nem caminhos de Copilot/MSAL; a revisão ampla de referências upstream e direitos ainda não terminou |
| AC-003 | RQ-002, RQ-032 | Em um ambiente de teste, o IDE inicia uma interação com o CLI `opencode serve` por HTTP/SSE documentados e apresenta um resultado ou erro observável ao usuário. | parcial/bloqueado: histórico — o smoke de pacote (`33721970575`) comprovou saúde e listagem de sessões contra o bundle Linux com OpenCode `1.18.23`. Em 2026-09-06 o run `34052368433` (head `9c1e09fa`, `smoke=pass`, 17 checks) somou a primeira prova de envio real: `check.prompt-answered=pass`, `answer=answered`, com o par de D-043 contra o binário fixado `1.18.23`. **Isso prova um envio respondido, não a interação da UI**: resultado/erro observável na superfície nativa, streaming parcial, cancelamento e permissão continuam sem prova |
| AC-004 | RQ-003 | A especificação de implementação define e o teste demonstra: criação/retomada de sessão, apresentação de diff e uma ação explícita de aprovação ou rejeição. | parcial/bloqueado: contrato T-010, superfícies nativas de sessão/diff/aprovação e a ligação inicial do runtime existem e têm testes de recorte; retomada de conteúdo, prompt real e teste integrado E2E continuam pendentes |
| AC-005 | RQ-004 | A especificação de implementação identifica as integrações MCP/plugin/regra aceitas e o teste demonstra carregamento ou recusa conforme essa política. | parcial/bloqueado: workbench classifica MCP instalado/permitido, a bridge de produção workbench↔extension host é serializável e os smokes confirmam gate obrigatório antes de `ProcessManager.ensureStarted()`; o inventário de plugin/regra foi conectado em `072d55f6` e `sourceInventoryComplete` passou a refletir a enumeração real; a suíte compilada do runtime passou nos runs finais, mas falta evidência contra OpenCode real com plugins instalados |
| AC-006 | RQ-005 | A especificação de implementação define e o teste demonstra o ciclo de vida de um subagente ou worktree suportado. | bloqueado: contrato T-010 cobre a mensagem; ciclo de vida e teste integrado ausentes |
| AC-007 | RQ-006 | A especificação de implementação define o fluxo SSH suportado e um teste estabelece ou recusa a conexão conforme a política definida. | parcial/bloqueado: transporte, staging e ativação têm smoke no runner com payload real e confirmação fail-closed, o resolver devolve `ResolvedAuthority` e **a primeira janela remota abriu contra a VPS externa** (`unigma-remote-window-smoke` run `33949936848`, commit `493dcfe7`, doze checks, resolver em 725 ms e handshake do extension host em 261 ms, registrado em `EVIDENCE.md`); falta o resto da matriz — sessão, queda de conexão e reconexão —, e uma janela que abre não é um caminho que se recupera. **2026-09-07, causa do recorte de sessão:** ele não podia funcionar. `build/gulpfile.reh.ts` não empacota OpenCode, e o payload de staging entrega o binário como `<appRoot>/bin/opencode`, enquanto o resolver do runtime só conhecia `<appRoot>/opencode/bin/opencode` e caía para o `PATH`, onde o extension host remoto recebe apenas `<appRoot>/bin/remote-cli`. Corrigido em `18644365` com teste; **condição necessária, não prova**, e este critério não se move por isso. Provar exige driver no host, decisão sobre credencial remota e novo par staged — ver `status/2026-09-06-remote-runtime-handoff.md` |
| AC-008 | RQ-007, RQ-032, RQ-033, RQ-034 | A especificação de implementação enumera providers/modelos suportados e testes demonstram a seleção de ao menos uma integração aprovada. | parcial: T-011/T-042 descobrem e sanitizam providers/modelos; D-043 autorizou o par `openrouter` / `nvidia/nemotron-3.5-lightning:free` pelo ID exato, e o run `34052368433` provou esse par respondendo a um prompt (`check.prompt-answered=pass`) contra o binário fixado `1.18.23`. **Um par provado não é suporte a provider**, e `openrouter` continua não anunciado como suportado: streaming parcial, cancelamento, permissão, diff, recuperação de SSE e versão incompatível seguem sem prova, e nenhum segundo par foi verificado. O critério permanece bloqueado enquanto “enumera providers/modelos suportados” não tiver mais do que uma linha provada |
| AC-009 | RQ-103, RQ-104 | Revisão de código, configuração e documentação não encontra coleta/extração de tokens ou caches OAuth, interceptação de tráfego nem bypass de entitlement; integrações apontam apenas a meios autorizados/documentados. | bloqueado: o slice possui fronteiras/redaction estruturais, mas a revisão integrada e a evidência reproduzível ainda não foram executadas |
| AC-010 | RQ-009 | Em uma distribuição de teste, a interface inicia em inglês e o pacote `pt-BR` pode ser instalado ou ativado pelo mecanismo documentado. | bloqueado: mecanismo pendente |
| AC-011 | RQ-010, RQ-039 | A especificação de tokens define valores verificáveis para roxo, magenta, violeta e cada fundo declarado; a revisão visual de cada tema confirma o uso exclusivo desses tokens para a identidade. | parcial/bloqueado: histórico — `unigma Dark`, `unigma Light` e `unigma High Contrast` existem, são contribuídos por `theme-unigma` e tiveram contraste verificado **localmente** por `build/unigma/verify-theme-contrast.ts`. Auditor rodando local não é prova. D-046 e D-048 mudaram o alvo. A divergência que existia — `focusBorder` magenta em `unigma-dark.json` e `unigma-high-contrast.json`, `editor.selectionBackground` magenta em ambos — foi **corrigida em `b7ce8b3f`**, e a matriz passou a ser de cinco arquivos com o auditor derivando a lista do manifesto. Falta a revisão visual humana e a execução do auditor sobre o pacote no runner; ver AC-036 |
| AC-012 | RQ-011 | A identidade distribuída não deve copiar deliberadamente elementos identificáveis do OpenCode. | bloqueado; escopo ajustado por D-030: não é gate formal de entrega, mas preservar direitos, copyright, licenças e notices aplicáveis continua exigido. D-046 **não move esta linha**: a proveniência por SHA-256 em `resources/unigma/BRANDING-PROVENANCE.md` registra hash e derivação, e não é concessão de licença, atribuição de autoria, afirmação de originalidade, clearance de marca nem avaliação de colisão. **Contradição aberta, descoberta em 2026-09-06:** `resources/unigma/README.md` e `BRANDING-PROVENANCE.md` afirmam que os ativos seguem impedidos de release público até `AC-012` fechar; `D-030` diz que o responsável **não exige** prova formal de autoria/proveniência nem clearance de marca para liberar o produto FOSS. As duas afirmações não podem valer juntas. Não resolvida pelo executor: decidir se `AC-012` bloqueia release é do responsável |
| AC-013 | RQ-012 | A entrega do MVP fornece artefatos de teste ou distribuição para Windows x64 e Linux x64; a mesma suíte mínima de inicialização é executada com sucesso em ambas as plataformas. | passou no recorte de núcleo: os runs finais `32930950550` (Windows x64) e `32929454545` (Linux x64), head `838ca94e`, publicaram artefatos e executaram a mesma suíte de smoke; o smoke exclui `Terminal Profiles`, `Chat` e `Agents Window` por escopo declarado |
| AC-014 | RQ-013 | Em ambiente de teste, o painel de agente é contribuição nativa do workbench e inicia/controla uma sessão OpenCode sem exigir que o usuário opere uma ferramenta de agente separada. | parcial/bloqueado: contribuição nativa, superfície de sessão/streaming/diff/aprovação e ligação inicial do runtime existem; compile e teste browser focado passaram, mas sessão/controle integrado, prompt real, matriz oficial e runner ainda não estão comprovados |
| AC-015 | RQ-014 | O pipeline mede tempo de inicialização e RSS por processo em perfil limpo, idle e sessão ativa; cada regressão é comparada ao baseline versionado da mesma plataforma. | bloqueado: o medidor existe e o run `33950524239` executou a etapa, mas `--status` retornou `Version`/`OS Version`/`CPUs` sem `Process Info`, indicando ausência de instância viva; não há baseline numérico válido |
| AC-016 | RQ-015, RQ-016, RQ-017, RQ-018, RQ-020 | **Direção documental:** o contrato/configuração versionado do router separa Autopilot, modelo selecionado, `persistSelectedModel`, `routerModel`, `maxModel`, referências de índice/custo, bypass, timeout, fallback e privacidade. **Implementação real:** o runtime valida versão e campos, produz decisão/evento observável, respeita trust e política do OpenCode e não registra prompt, raciocínio ou segredo. | bloqueado: T-086 implementou contrato/schema local versionado e testes de validação; decisão/evento no runtime integrado e evidência E2E continuam pendentes, em especial por provider/modelo não autorizado |
| AC-017 | RQ-015, RQ-016 | **Direção documental:** o `intelligence index` e o custo têm fonte, versão, proveniência, unidade, revisão e tratamento de ausência/ambiguidade; o índice é aproximado, não é ranking universal e não cria catálogo remoto. `~49` permanece ilustrativo. **Implementação real:** somente referência local explícita e compatível é carregada; dados insuficientes são recusados sem inventar ranking, sincronizar catálogo ou registrar prompt, raciocínio ou segredo. | bloqueado: T-087 implementou carregamento/validação de índice e custo local e seus testes; integração com a seleção/router e evidência E2E permanecem pendentes, sem fixar valores ou ranking |
| AC-018 | RQ-019 | **Direção documental:** quando configurado e disponível, `Luna medium` é chamado sem contexto adicional de sessão, workspace ou histórico, sem pensamento longo e com schema curto, sem endpoint ou credencial oculta. **Implementação real:** fixture/integração controlada comprova payload mínimo e saída validada, com falha observável e nenhum log de prompt, raciocínio ou segredo. | bloqueado: o domínio e os testes do recorte T-088 existem, mas chamada/payload contra OpenCode real, disponibilidade e falha observável continuam sem E2E; provider/modelo autorizado ainda não foi definido |
| AC-019 | RQ-016 | **Direção documental:** a seleção compara somente modelos configurados/autorizados, exige índice suficiente, aplica o teto explícito de `maxModel` e usa custo comparável; `maxModel` não é ranking universal nem valor numérico fixo. **Implementação real:** teste determinístico escolhe o modelo elegível de menor custo e recusa dados ausentes/ambíguos, sem autoescalada e sem log de prompt, raciocínio ou segredo. | bloqueado: T-089 implementou o seletor determinístico e testes de domínio; falta costura E2E com índice, router, provider/modelo autorizado e OpenCode real |
| AC-020 | RQ-017, RQ-018, RQ-020 | **Direção documental:** Autopilot desligado e `persistSelectedModel` fazem bypass; erro, indisponibilidade, privacidade restritiva, ausência de candidato e timeout retornam ao `selectedModel` validado, com chamada adicional, custo e implicação de privacidade explícitos, sem contornar trust, aprovação, política ou entitlement. **Implementação real:** testes demonstram timeout limitado, fallback seguro/observável ou erro bloqueante quando o modelo selecionado não é válido, sem retry ilimitado e sem log de prompt, raciocínio ou segredo. | bloqueado: T-090 implementou o plano de bypass/fallback/timeout/privacidade e testes de domínio; matriz integrada e E2E com provider/modelo autorizado continuam ausentes |
| AC-021 | RQ-017, RQ-021 | **Direção documental:** a UI nativa especifica toggle opt-in, estados desligado/pronto/roteando/selecionado/bypass/fallback/timeout/erro/bloqueado, foco, teclado, nome acessível, contraste, estado desligado mais escuro, ligado na cor principal e `prefers-reduced-motion`. **Implementação real:** a contribuição do workbench renderiza os estados sem Webview ou acesso direto a rede/processo, respeita movimento reduzido e fornece evidência renderizada do build/teste real quando a UI existir. | parcial/bloqueado: T-091 implementou a redução dos estados e teste de `prefers-reduced-motion`; a superfície renderizada, foco, nome acessível, contraste e evidência visual continuam pendentes |
| AC-022 | RQ-015, RQ-016, RQ-018, RQ-019, RQ-020 | **Direção documental:** a matriz separa testes unitários, de contrato, recusas, redaction e limites de privacidade. **Implementação real:** o harness existente executa testes determinísticos para schema/versão, índice/custo, payload curto Luna, seleção, bypass, fallback e timeout, sem segundo runner e sem log de prompt, raciocínio ou segredo. | bloqueado: T-092 implementou a matriz e os testes determinísticos do domínio/harness; execução integrada/E2E, provider/modelo real e evidência final continuam pendentes |
| AC-023 | RQ-015, RQ-016, RQ-017, RQ-018, RQ-019, RQ-020, RQ-021 | **Direção documental:** a integração define cenários controlados e métrica versionada para custo/latência da chamada adicional e do modelo final, distinguindo estimativa local de cobrança e proibindo telemetria. **Implementação real:** IDE/runtime/OpenCode controlados demonstram bypass, roteamento, fallback e timeout, com métricas e referências permitidas, nenhum prompt/raciocínio/segredo em artefatos e evidência renderizada quando a UI existir. | bloqueado: T-093 é frente futura; não há integração, métricas ou evidência renderizada |
| AC-024 | RQ-015, RQ-016, RQ-017, RQ-018, RQ-019, RQ-020, RQ-021, RQ-103, RQ-104 | **Direção documental:** a revisão final separa direção, implementação, suporte testado e lacunas. **Implementação real:** a revisão de código, configuração, logs, testes e artefatos confirma fallback seguro, privacidade explícita, nenhum bypass de autorização e nenhum log de prompt, raciocínio ou segredo; qualquer lacuna bloqueia a aceitação e exige evidência renderizada real quando houver UI. | bloqueado: T-094 é frente futura; nenhuma revisão ou evidência final foi executada |
| AC-025 | RQ-022, RQ-023 | **Direção documental:** a matriz identifica `unigma+opencode` como único harness oficial, preserva o harness de execução do OpenCode e redireciona as superfícies service-only para o unigma. **Implementação real:** o artefato empacotado inicia o perfil service-only, sem TUI/onboarding/UI redundante no caminho oficial, e mantém o fluxo HTTP/SSE exigido. | parcial/bloqueado: o bundle Linux executável com OpenCode `1.18.23` inicia pelo pacote e passou saúde/listagem de sessões no run `33721970575`; T-096/T-097/T-098/T-099 implementaram gates da trilha, mas não há artefato `service-only` aceito nem validação completa de suporte |
| AC-026 | RQ-024, RQ-025 | **Direção documental:** o decepador registra upstream, patchset, hashes, testes, auditoria e manifesto; a atualização troca o bundle atomicamente, permite rollback e não toca os dados do usuário. **Implementação real:** dois artefatos versionados demonstram build reproduzível, rejeição de candidato inválido, troca com processo parado, rollback e preservação de configuração/credenciais/sessões. | parcial/bloqueado: T-096 tem patchset/aplicador, T-097 input/proveniência do pipeline, T-098 troca/rollback e T-099 auditoria implementados; faltam dois artefatos `service-only` versionados e a evidência de suporte correspondente |
| AC-027 | RQ-026, RQ-027 | **Direção documental:** o contrato nativo define `@` para ferramentas, `/` para skills, mensagens entre sessões locais e chips `thinking`/`typing`/`idle`, com OpenCode como fonte de verdade. **Implementação real:** testes de UI/runtime demonstram resolução, troca de mensagens, ciclo de vida e acessibilidade sem Webview, rede ou processo na UI. | parcial/bloqueado: T-043 implementou parser/catálogo transitório e consulta a `/command`/`/skill` com testes; T-044, mensagens intersessão, chips e a evidência integrada de UI/runtime continuam pendentes |
| AC-028 | RQ-028 | **Direção documental:** o protocolo remoto é versionado e explicitamente dormente. **Implementação real:** testes demonstram serialização/validação dos tipos e inspeção do artefato confirma ausência de listener, cloud, sincronização, colaboração ativa e backend próprio. | parcial/bloqueado: T-045 implementou protocolo versionado dormente e testes de serialização/recusa; falta inspeção de artefato e evidência final da ausência de ativação |
| AC-029 | RQ-105 | A revisão do core e do artefato confirma ausência de adaptador, catálogo ou carregador oficial para Codex/Claude Code; extensões externas instaladas pelo usuário são identificadas como fora do suporte, e `unigma+pi` como experimental. | direção confirmada; revisão de artefato ainda não executada |

## regra de aprovação

### direção aprovada em 2026-09-05 — critérios ainda bloqueados

| ID | Relacionado a | Critério objetivo e testável | Estado de execução |
| --- | --- | --- | --- |
| AC-030 | RQ-029, D-038 | Contrato aprovado e teste integrado demonstram anexos com origem/versão/seleção, limites, recusa de drift e scoping local/remoto; busca sob demanda sem índice próprio, conteúdo fora dos logs e nenhuma redefinição implícita de `@`/`/`. | bloqueado: contrato escrito em 2026-09-06 (`CONTEXT-CONTRACT.md`) e em revisão; implementação e prova de runner pendentes |
| AC-031 | RQ-030, D-039 | Contrato aprovado e cenário Git reproduzível demonstram isolamento, base e tratamento explícito de dirty/untracked, revisão antes de integrar e recusa de conflitos; sem copiar/commitar/limpar automaticamente nem prometer undo concorrente seguro. | bloqueado: contrato escrito em 2026-09-06 (`WORKTREE-CONTRACT.md`) e em revisão; implementação e prova de runner pendentes |
| AC-032 | RQ-031, D-040 | Contra binário fixado, UI/runtime projetam estado de tarefas/perguntas/sessões filhas e recuperação HTTP; perguntas não viram permissões; subagentes de leitura precedem escritores, estes condicionados a AC-031; sem segundo scheduler ou histórico paralelo. | bloqueado: contrato escrito em 2026-09-06 (`PROJECTIONS-CONTRACT.md`) e em revisão; implementação e prova de runner pendentes |
| AC-033 | RQ-032, RQ-033, RQ-034, D-043 | Contra o binário fixado e no runner, o par autorizado responde a um prompt real com `check.prompt-answered=pass`; a credencial vem do ambiente (`source: "env"`), atravessa por `WSLENV` sem aparecer em `argv` e não é escrita pelo produto; recusa do provider, inclusive quota, é reportada como categoria de erro própria e distinta de defeito do produto; `connected` em `/provider` não é aceito como prova. | parcial, com prova citada: o run `34052368433` (head `9c1e09fa`, `unigma-linux-wsl-validation.yml`, `smoke=pass`, 17 checks) passou `check.provider-source-environment`, `check.model-authorized-present` e `check.prompt-answered`, com `answer=answered`, provider `openrouter` e modelo `nvidia/nemotron-3.5-lightning:free` contra `1.18.23`. A armadilha do `connected` foi medida antes e está escrita no próprio relatório. **Ainda sem prova:** a categoria `refused-by-provider` nunca foi exercitada num run real, e o prompt usado é trivial e não toca o repositório — ele exercita a credencial, não o modelo |
| AC-034 | RQ-035, RQ-036, RQ-037, RQ-038, D-047 | O painel renderiza as regiões na ordem fixa cabeçalho/atenção/trabalho/transcrição/composição, com regiões vazias colapsando; pergunta pendente desabilita a composição e apresenta `digitar` e `cancelar` como as duas últimas opções por posição relativa, quaisquer que sejam as opções do agente; o marcador de todo é quadrado com quadrado menor para feito e não recebe clique nem foco de teclado; sessão filha expande no lugar, sem painel por filha. Teste de UI/runtime demonstra cada um sem Webview, rede ou processo na UI. | bloqueado: D-047 define desenho e **não autoriza implementação**; `AGENT-UX-DRAFT.md` está `[EM REVISÃO]`. Nada foi implementado, e a natureza não interativa do marcador de todo é leitura do executor registrada em D-047, sujeita a correção — se a intenção era um controle clicável, este critério muda antes de qualquer prova |
| AC-035 | RQ-039, RQ-040, D-046 | A revisão da superfície confirma campo neutro com roxo e magenta apenas em realce, `#8b5cf6` como cor de ativo e foco, magenta restrito a estado (erro, atenção, permissão pendente), e expressão de marca — grade, micro-tipografia, dithering, brilho — apenas nas superfícies de marca. Micro-rótulo aparece somente na barra de status e no painel do agente e somente com fato verificável: commit, versão fixada, run id ou modelo que respondeu; número não medido não aparece. | bloqueado: direção aprovada em 2026-09-06; a revisão da superfície renderizada não foi executada e a correção dos arquivos de tema, autorizada apenas no recorte de D-048, ainda não tem prova de pacote |
| AC-036 | RQ-041, RQ-042, RQ-043, D-048 | `build/unigma/verify-theme-contrast.ts` é executado **sobre o pacote, no runner**, cobrindo os cinco arquivos — branco, lilás, preto (padrão), roxo-escuro e alto contraste — e passa; nenhum dos cinco fica fora da auditoria por nome desconhecido; a seleção do editor usa roxo e satisfaz o limiar de luminância `>= 0.1` sem que o limiar tenha sido baixado; âmbar de aviso passa o contraste medido pelo auditor. | bloqueado: D-048 autoriza este recorte de implementação — arquivos de tema e auditor — e nada além dele. Hoje existem três arquivos, não cinco, e o auditor é escrito sobre exatamente esses três nomes (`verify-theme-contrast.ts:116`). **O auditor de contraste passar localmente não fecha `T-034`**: a prova exigida é a execução sobre o pacote no runner, e ela não existe |
| AC-037 | RQ-010, RQ-040, D-046 | A revisão dos artefatos de marca distribuídos confirma que o conjunto empacotado é o lockup e os ícones de `resources/unigma/`, que os arquivos exploratórios `unigma-cipher*` e `unigma-wordmark.png` não entram em pacote, e que todo micro-rótulo exibido corresponde a um fato verificável do próprio artefato. | bloqueado: a exclusão dos exploratórios e a correspondência dos micro-rótulos não foram verificadas contra um pacote. Este critério é sobre o que é empacotado; ele **não** substitui AC-012, que continua bloqueado por autoria, direitos, originalidade e clearance |

### direção aprovada em 2026-09-06 — D-043 e D-046 a D-048

AC-033 a AC-037 acompanham as decisões de 2026-09-06 e estão na tabela acima,
junto de AC-030 a AC-032, para não criar um terceiro lugar de status.

AC-033 é a única linha desta série com prova de runner citada, e ela é parcial:
o run `34052368433` prova **um par respondendo**, não suporte a provider — por
isso AC-008 continua bloqueado e AC-003 continua parcial.

AC-034, AC-035 e AC-037 nascem bloqueados por construção: D-046 e D-047 definem
desenho e dizem explicitamente que não autorizam implementação. AC-036 é a única
exceção, porque D-048 autorizou o recorte dos arquivos de tema e do auditor — e
mesmo ela exige o auditor executado sobre o pacote no runner, não localmente.

D-044 e D-045 não geram critério novo: a primeira autoriza um rascunho legal
`[EM REVISÃO]` que não afirma clearance, e a segunda autoriza levantar
alternativas de transporte Windows sem escolher. Não há o que aceitar até a
decisão seguinte.

Esses critérios não fecham por aprovação da direção. Sua inclusão na matriz
não dispensa o gate específico nem torna service-only obrigatório para a trilha
básica (D-026).

Um critério só passa com evidência reproduzível (teste automatizado, passo de
reprodução registrado ou revisão de artefato). A documentação isolada não prova
um critério; o estado aprovado de AC-013 depende dos runs e artefatos registrados
abaixo.

Para AC-016 a AC-029, direção documental é somente a especificação das tarefas
correspondentes e nunca substitui execução. A evidência deve demonstrar fallback seguro,
ausência de log de prompt, raciocínio e segredo e, quando houver UI, o estado
renderizado no build/teste real; captura de uma especificação ou mock isolado não
aprova a integração.

## plano de fechamento de E-00/E-01

O gate técnico de E-00 já passou nos runs Linux/Windows registrados abaixo. A
próxima rodada não deve repetir smoke sem causa: deve fechar os bloqueios
restantes com evidência específica.

### E-00

- `AC-001`: executar o auditor completo de notices e publicar inventário de
  terceiros sem lacunas não decididas;
- `AC-002`: classificar referências upstream residuais, metadados e superfícies
  excluídas nos artefatos finais;
- `AC-012`: registrar titularidade/autorização e revisão de originalidade e não
  colisão dos ativos finais;
- `AC-013`: manter a aprovação técnica já registrada após o último commit de
  código.

### E-01

- `T-010`: produzir `DuplicateRequestId`/`SessionNotFound` no handler RPC real;
  a suíte compilada do workbench/runtime já passou no runner, mas a produção
  semântica desses erros ainda está pendente;
- `T-011`: manter a release OpenCode `1.18.23` fixada, verificar binários por
  SHA-256 e preservar o probe de health, `/doc`, `/path`, SSE, sessão e
  incompatibilidade; provider/modelo suportado e prompt real continuam
  pendentes;
- `T-012`: integrar preflight de trust/origem/configuração/aprovação para MCP,
  plugin e regra, com decisão sanitizada obrigatória nas duas rotas de startup,
  bridge serializável e recusas de instalação automática, path escape e segredo;
  MCP está conectado no workbench e o inventário de plugin/regra foi ligado ao
  preflight em `072d55f6`; a suíte compilada passou no runner, mas a evidência
  contra um OpenCode real com plugins/regras instalados permanece pendente;
- `T-013`: executar a matriz SSH contratual e manter transporte remoto em E-05,
  salvo ambiente remoto autorizado para o gate funcional.

O fechamento contratual de E-01 libera o avanço de E-02/E-03 sem converter
fixture em suporte publicado. O plano completo está em
[`planos/2026-08-26-e00-e01.md`](planos/2026-08-26-e00-e01.md).

### barreiras rígidas da rodada 2026-08-26

O plano operacional em [`planos/2026-08-26-e00-e01.md`](planos/2026-08-26-e00-e01.md) substitui
paralelismo implícito por barreiras explícitas:

1. E00-A, E01-A/T-010, E01-B/T-011 e E01-D/T-013;
2. E00-B e E01-C/T-012, somente após a conclusão da onda 1;
3. E01-E, com a consolidação da evidência e builds Linux/Windows sequenciais.

Nenhum critério passa por causa do plano; cada aceite continua exigindo evidência
reproduzível.

## evidência pré-aceite da E-00

Os itens datados desta seção são registros históricos; esta evidência registra
trabalho executado e só converte um critério quando a saída reproduzível
correspondente está registrada:

- o snapshot Code - OSS, a tag, o SHA, Node/Electron e os alvos foram registrados;
- `LICENSE.txt`, `ThirdPartyNotices.txt`, `product.json`, README e revisão inicial
  de terceiros foram inspecionados;
- parsing de JSON, identidade de distribuição, configuração vazia de
  Copilot/entitlement/voz/CDN, onboarding externo e padrões óbvios de segredo
  passaram na revisão estática do checkout; essa verificação não prova ausência
  de extensões upstream no artefato;
- `npm ci` root/build, `typecheck-client`, `eslint`, `stylelint` e
  `test-build-scripts` passaram no checkout local `E:\unigma`; essa instalação
  com `--ignore-scripts` não completa a árvore nested;
- o upstream orquestra dependências nested pelo `npm install` no root, por meio
  de `preinstall`/`postinstall` em `package.json`, `build/npm/dirs.ts` e
  `build/npm/postinstall.ts`;
- em um ciclo controlado anterior, `compile-client` foi executado no checkout
  local e bloqueou em dependência nested `esbuild` de extensão upstream;
- `compile-client` é o menor compile sem Copilot. A tentativa oficial não foi
  feita porque requer toolchain nativo e ficou bloqueada por
  `MSB8040`/bibliotecas Spectre;
- a tentativa controlada mais recente, com dependências parciais, parou em
  `extensions/github-authentication` por tipos `mocha`/`node` ausentes;
- houve muitos ciclos limitados de dependência nested; a caça incremental foi
  encerrada;
- `test-node` emitiu erro de módulo ausente em `out/` e, portanto, não fornece
  evidência válida de aprovação;
- a execução `32896363977`, no commit `061fc48a`, executou no runner
  `WIREDNEOMKII` o `npm ci`, compile da extensão própria, checks focados,
  empacotamento Windows x64 e smoke do núcleo; todos passaram e o artefato foi
  publicado como `unigma-windows-x64-32896363977`.
- a evidência do artefato registra `platform=windows-x64`,
  `smoke=passed` e `runtime-tests=passed`; o JUnit registra 93 testes, zero
  falhas e 30 ignorados.
- a execução `32916035363`, no commit `24464056`, executou no runner
  `WIREDNEOMKII` o workflow `.github/workflows/unigma-linux-wsl-validation.yml`
  dentro do Ubuntu WSL2; `npm ci`, compile da extensão própria, empacotamento
  `vscode-linux-x64`, smoke e escrita/upload da evidência passaram, publicando
  `unigma-linux-x64-32916035363`.
- a evidência Linux registra `target=linux-x64`, `build-environment=Ubuntu WSL2`,
  `smoke=passed` e `runtime-tests=passed`; o artefato tar.xz foi criado a partir
  do diretório de pacote validado pelo workflow.
- o smoke dessa execução excluiu explicitamente `Terminal Profiles`, `Chat` e
  `Agents Window`; isso é escopo declarado de núcleo, não evidência dessas
  capacidades nem prova de que todas as extensões upstream estejam ausentes do
  pacote.
- a API do GitHub confirmou o artefato `unigma-linux-x64-32916035363`, id
  `9588657070`, com `186066342` bytes. O download foi repetido com timeout de
  300 segundos e terminou com exit code `0`; o wrapper continha o tar, a
  evidência e logs de smoke, e o tar tinha `185507784` bytes.
- a evidência baixada registra o commit
  `2446405698011bef1fd1947f5459b1a64e79781e`, alvo `linux-x64`, runner
  `WIREDNEOMKII`, Ubuntu WSL2, `smoke=passed` e `runtime-tests=passed`.
- dentro do tar Linux, `./resources/app/LICENSE.txt` e o notice raiz estão
  presentes. Seus SHA-256 coincidem com os arquivos do checkout:
  `LICENSE.txt` =
  `cce33203a80863c22499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236` e
  `ThirdPartyNotices.txt` =
  `51b3fd6b279f33c324ba7d32ed9f8849bb51cc2d7c61eaf13c2e8eba5efdd523`.
  Há também três notices de extensões no tar.
- o `product.json` empacotado mantém `unigma` como identidade, MIT, sem
  `extensionsGallery`, feeds, report URL ou voz; porém o `package.json`
  empacotado ainda declara `author.name=Microsoft Corporation` e o repositório
  `https://github.com/microsoft/vscode.git`. O pacote registra versão `1.135.0`,
  compatível com a ressalva de versão interna em `docs/UPSTREAM.md`, mas os
  metadados de autoria/proveniência precisam ser corrigidos ou justificados.
- fora dos logs, o inventário de caminhos do tar encontrou zero caminho de
  Copilot, mas 27 caminhos GitHub, 13 de `microsoft-authentication` e dois
  binários MSAL. Isso não prova ativação, mas prova que as superfícies de
  autenticação foram empacotadas e exigem decisão explícita para o MVP
  local-first.
- o wrapper contém logs de smoke, inclusive arquivos nomeados para autenticação;
  uma varredura local de 427 arquivos/1177 linhas JSON não encontrou chaves de
  autorização, literais Bearer ou valores de access/refresh token. O wrapper de
  CI não deve ser tratado como pacote de distribuição.
- os PNGs de `resources/unigma/` são transparentes e têm dimensões documentadas
  no README, mas a revisão de direitos/originalidade dos ativos ainda não está
  evidenciada; essas mudanças do usuário continuam fora do stage.
- `audit-notices.ts` não produziu relatório neste checkout: o import gerado
  `./parse-notices.js` não existe, só há `parse-notices.ts`, e não há `tsx`
  instalado. O bloqueio foi registrado sem instalar ferramenta ou baixar
  licenças.
- foi tentado um cross-build Linux x64 no runner Windows `WIREDNEOMKII` pela
  workflow `unigma-linux-cross-validation.yml`: no run `32901756829`, os
  probes confirmaram WSL e Docker indisponíveis, enquanto `npm ci` e o compile
  do runtime passaram; o bundle esbuild Linux terminou com `The service was
  stopped`, sem artefato. O rerun do job foi cancelado durante `npm ci` e
  também não produziu artefato. Cross-build em host Windows não é evidência de
  build ou smoke Linux reproduzível.
- a workflow manual `.github/workflows/unigma-self-hosted-validation.yml` foi publicada
  com `runs-on: self-hosted`; a execução `32841175404` não passou do bootstrap do
  Visual Studio (`setup.exe` retornou `-1`) e a execução diagnóstica
  `32841731686` confirmou que o processo do runner não é elevado para instalar as
  bibliotecas Spectre. Nenhum `npm ci`, build, artefato ou smoke foi executado;
  o bloqueio foi mantido por decisão explícita.

### atualização final desta rodada

- o commit `5efc250d` adicionou o auditor `build/unigma/audit-distribution.ts`,
  sem dependências que valida layout, identidade, MIT, URL, metadados próprios,
  gallery nula, hashes de licença/notices, notices de extensão e extensões
  proibidas; o commit `838ca94e` corrigiu o último erro de tipo encontrado no
  compile completo da view nativa;
- o run Linux `32929454545`, head `838ca94e`, passou `npm ci`, compile do
  runtime, testes do runtime, `vscode-linux-x64`, auditoria, smoke e upload.
  O artefato `unigma-linux-x64-32929454545` (id `9593106630`) tem
  `183856993` bytes;
- o tar Linux final tem `2598` membros, nenhuma das quatro extensões proibidas,
  zero caminhos de Copilot/MSAL/Azure/`microsoft-authentication`, e hashes
  iguais ao checkout: `LICENSE.txt` =
  `cce33203a80863c22499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236` e
  `ThirdPartyNotices.txt` =
  `51b3fd6b279f33c324ba7d32ed9f8849bb51cc2d7c61eaf13c2e8eba5efdd523`;
- o run Windows `32930950550`, head `838ca94e`, passou pré-requisitos,
  `npm ci`, testes do runtime, `typecheck-client`, `test-build-scripts`,
  `vscode-win32-x64`, auditoria, smoke e upload. O artefato
  `unigma-windows-x64-32930950550` (id `9593599662`) tem `255329029` bytes;
- o ZIP Windows final tem `2171` membros, nenhuma das quatro extensões
  proibidas, hashes de licença/notices iguais ao checkout e os ativos
  `code.ico`, `code_70x70.png` e `code_150x150.png` idênticos às fontes
  versionadas;
- os dois artefatos finais têm `product.json` com identidade `unigma`, MIT,
  URL pública, `extensionsGallery=null`, e `package.json` com autor,
  repositório e bugs próprios. Os logs publicados pelo wrapper não são pacote
  de distribuição.

Portanto, a E-00 tem o gate técnico de build, pacote, auditoria e smoke
reproduzido nos dois alvos, mas permanece parcialmente concluída: AC-001 ainda
exige inventário completo de terceiros/licenças e AC-012 exige revisão
independente de autoria, direitos e não colisão da marca. AC-003 a AC-008 têm
contratos e recortes de implementação, mas continuam bloqueados por integração,
provider/modelo quando aplicável e evidência integrada; AC-009 a AC-012 e
AC-014/AC-015 continuam bloqueados conforme cada linha acima; AC-013 está
atendido apenas no recorte de núcleo explicitado nesta evidência.

## evidência pré-aceite da E-01

Os itens desta seção são registro histórico da revisão inicial dos contratos; não
reescrevem as atualizações posteriores e não convertem critérios em aceitos:

- T-010 tem contrato implementado e validado estruturalmente: define versão,
  comandos, eventos, estados, erros e `requestId`; a validação de fronteira
  rejeita payloads incompatíveis e campos fora do contrato, sem manter estado de
  sessão ou unicidade de IDs;
- os testes de T-010 cobrem os formatos de comando/evento, payloads incompatíveis
  e campos fora do contrato; `DuplicateRequestId` e `SessionNotFound` são
  verificados somente como códigos presentes em eventos de erro estruturalmente
  válidos, não como erros produzidos pelo runtime;
- a produção semântica de `DuplicateRequestId` e `SessionNotFound`, com os testes
  correspondentes da camada de aplicação, permanece pendente em E-02, em
  especial T-024;
- T-011 tem evidência de probe real contra `/usr/bin/opencode` `1.18.23`
  (SHA-256 `f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f`):
  health, OpenAPI 3.1, `/path`, SSE, sessão, prompt e abort passaram;
  `OpenCodeHttpClient.connect()` real também passou; nenhum provider/modelo é
  anunciado como suportado; a suíte-fonte ainda está
  bloqueada pela ausência de `mocha`;
- T-021/T-022/T-023 têm adapters e fixtures locais provisórios no checkout, com
  testes fonte para processo, HTTP/SSE, persistência mínima, redaction e
  composição; o compile da extensão e o `npm --prefix
  extensions/unigma-agent-runtime test` passaram nos dois runs finais. A fixture
  não é evidência contra um binário OpenCode real e não altera o estado
  condicional de T-011;
- T-012 define fontes explícitas, gates de trust/aprovação, recusa e redaction,
  sem catálogo, instalação ou persistência própria; o workbench classifica MCP e
  as rotas de runtime exigem decisão sanitizada antes de `ProcessManager.ensureStarted()`;
  plugin/regra ainda não têm fontes conectadas;
- T-013 é especificação documental condicional: define a matriz contratual,
  OpenSSH/`known_hosts`, limites de provisionamento, falhas e reconexão, sem
  executar conexão ou bootstrap remoto.
- com Node portátil `24.18.0`, o typecheck equivalente a `typecheck-client`, o
  ESLint focado nos dois arquivos TypeScript e um smoke direto do protocolo
  passaram; o harness Mocha não foi executado porque os módulos compilados em
  `out/` não existem.
- no runner self-hosted, o head `838ca94e` passou `typecheck-client`,
  `test-build-scripts` e os testes compilados da extensão própria; isso valida o
  harness do runtime, não integração com OpenCode, provider, MCP/plugin ou SSH
  reais.

Os contratos e documentos da E-01 continuam especificações condicionais; T-010
tem validação estrutural, código de aplicação compilado e suíte dedicada do
workbench/runtime executada no runner. Teste integrado contra OpenCode real,
produção dos erros na camada de aplicação, SSH completo e evidência de segurança
permanecem obrigatórios nas tarefas posteriores.

## pendências

Os critérios AC-003 a AC-008 têm arquitetura, contratos e recortes de
implementação, mas requerem integração e evidência reproduzível; AC-008 também
requer uma combinação provider/modelo efetivamente autorizada e testada.

Atualização de 2026-09-06: essa combinação passou a existir para **um par**.
`openrouter` / `nvidia/nemotron-3.5-lightning:free` respondeu a um prompt real
no run `34052368433`. A frase acima não fica satisfeita por isso: AC-008 pede
enumeração de providers/modelos suportados e demonstração de seleção, e um par
respondendo a um prompt trivial não cobre streaming parcial, cancelamento,
permissão, diff, recuperação de SSE nem versão incompatível.

AC-016 a AC-024 correspondem à direção confirmada de RQ-015 a RQ-021, e AC-025 a
AC-029 à direção de RQ-022 a RQ-028/RQ-105. Os recortes de domínio e testes de
T-086 a T-092 existem, mas os critérios continuam bloqueados por integração E2E,
provider/modelo e evidência final, conforme cada linha. T-096 a T-099 também têm
patchset, pipeline, troca/rollback e auditoria implementados, sem converter isso
em aceite do perfil `service-only`. A direção não fixa a fórmula ou os valores
do índice/custo, não transforma `~49` em limite, não cria catálogo remoto, não
autoriza telemetria ou persistência de prompt/raciocínio/segredo e não transforma
o probe OpenCode em suporte do bundle.
