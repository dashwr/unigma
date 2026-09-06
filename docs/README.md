# documentação do unigma

Este arquivo é o mapa da documentação. O estado atual fica em
[`status/WORKBENCH.md`](status/WORKBENCH.md); não procure o foco da sessão em um
plano histórico ou em um prompt antigo.

## ordem de leitura

[PROXIMAS-TAREFAS.md](PROXIMAS-TAREFAS.md) é a fila operacional permanente:
ordem, dependências, condições de parada e mapa de todos os itens abertos do board.
[INDEX.md](INDEX.md) é a entrada curta, sem segundo catálogo concorrente.
O confronto das seis fontes está em
[referências oficiais](planos/2026-09-05-referencias-oficiais.md); as escolhas
humanas aprovadas estão em D-038–040, não nas alternativas da pesquisa. As
decisões mais recentes são `D-043`–`D-048`, de 2026-09-06.

Proposta em revisão: [experiência nativa Cursor × OpenCode](planos/2026-09-05-cursor-opencode.md)
(`DOC-CURSOR-001`). Confronta o levantamento externo com contratos e embates;
não altera decisões nem autoriza implementação.

1. [`status/WORKBENCH.md`](status/WORKBENCH.md) — foco, tarefas, fase, estado,
   próximo passo e bloqueios atuais;
2. [`../AGENTS.md`](../AGENTS.md) — regras persistentes do projeto;
3. [`BACKLOG.md`](BACKLOG.md) — épicos, tarefas, dependências e aceite esperado;
4. documentos normativos de produto e arquitetura;
5. contratos especializados e, por último, planos/fontes da frente em questão.

## onde o projeto está (2026-09-06)

Descrição, não anúncio. Nada abaixo declara suporte, disponibilidade ou release.

- Existe uma build Linux x64 utilizável com OpenCode `1.18.23` embarcado, com
  smoke de pacote provado no runner. Windows x64 e a matriz remota completa
  continuam sem prova.
- `D-043` autorizou **um** par provider/modelo — `openrouter` com
  `nvidia/nemotron-3.5-lightning:free` — e o run `34052368433` provou esse par
  respondendo a um prompt. **Um par provado não é suporte a provider**;
  `AC-003`, `AC-008` e `AC-033` seguem parciais.
- `D-046`, `D-047` e `D-048` fecharam o desenho de identidade, painel do agente
  e matriz de temas. Só `D-048` autoriza implementação, e apenas dos arquivos de
  tema e do auditor de contraste.
- Branding: o logotipo e o wordmark já estão no repositório e integrados ao
  empacotamento, com proveniência por SHA-256. **`AC-012` continua bloqueado** e
  os ativos seguem impedidos de release público — ver
  [`status/BRANDING-CLEARANCE.md`](status/BRANDING-CLEARANCE.md).
- Legal: existe rascunho em revisão; `T-002` e `T-004` continuam abertos.
- Windows sem `ControlMaster`: opções levantadas, escolha não feita, `T-056` sem
  implementação autorizada.

## documentos de desenho e rascunho em revisão

Todos marcados `[EM REVISÃO]`; definem desenho ou registram opções e, salvo o
recorte liberado por `D-048`, não autorizam implementação:

- [`AGENT-UX-DRAFT.md`](AGENT-UX-DRAFT.md) — interação do painel do agente (`D-047`);
- [`VISUAL-IDENTITY-DRAFT.md`](VISUAL-IDENTITY-DRAFT.md) — leitura das referências e uso da identidade (`D-046`);
- [`THEME-PALETTE-DRAFT.md`](THEME-PALETTE-DRAFT.md) — paleta dos quatro temas e semânticas de cor (`D-046`, `D-048`);
- [`LEGAL-DRAFT.md`](LEGAL-DRAFT.md) — `NOTICE`, `LICENSE` e política de cabeçalho propostos (`D-044`);
- [`WINDOWS-TRANSPORT.md`](WINDOWS-TRANSPORT.md) — opções de transporte do cliente Windows (`D-045`).

## fontes e autoridade

| camada | localização | função |
| --- | --- | --- |
| instruções do projeto | [`../AGENTS.md`](../AGENTS.md) | fronteiras, segurança, toolchain e comandos que todo agente deve respeitar |
| núcleo normativo | `PRODUCT.md`, `REQUIREMENTS.md`, `FLOWS.md`, `DATA-MODEL.md`, `ARCHITECTURE.md`, `DECISIONS.md` | o que o produto é e quais decisões foram aprovadas |
| aceite e execução | `ACCEPTANCE.md`, `BACKLOG.md` | evidência exigida e trabalho implementável |
| quadro vivo | [`status/WORKBENCH.md`](status/WORKBENCH.md) | onde cada frente está e qual é a próxima ação |
| histórico/evidência | [`status/`](status/) | registros datados, auditorias e bloqueios; não substitui o quadro vivo |
| contratos de direção | `CONTEXT-CONTRACT.md`, `WORKTREE-CONTRACT.md`, `PROJECTIONS-CONTRACT.md` | contratos escritos sob `D-038`–`D-040` em 2026-09-06, ancorados no `/doc` do binário fixado. Definem o que implementar e o que provar; não implementam nem fecham `AC-030`–`AC-032` |
| desenho e rascunhos | `AGENT-UX-DRAFT.md`, `VISUAL-IDENTITY-DRAFT.md`, `THEME-PALETTE-DRAFT.md`, `LEGAL-DRAFT.md`, `WINDOWS-TRANSPORT.md` | documentos `[EM REVISÃO]` escritos sob `D-044`–`D-048` em 2026-09-06. Definem desenho ou registram opções; só `D-048` autoriza implementação, e apenas de arquivos de tema e do auditor de contraste |
| planos/propostas | [`planos/`](planos/) | sequência de execução ou proposta ainda não normativa. Plano de ondas vigente: [`2026-08-28-ondas-refundacao.md`](planos/2026-08-28-ondas-refundacao.md); frente ativa hoje: [`2026-08-29-cli-ssh-remoto.md`](planos/2026-08-29-cli-ssh-remoto.md), que emenda no plano de ondas entre a onda 1 e a onda 2. O anterior [`2026-08-27-e00-e03-ondas.md`](planos/2026-08-27-e00-e03-ondas.md) é histórico |
| fontes brutas | [`fontes/`](fontes/) | material recebido; preservar sem edição e derivar fatos para os documentos acima |
| board | Trello `PROJETO UNIGMA` (https://trello.com/b/uotAHk20) | **somente nomes**. Um item marcado significa entregue com evidência reproduzível; aceite formal é item `AC-XXX` próprio. Como executar, critério de pronto e comando de verificação vivem em `BACKLOG.md`, nunca no cartão |

`DECISIONS.md` vence uma proposta ou plano em caso de divergência. Nenhum
documento de status, fixture ou mock promove uma capacidade a suporte; isso exige
evidência reproduzível em `ACCEPTANCE.md`.

## workflow adaptado do modelo de tarefas

O PDF em [`fontes/MODELO-DE-TAREFAS.pdf`](fontes/MODELO-DE-TAREFAS.pdf) é uma
fonte de processo, não uma especificação do unigma. No OpenCode, as dezesseis
etapas ficam assim:

```text
01 fontes recebidas       -> docs/fontes/ (imutáveis)
02 discovery              -> leitura e lacunas, sem código
03 documentação inicial   -> núcleo normativo
04 decisões               -> responsável decide; registrar em DECISIONS
05 arquitetura            -> proposta e gate humano de aprovação
06 consolidação           -> documentos consistentes
07 instruções do projeto  -> AGENTS.md
08 backlog                -> BACKLOG.md + dependências
09 implementação          -> Lead + subagentes sem conflito de arquivos
10 verificação            -> QA + security + final review
11 correção               -> responsável pelo módulo corrige findings
12 regressão              -> repetir cenários afetados e critérios
13 release candidate      -> testes, checks, build e auditoria
14 aprovação              -> autorização humana
15 deploy                 -> somente quando existir e for autorizado
16 documentação final     -> status, backlog, aceite e runbook atualizados
```

Para bug ou mudança pequena, comece na etapa necessária; não repita discovery
sem motivo. Nunca acelere pulando entendimento: acelere paralelizando execução
independente.

## regra da workbench

- Toda solicitação com mais de um resultado recebe uma linha por tarefa no
  `WORKBENCH.md`, mesmo que o trabalho continue no mesmo prompt.
- Cada linha deve ter `id`, escopo, fase do workflow, estado, responsável lógico,
  dependências, próximo passo verificável e fonte da decisão.
- Existe um único `foco atual`; mudar de tarefa exige atualizar o foco e deixar a
  tarefa anterior em `review`, `blocked`, `done` ou outro estado explícito.
- Um plano novo só é criado quando a frente atravessa sessões ou precisa de
  sequência própria; ele deve ser ligado ao quadro e não repetir o backlog.
- `done` só é permitido depois de implementação, verificação independente,
  regressão aplicável e documentação da evidência. Deploy sempre tem gate humano.
