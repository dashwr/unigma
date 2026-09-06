# contrato de tarefa isolada em worktree — DOC-WORKTREE-001

> **D-039 / RQ-030 / AC-031.** Escrito em 2026-09-06 contra o `/doc` do artefato
> fixado `1.18.23` (probe registrado em
> [OPENCODE-COMPATIBILITY](OPENCODE-COMPATIBILITY.md)). Define contrato; não
> implementa, não autoriza criar worktree e não fecha `AC-031`. `T-041` reutiliza
> este contrato em vez de escrever outro.

## 1. o fato que muda a justificativa, não a decisão

A matriz de compatibilidade afirmava que “worktree não é endpoint OpenCode”.
O `/doc` de `1.18.23` mostra o contrário:

```text
GET    /experimental/worktree           -> Worktree[]
POST   /experimental/worktree           -> WorktreeCreateInput  { name?, startCommand? }
DELETE /experimental/worktree           -> WorktreeRemoveInput  { directory }
POST   /experimental/worktree/reset     -> WorktreeResetInput   { directory }
eventos: worktree.ready { name, branch? } | worktree.failed { message }
erros:   WorktreeNotGitError | WorktreeNameGenerationFailedError
         WorktreeCreateFailedError | WorktreeStartCommandFailedError
         WorktreeRemoveFailedError | WorktreeResetFailedError | WorktreeListFailedError
```

**Este contrato não usa esses endpoints.** Três motivos, nesta ordem:

1. `/experimental/*` está fora do perfil mínimo por política de T-011, e uma API
   experimental não é base para uma operação destrutiva sobre o trabalho do
   usuário;
2. `WorktreeCreateInput` não aceita **base**: não há `ref`, `commit` nem
   `startPoint`. O servidor escolhe a base. `D-039` exige base explícita, e uma
   API que não a aceita não pode satisfazer o requisito;
3. `startCommand` executa script na criação. Isso é efeito antes de aprovação e
   colide com a fronteira de trust do unigma.

Registrar isso importa porque a exclusão passa a ser **escolha documentada** com
motivo, e não uma ausência que uma leitura futura da API “corrigiria”.

Git continua a fonte de verdade, operado pelo unigma. `GET /experimental/worktree`
pode ser usado apenas como **leitura de diagnóstico**, para detectar worktrees que
o OpenCode conheça e o unigma não; nunca como fonte de estado.

## 2. vocabulário

| termo | definição neste contrato |
| --- | --- |
| tarefa isolada | uma sessão OpenCode cujo diretório é um worktree Git dedicado |
| base | o commit-ish a partir do qual o worktree é criado; sempre explícito |
| principal | o checkout onde o usuário trabalha e para onde a integração aponta |
| integração | trazer o resultado da tarefa para o principal, sob confirmação |
| retenção | por quanto tempo o worktree sobrevive depois de encerrada a tarefa |

## 3. base

- A base é **sempre explícita e registrada** no momento da criação: `HEAD` do
  principal, um branch nomeado ou um commit. Nunca implícita.
- `HEAD` **não contém** mudanças não commitadas. Um worktree criado de `HEAD`
  começa sem o trabalho sujo do principal, e a UI precisa dizer isso antes de
  criar, não depois.
- O branch da tarefa é novo e nomeado por escopo, não por sessão anônima. Um
  branch já existente e já ocupado por outro worktree é recusa, não reuso.
- Base movida depois da criação (o principal avançou) **não** é reconciliada
  automaticamente. Rebase e merge são operações do usuário.

## 4. dirty e untracked no principal

O caso que não pode ser resolvido por inferência. Três comportamentos possíveis,
e o contrato escolhe o terceiro:

| opção | efeito | avaliação |
| --- | --- | --- |
| copiar mudanças sujas para o worktree | tarefa começa com o trabalho em curso | **proibido** por `D-039`: copiar não é isolar, e duplica arquivo sem dono |
| commitar/stash automaticamente no principal | tarefa herda o estado | **proibido**: escreve na história do usuário sem pedir |
| criar limpo a partir da base e **informar** | tarefa começa da base declarada | **adotado** |

Regras derivadas:

- Antes de criar, o unigma reporta a contagem de arquivos modificados e untracked
  do principal que **não** estarão no worktree. A criação exige confirmação com
  esse número à vista.
- Arquivos ignorados pelo `.gitignore` (`node_modules/`, `out*/`, `.build/`) não
  são copiados nem linkados. Um worktree novo não tem árvore de dependências, e
  isso precisa aparecer na UI como pré-requisito da tarefa, não como falha.
- `git stash` nunca é executado pelo unigma.

## 5. localização e escopo

- Worktrees ficam sob um diretório do próprio repositório, fora do controle de
  versão, com nome derivado do escopo da tarefa. Nunca em `/tmp`, nunca fora do
  diretório do usuário, nunca sobre um caminho existente.
- Uma tarefa possui **um** worktree e **uma** sessão OpenCode. A sessão é criada
  com o diretório do worktree, e a autoridade é verificada por `GET /path`
  **antes do primeiro envio**: `directory` precisa ser o worktree.
- Vale a correção do probe: `GET /path` pode devolver `worktree: "/"` quando o
  diretório não é repositório Git. `worktree: "/"` é ausência de repositório e
  bloqueia a tarefa; não é autoridade.
- Continua havendo **um processo OpenCode por extension host**. Worktree separa
  arquivos, não processos: N tarefas isoladas são N sessões no mesmo servidor,
  não N servidores. Isso é o que a prova de localização precisa demonstrar.
- **Worktree não é sandbox.** Um comando executado dentro dele alcança a rede, o
  `$HOME` e o resto do disco. Permissão de ferramenta continua sendo o controle,
  e continua sendo prévia ao efeito.

## 6. revisão antes de integrar

- A revisão acontece **depois** das escritas no worktree e **antes** de qualquer
  operação sobre o principal.
- O diff apresentado é o do worktree contra a base registrada, obtido de Git.
  `GET /session/{id}/diff` do OpenCode pode ser exibido como visão da sessão, mas
  a fonte de verdade da revisão é Git: a sessão pode não ter visto tudo que
  mudou no diretório.
- Revisão não é aprovação de permissão. As duas coisas aparecem em superfícies
  distintas e em momentos distintos.
- Enquanto a revisão está aberta, o unigma não escreve no principal.

## 7. integração

- A operação de integração é **escolha do usuário, por tarefa**, entre merge do
  branch da tarefa e cherry-pick de commits selecionados. O contrato não elege um
  default automático; **essa escolha volta ao humano** e fica registrada em
  `DECISIONS.md` antes da implementação.
- Pré-condições verificadas imediatamente antes: principal limpo o bastante para
  a operação escolhida, branch da tarefa existente, base ainda alcançável.
- Conflito **interrompe** e devolve o controle ao usuário no principal. O unigma
  não resolve conflito, não escolhe lado e não aborta sozinho uma operação que o
  usuário pode querer terminar à mão.
- Falha parcial deixa o worktree intacto. Nunca se limpa nada por causa de uma
  integração que falhou.

## 8. retenção e limpeza

- O worktree sobrevive ao fim da tarefa. Encerrar sessão não remove diretório.
- Remoção é sempre explícita e sempre confirmada, e é recusada quando o worktree
  tem mudanças não commitadas ou untracked — mesmo com confirmação, esse caso
  exige uma segunda decisão consciente, porque é o único ponto do fluxo capaz de
  destruir trabalho que nunca existiu em lugar nenhum.
- Limpeza automática por tempo, por quantidade ou por encerramento da janela é
  **proibida**.
- Undo do editor **não** cobre mudanças concorrentes entre worktrees. O contrato
  não promete undo seguro e a UI não deve sugerir que exista.

## 9. matriz de falhas

| # | cenário | comportamento exigido |
| --- | --- | --- |
| W-01 | diretório não é repositório Git | recusa `worktree.not-a-repo` antes de qualquer escrita |
| W-02 | branch pedido já existe | recusa `worktree.branch-exists`; sem sufixo automático |
| W-03 | branch já usado por outro worktree | recusa `worktree.branch-busy` |
| W-04 | caminho de destino já existe | recusa `worktree.path-exists`; nunca sobrescrever |
| W-05 | principal sujo na criação | permitido, com o aviso quantificado de §4 |
| W-06 | principal sujo na integração | recusa até o usuário resolver; sem stash |
| W-07 | duas tarefas simultâneas | worktrees e branches distintos; nenhum escritor compartilhado; provado com duas sessões concorrentes |
| W-08 | base avançou durante a tarefa | integração informa a divergência; sem rebase automático |
| W-09 | conflito na integração | interrompe, preserva estado, devolve ao usuário |
| W-10 | remoção com mudanças não commitadas | recusa; confirmação extra e explícita para forçar |
| W-11 | cancelamento no meio da criação | reverter apenas o que a própria criação fez; worktree meio-criado é removido, nada além dele |
| W-12 | sessão apontando para worktree removido por fora | sessão bloqueada em `worktree.gone`; sem recriar |
| W-13 | `/path` devolve `directory` fora do worktree | sessão bloqueada; divergência de autoridade não é ajustável |
| W-14 | worktree em autoridade remota | o worktree vive no host da sessão; criar no cliente um worktree para sessão remota é falha de contrato |
| W-15 | retomada após restart do OpenCode | worktree e branch reencontrados por Git, sessão por `GET /session`; nada é reconstruído a partir de estado local |

## 10. prova exigida antes de fechar AC-031

1. cenário Git reproduzível com duas tarefas simultâneas, demonstrando
   isolamento de arquivos e de branch (W-07);
2. criação com principal sujo, mostrando que o worktree não recebeu as mudanças
   e que o aviso quantificado apareceu (W-05);
3. integração com conflito, provando interrupção sem escrita parcial (W-09);
4. tentativa de remoção com trabalho não commitado, provando recusa (W-10);
5. prova de localização: N tarefas, **um** processo `opencode serve`, cada sessão
   com o `directory` do seu worktree conferido por `GET /path`;
6. ausência de qualquer `git stash`, commit ou limpeza automática no log da
   execução.

A prova 5 é a que o `AC-031` mais facilmente aceitaria por engano: contar
sessões não é contar processos.

## 11. decomposição futura

| etapa | escopo |
| --- | --- |
| W-1 | decisão humana de merge × cherry-pick (§7) registrada em `DECISIONS.md` |
| W-2 | serviço Git de worktree no runtime, sem UI, com a matriz de falhas coberta |
| W-3 | ligação sessão↔worktree e verificação de `/path` antes do primeiro envio |
| W-4 | UI de criação, revisão, integração e remoção, com os avisos quantificados |
| W-5 | cenário de runner com as seis provas de §10 |

W-2 não começa antes de W-1.
