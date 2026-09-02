# documentação do unigma

Este arquivo é o mapa da documentação. O estado atual fica em
[`status/WORKBENCH.md`](status/WORKBENCH.md); não procure o foco da sessão em um
plano histórico ou em um prompt antigo.

## ordem de leitura

1. [`status/WORKBENCH.md`](status/WORKBENCH.md) — foco, tarefas, fase, estado,
   próximo passo e bloqueios atuais;
2. [`../AGENTS.md`](../AGENTS.md) — regras persistentes do projeto;
3. [`BACKLOG.md`](BACKLOG.md) — épicos, tarefas, dependências e aceite esperado;
4. documentos normativos de produto e arquitetura;
5. contratos especializados e, por último, planos/fontes da frente em questão.

## fontes e autoridade

| camada | localização | função |
| --- | --- | --- |
| instruções do projeto | [`../AGENTS.md`](../AGENTS.md) | fronteiras, segurança, toolchain e comandos que todo agente deve respeitar |
| núcleo normativo | `PRODUCT.md`, `REQUIREMENTS.md`, `FLOWS.md`, `DATA-MODEL.md`, `ARCHITECTURE.md`, `DECISIONS.md` | o que o produto é e quais decisões foram aprovadas |
| aceite e execução | `ACCEPTANCE.md`, `BACKLOG.md` | evidência exigida e trabalho implementável |
| quadro vivo | [`status/WORKBENCH.md`](status/WORKBENCH.md) | onde cada frente está e qual é a próxima ação |
| histórico/evidência | [`status/`](status/) | registros datados, auditorias e bloqueios; não substitui o quadro vivo |
| planos/propostas | [`planos/`](planos/) | sequência de execução ou proposta ainda não normativa. Plano de ondas vigente: [`2026-08-28-ondas-refundacao.md`](planos/2026-08-28-ondas-refundacao.md); frente ativa hoje: [`2026-08-29-cli-ssh-remoto.md`](planos/2026-08-29-cli-ssh-remoto.md), que emenda no plano de ondas entre a onda 1 e a onda 2. O anterior [`2026-08-27-e00-e03-ondas.md`](planos/2026-08-27-e00-e03-ondas.md) é histórico |
| fontes brutas | [`fontes/`](fontes/) | material recebido; preservar sem edição e derivar fatos para os documentos acima |

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
