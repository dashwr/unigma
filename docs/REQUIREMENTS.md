# unigma — requisitos

## estado e rastreabilidade

Este documento distingue requisitos declarados de requisitos ainda não
definidos. `RQ-*` identifica itens rastreáveis. A coluna **evidência** aponta
para as fontes enumeradas em [PRODUCT.md](PRODUCT.md#fontes-de-referência).

Palavras como “deve” representam apenas requisito quando a origem o sustenta;
não são especificação implícita de implementação.

## requisitos funcionais declarados

| ID | Requisito | Estado | Evidência | Critério associado |
| --- | --- | --- | --- | --- |
| RQ-001 | O produto deve ser um IDE open-source baseado em Code - OSS. | confirmado | S-01 | AC-001, AC-002 |
| RQ-002 | O produto deve integrar profundamente o OpenCode. | confirmado; arquitetura aprovada | S-01, S-04, S-11 | AC-003 |
| RQ-003 | O escopo de produto inclui interação com agentes, sessões, diffs e aprovações. | confirmado; contrato detalhado pendente | S-01, S-11 | AC-004 |
| RQ-004 | O escopo de produto inclui MCP, plugins e regras. | confirmado; política concreta pendente | S-01, S-11 | AC-005 |
| RQ-005 | O escopo de produto inclui subagentes e worktrees. | confirmado; contrato detalhado pendente | S-01, S-11 | AC-006 |
| RQ-006 | O escopo de produto inclui terminal e SSH obrigatório. | confirmado; arquitetura aprovada | S-01, S-11 | AC-007 |
| RQ-007 | O escopo de produto inclui providers abertos, modelos locais e APIs. | confirmado; suporte concreto pendente | S-01, S-11 | AC-008 |
| RQ-008 | O primeiro MVP deve incluir as capacidades declaradas em RQ-002 a RQ-007 e as direções de harness, bundle e agente de RQ-022 a RQ-027; RQ-028 permanece uma capacidade interna dormente, não uma superfície ativa. | confirmado; arquitetura aprovada | S-06, S-11, S-18 | AC-003 a AC-008 e AC-025 a AC-027 |
| RQ-009 | A interface deve usar inglês como idioma padrão e oferecer pacote de idioma `pt-BR`. | confirmado; mecanismo pendente | S-06 | AC-010 |
| RQ-010 | A identidade visual deve usar roxo como cor predominante, com destaques magenta/violeta e temas que a apliquem sobre fundos branco, lilás, preto e roxo-escuro. | confirmado; reinterpretado por D-046 e detalhado por RQ-039 a RQ-043 — “predominante” é predominância na identidade, não em área de tela, e magenta deixa de ser destaque livre | S-06; D-046 e D-048, 2026-09-06 | AC-011, AC-036, AC-037 |
| RQ-011 | A marca deve ser original; não deve copiar elementos identificáveis da identidade visual do OpenCode. | confirmado | S-01, S-06 | AC-012 |
| RQ-012 | O primeiro MVP deve atender Windows x64 e Linux x64. | confirmado | S-08 | AC-013 |
| RQ-013 | OpenCode deve ser o runtime primário de agente, integrado nativamente à experiência do IDE. | confirmado; arquitetura aprovada | S-09, S-11 | AC-014 |
| RQ-014 | O desktop deve priorizar uso eficiente de memória e responsividade, com regressões verificadas por medição reproduzível. | confirmado; metas numéricas pendentes de baseline | S-09 | AC-015 |
| RQ-015 | Modelos configurados e localmente autorizados pelo OpenCode devem ser classificados por um `intelligence index` aproximado, apoiado por pesquisa/evidência versionada; o índice não é verdade universal e não deve produzir catálogo remoto. | direção confirmada; evidência e contrato pendentes | S-17 | pendente (AC a definir) |
| RQ-016 | Quando aplicável, cada tarefa deve receber uma estimativa do índice necessário; o roteador deve selecionar o modelo elegível de menor custo, segundo configuração verificável, que atinja o índice e respeite o teto explícito de `maxModel`. `maxModel` não é ranking universal e `~49` é apenas ilustrativo, não normativo. | direção confirmada; fórmula, custos e contrato pendentes | S-17 | pendente (AC a definir) |
| RQ-017 | `Autopilot!` deve ser um toggle opt-in: desligado usa o modelo selecionado sem roteamento; ligado permite roteamento antes de cada prompt. | confirmado; contrato de UI pendente | S-17 | pendente (AC a definir) |
| RQ-018 | Quando `persistSelectedModel` estiver ativado, o roteador não deve ser executado antes do prompt e o modelo selecionado deve ser mantido. | confirmado; contrato operacional pendente | S-17 | pendente (AC a definir) |
| RQ-019 | Quando configurado e disponível no OpenCode, o roteador deve usar `Luna medium` sem contexto, sem pensamento longo e somente com saída estruturada curta; não deve depender de credenciais ou endpoints ocultos. | direção confirmada; disponibilidade e contrato pendentes | S-17 | pendente (AC a definir) |
| RQ-020 | Em erro ou timeout do roteamento, o produto deve retornar com segurança ao modelo selecionado; a chamada adicional, seu custo e suas implicações de privacidade devem ser explícitos, e prompts, raciocínio e segredos não devem ser registrados. | direção confirmada; timeout, divulgação e logging pendentes | S-17 | pendente (AC a definir) |
| RQ-021 | O toggle deve aparecer mais escuro quando desligado e usar a cor principal do tema quando ligado; o estado ligado deve usar movimento sutil quando a preferência de movimento reduzido não o impedir, deve respeitar essa preferência e não usar animação excessiva. | direção confirmada; tokens e acessibilidade visual pendentes | S-17 | pendente (AC a definir) |
| RQ-022 | OpenCode deve ser o único harness/backend local oficial do produto, consumido pelo bundle `unigma+opencode` com o release upstream fixado ou com o perfil opcional `service-only` conforme D-026; Codex e Claude Code não são harnesses oficiais. | direção confirmada; bundle e suporte pendentes | S-18 | AC-025 |
| RQ-023 | Quando o perfil opcional `service-only` for selecionado, ele deve preservar o harness de execução e remover ou redirecionar TUI, onboarding, prompts interativos, navegação e UI redundante para o unigma. | direção confirmada para o perfil opcional; patch pendente | S-18 | AC-025 |
| RQ-024 | Na trilha opcional `service-only`, o decepador deve transformar um commit upstream em um artefato versionado por uma cadeia reproduzível de patch, testes, auditoria e manifesto de proveniência. | direção confirmada para o perfil opcional; pipeline pendente | S-18 | AC-026 |
| RQ-025 | Atualizações autorizadas do bundle devem ser atômicas, ocorrer com o processo parado ou após reinício explícito, permitir rollback e preservar os dados do usuário fora do artefato. | direção confirmada; implementação e evidência pendentes | S-18 | AC-026 |
| RQ-026 | A superfície nativa do agente deve oferecer `@` para ferramentas e `/` para skills, sem acesso direto da UI a processo, rede ou segredos. | direção confirmada; contrato da UI pendente | S-18 | AC-027 |
| RQ-027 | O produto deve permitir mensagens entre sessões locais e apresentar chips de agentes/subagentes com estados `thinking`, `typing` e `idle`, mantendo o OpenCode como fonte de verdade. | direção confirmada; ciclo de vida e renderização pendentes | S-18 | AC-027 |
| RQ-028 | O protocolo de controle remoto pode ser construído e versionado de forma dormente, mas não deve ativar listener, cloud, colaboração em tempo real ou backend no MVP. | direção confirmada; protocolo e testes pendentes | S-18 | AC-028 |
| RQ-029 | Contexto deve usar anexos explícitos de arquivos/seleções com origem e versão, documentos e busca sob demanda via OpenCode, sem índice próprio persistente. | contrato escrito e limites aprovados; implementação e prova pendentes | D-038, 2026-09-05; D-041 e `CONTEXT-CONTRACT.md`, 2026-09-06 | AC-030 |
| RQ-030 | Tarefas de edição devem ter direção de worktree isolado e revisão antes de integrar no checkout principal, sem prometer undo seguro sobre alterações concorrentes. | contrato escrito; base, dirty e integração especificadas; implementação e prova pendentes | D-039, 2026-09-05; D-042 e `WORKTREE-CONTRACT.md`, 2026-09-06 | AC-031 |
| RQ-031 | Subagentes de leitura devem preceder escritores isolados, mantendo OpenCode como único harness e sem segundo scheduler. | contrato escrito; implementação e prova pendentes | D-040, 2026-09-05; `PROJECTIONS-CONTRACT.md`, 2026-09-06 | AC-032 |
| RQ-032 | O par autorizado para prova é `openrouter` com `nvidia/nemotron-3.5-lightning:free`, pelo ID exato, sem alias e sem fallback no código. Se o modelo sair do catálogo, a resposta é uma decisão nova, não um segundo candidato. | par definido; um envio respondido provado no runner; suporte a provider continua não anunciado | D-043, 2026-09-06 | AC-003, AC-008, AC-033 |
| RQ-033 | A credencial do provider deve permanecer fora do produto: criada pelo responsável como secret do repositório, entregue ao ambiente do runner e atravessando para o WSL por `WSLENV`, nunca por `argv` nem escrita pelo produto. | confirmado; provado no run `34052368433` (`source: "env"`) | D-043, 2026-09-06 | AC-033 |
| RQ-034 | `connected` em `/provider` não deve ser tratado como prova de credencial válida; somente um prompt respondido prova. Recusa do provider, inclusive falha de quota de tier gratuito, deve ser categoria de erro própria e observável, distinta de defeito do produto. | confirmado; a distinção está no relatório do smoke, mas a categoria de recusa ainda não foi exercitada em run real | D-043, 2026-09-06; `OPENCODE-COMPATIBILITY.md` | AC-033 |
| RQ-035 | O painel do agente deve ter regiões fixas e sempre na mesma ordem — cabeçalho, atenção, trabalho, transcrição, composição —, com regiões vazias colapsando e nada mudando de lugar conforme o estado. | direção confirmada; implementação não autorizada | D-047, 2026-09-06; `AGENT-UX-DRAFT.md` | AC-034 |
| RQ-036 | Pergunta pendente deve desabilitar a composição e oferecer a saída dentro da própria pergunta: além das opções enviadas pelo agente, `digitar` (texto livre) e `cancelar` sempre como as **duas últimas** opções, por posição relativa e não por índice fixo. | direção confirmada; implementação não autorizada | D-047, 2026-09-06; `AGENT-UX-DRAFT.md` | AC-034 |
| RQ-037 | O marcador de todo deve ser um quadrado com um quadrado menor dentro para feito, e é marcador de estado, não controle: sem clique, sem foco de teclado e sem estado próprio no unigma, porque não há endpoint de escrita de todo nem `id` para endereçar um item. | direção confirmada com ressalva registrada em D-047: se a intenção era um controle clicável, a decisão precisa voltar | D-047, 2026-09-06; `AGENT-UX-DRAFT.md` | AC-034 |
| RQ-038 | Sessão filha deve expandir no lugar, dentro da região de trabalho; não deve haver painel por sessão filha nesta etapa. | direção confirmada; implementação não autorizada | D-047, 2026-09-06; `PROJECTIONS-CONTRACT.md` | AC-034, AC-032 |
| RQ-039 | O campo deve ser neutro: roxo e magenta aparecem em realce, nunca como área. O violeta `#8b5cf6` da célula ativa da marca é a mesma cor de ativo e foco na interface; magenta é cor de estado — erro, atenção e permissão pendente — e não segundo acento de marca. | direção confirmada; tokens propostos em revisão; correção dos arquivos de tema autorizada por D-048 | D-046 e D-048, 2026-09-06; `VISUAL-IDENTITY-DRAFT.md`, `THEME-PALETTE-DRAFT.md` | AC-011, AC-036 |
| RQ-040 | Grade, micro-tipografia, dithering e brilho ficam nas superfícies de marca (splash, Welcome, About, ícone, site). Editor e painéis recebem só paleta e geometria, com uma exceção: barra de status e painel do agente podem carregar micro-rótulo, e somente com fato verificável — commit, versão fixada, run id, modelo que respondeu. Número não medido não aparece. | direção confirmada; implementação não autorizada | D-046, 2026-09-06; `VISUAL-IDENTITY-DRAFT.md` | AC-037 |
| RQ-041 | A matriz de temas deve ter cinco arquivos: quatro temas de paleta — branco, lilás, preto (padrão) e roxo-escuro — mais o de alto contraste, que fica à parte por ser acessibilidade. O auditor de contraste deve conhecer os cinco nomes; tema que o auditor não conhece não é auditado, o que é pior do que tema que falha. | direção confirmada; D-048 autoriza o recorte de arquivos de tema e auditor, e só ele | D-048, 2026-09-06; `THEME-PALETTE-DRAFT.md` | AC-036 |
| RQ-042 | A seleção do editor deve clarear em roxo (`#6b57b8` / `#7059c4`) e não em magenta. O limiar de luminância de seleção (`>= 0.1`) não deve ser baixado para acomodar preferência estética: a correção é a cor, não a guarda. | direção confirmada; correção autorizada por D-048 | D-048, 2026-09-06; `build/unigma/verify-theme-contrast.ts` | AC-036 |
| RQ-043 | A semântica de cor deve ter três níveis legíveis sem leitura: âmbar avisa, magenta interrompe (erro e atenção), roxo indica foco. O contraste do âmbar é decidido pelo auditor, não pela intenção. | direção confirmada; contraste não auditado sobre pacote | D-048, 2026-09-06; `THEME-PALETTE-DRAFT.md` | AC-036 |

Os requisitos RQ-015 a RQ-028 registram direção confirmada, não implementação;
os critérios associados só passam com evidência reproduzível.

RQ-032 a RQ-043 decorrem de D-043 e D-046 a D-048, todas de 2026-09-06. Salvo
o recorte explicitamente autorizado por D-048 — os arquivos de tema e o auditor
de contraste —, nenhuma delas autoriza implementação; definem contrato. RQ-032
a RQ-034 são o único bloco com prova de runner associada, e ela cobre um par
respondendo a um prompt, não suporte a provider.

D-044 (rascunho legal proposto antes da decisão) e D-045 (transporte do cliente
Windows investigado antes de escolher) **não geram requisito novo**: a primeira
autoriza produzir um rascunho `[EM REVISÃO]` sem afirmar clearance, e a segunda
autoriza levantar alternativas e adiar a escolha. Ambas são disciplina de
processo; o requisito nascerá da decisão seguinte, quando houver uma.

RQ-029–031 também são direção, não implementação. D-026 mantém a poda
service-only opcional e fora do caminho crítico da integração básica: RQ-023–024
descrevem essa trilha específica, RQ-025 governa atualizações do bundle
selecionado, e nenhum deles obriga bloquear o uso do bundle upstream.
Há implementações parciais de UI, router e pipeline; o estado vivo está em
`status/WORKBENCH.md`, e não deve ser inferido da palavra “pendente” nesta tabela.

## requisitos de restrição

| ID | Requisito | Estado | Evidência | Critério associado |
| --- | --- | --- | --- | --- |
| RQ-101 | O derivado não deve reutilizar marca, ícones, binários oficiais, endpoints/chaves Microsoft nem Visual Studio Marketplace como se fossem direitos do projeto. | confirmado | S-01, S-03 | AC-002 |
| RQ-102 | O projeto deve preservar licença, copyrights e avisos de terceiros aplicáveis ao código incorporado. | confirmado | S-01, S-02 | AC-001 |
| RQ-103 | Integrações não devem usar extração de credenciais, caches OAuth, interceptação de tráfego ou bypass de entitlement. | confirmado | S-01 | AC-009 |
| RQ-104 | Integrações devem se limitar a APIs autorizadas, modelos locais e interfaces documentadas. | confirmado | S-01, S-04, S-05 | AC-009 |
| RQ-105 | O core não deve criar catálogo, carregador ou adaptador oficial para extensões externas de Codex/Claude Code; essas extensões podem ser instaladas pelo usuário, mas ficam fora do suporte do unigma. | confirmado em 2026-08-26 | S-18 | AC-029 |

## não requisitos

| ID | Declaração | Estado | Evidência |
| --- | --- | --- | --- |
| NR-001 | Browser agent não é parte do escopo inicial. | confirmado como fase posterior | S-01 |
| NR-002 | Cloud/agendador não é parte do escopo inicial. | confirmado como fase posterior | S-01 |
| NR-003 | Colaboração em tempo real não é parte do escopo inicial. | confirmado como fase posterior | S-01 |

## requisitos ainda não definidos

Os requisitos declarados acima não autorizam inferir os seguintes detalhes, que
continuam sem especificação ou evidência suficiente:

- aceite do patchset/pipeline/manifesto existentes, cadência operacional de
  atualização e release do bundle `unigma+opencode`;
- fontes e integrações MCP/plugins permitidas, providers/modelos suportados e
  política de dados específica de cada provider;
- granularidade de sessões, diffs, aprovações, subagentes e worktrees;
- semântica detalhada dos atalhos `@`/`/`, mensagens intersessão, chips de estado
  e compatibilidade do protocolo remoto dormente;
- compatibilidade e provisionamento SSH, baselines numéricos de performance e
  detalhes de release, assinatura e atualização;
- fórmula, escala e estimativa do `intelligence index`, além da regra de
  comparação com o teto `maxModel`;
- fontes, pesquisa, versionamento, evidência e revisão da classificação dos
  modelos;
- preços, unidade de custo, configuração verificável, atualização e tratamento
  de custos ausentes ou ambíguos;
- lista de modelos elegíveis, disponibilidade no OpenCode e mapeamento de
  configurações locais;
- timeout, fallback, divulgação de chamada adicional e política de privacidade
  observável para o roteador;
- tokens, contraste, estados, foco, teclado e demais critérios de acessibilidade
  visual do toggle, inclusive movimento reduzido.

O marco inicial e as plataformas foram definidos por RQ-008 e RQ-012.

Essas lacunas estão detalhadas em [DECISIONS.md](DECISIONS.md).

## questões abertas

D-038–040 resultam da reabertura explícita das decisões em 2026-09-05. A direção
aprovada mantém a fronteira local-first e harness único. Continuam abertos os
contratos de anexos/sintaxe, worktree/base dirty/integração e projeções do harness;
fast/deep não foi aprovado. A fila em `PROXIMAS-TAREFAS.md` distingue definição
de contrato de implementação. Lacunas não autorizam ampliar o escopo.
