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
| RQ-010 | A identidade visual deve usar roxo como cor predominante, com destaques magenta/violeta e temas que a apliquem sobre fundos branco, lilás, preto e roxo-escuro. | confirmado; tokens pendentes | S-06 | AC-011 |
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
| RQ-022 | OpenCode deve ser o único harness/backend local oficial do produto, distribuído no bundle `unigma+opencode`; Codex e Claude Code não são harnesses oficiais. | direção confirmada; bundle e suporte pendentes | S-18 | AC-025 |
| RQ-023 | O perfil bundled do OpenCode deve ser `service-only`, preservando o harness de execução e removendo ou redirecionando TUI, onboarding, prompts interativos, navegação e UI redundante para o unigma. | direção confirmada; patch pendente | S-18 | AC-025 |
| RQ-024 | O decepador deve transformar um commit upstream em um artefato versionado por uma cadeia reproduzível de patch, testes, auditoria e manifesto de proveniência. | direção confirmada; pipeline pendente | S-18 | AC-026 |
| RQ-025 | Atualizações autorizadas do bundle devem ser atômicas, ocorrer com o processo parado ou após reinício explícito, permitir rollback e preservar os dados do usuário fora do artefato. | direção confirmada; implementação e evidência pendentes | S-18 | AC-026 |
| RQ-026 | A superfície nativa do agente deve oferecer `@` para ferramentas e `/` para skills, sem acesso direto da UI a processo, rede ou segredos. | direção confirmada; contrato da UI pendente | S-18 | AC-027 |
| RQ-027 | O produto deve permitir mensagens entre sessões locais e apresentar chips de agentes/subagentes com estados `thinking`, `typing` e `idle`, mantendo o OpenCode como fonte de verdade. | direção confirmada; ciclo de vida e renderização pendentes | S-18 | AC-027 |
| RQ-028 | O protocolo de controle remoto pode ser construído e versionado de forma dormente, mas não deve ativar listener, cloud, colaboração em tempo real ou backend no MVP. | direção confirmada; protocolo e testes pendentes | S-18 | AC-028 |

Os requisitos RQ-015 a RQ-028 registram direção confirmada, não implementação;
os critérios associados só passam com evidência reproduzível.

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

- patchset, pipeline, manifesto, cadência operacional de atualização e release
  do bundle `unigma+opencode`;
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

Não há questão aberta de arquitetura ou na direção macro de produto: RQ-015 a
RQ-028 registram a direção de roteamento, Autopilot!, harness, bundle e
capacidades do agente. As lacunas restantes são contratos operacionais,
evidência, medição, upstream ou distribuição e não autorizam ampliar o escopo
aprovado.
