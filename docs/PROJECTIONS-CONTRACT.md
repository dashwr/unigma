# contrato de projeções do harness — DOC-PROJECTIONS-001

> **D-040 / RQ-031 / AC-032.** Escrito em 2026-09-06 contra o `/doc` do artefato
> fixado `1.18.23` (probe registrado em
> [OPENCODE-COMPATIBILITY](OPENCODE-COMPATIBILITY.md)). Define contrato; não
> implementa, não amplia o perfil mínimo e não fecha `AC-032`. Detalha `T-041` e
> `T-044` sem autorizar execução.

## 1. o que é uma projeção

Uma projeção é a **exibição, no workbench, de estado que pertence ao OpenCode**.
O unigma não guarda esse estado, não o versiona, não o reordena e não o agenda.
`D-040` mantém o OpenCode como único harness: nenhuma projeção pode virar um
segundo scheduler nem um histórico paralelo.

Três projeções entram neste contrato, nesta ordem de dependência:

1. **todo** — a lista de tarefas que o agente mantém para si;
2. **perguntas** — pedidos de escolha que o agente faz ao usuário;
3. **sessões filhas de leitura** — subagentes que leem e não escrevem.

Escritores isolados vêm depois, e dependem da prova de `AC-031`
([contrato de worktree](WORKTREE-CONTRACT.md)).

## 2. superfície real do binário fixado

### todo

```text
GET /session/{sessionID}/todo   -> Todo[]
Todo { content: string, status: string, priority: string }   // três obrigatórios
evento todo.updated { sessionID, todos: Todo[] }
```

Observações que o contrato precisa absorver:

- `status` e `priority` são **`string` livre no schema**, com os valores apenas
  descritos em prosa (`pending`, `in_progress`, `completed`, `cancelled`;
  `high`, `medium`, `low`). Não são enums. A UI mapeia os valores conhecidos e
  **renderiza o desconhecido como texto**, sem inventar ícone, cor ou ordem.
- Não há `id` em `Todo`. A identidade de um item é a **posição no array**, e o
  evento entrega a lista inteira. Portanto: substituição integral a cada
  `todo.updated`, nunca merge por chave inventada.
- Não há endpoint de escrita de todo. A projeção é **somente leitura**; a UI não
  oferece marcar, reordenar ou adicionar.

### perguntas

O artefato fixado expõe **duas famílias completas**:

```text
GET  /question                              -> QuestionRequest[]
POST /question/{requestID}/reply             { answers: string[][] }
POST /question/{requestID}/reject            -> boolean
GET  /api/session/{sessionID}/question       -> { data: [...] }
POST /api/session/{sessionID}/question/{requestID}/reply
POST /api/session/{sessionID}/question/{requestID}/reject

QuestionRequest { id ^que, sessionID ^ses, questions: QuestionInfo[], tool? }
QuestionInfo    { question, header, options: QuestionOption[], multiple?, custom? }
QuestionOption  { label, description }
QuestionAnswer  = string[]        // labels selecionados
QuestionTool    { messageID, callID }

eventos: question.asked | question.replied | question.rejected
         question.v2.asked | question.v2.replied | question.v2.rejected
```

`QuestionV2Info` e `QuestionInfo` são **estruturalmente idênticos** neste
artefato. Isso corrige a nota de 2026-09-05, que tratava `question.v2.*` como
nome do checkout `dev`: os dois estão no `/doc` do bundle.

Escolha do contrato: **consumir a família sem `v2`** (`/question`,
`question.asked/replied/rejected`), porque é a que a rota de sessão
(`/api/session/{id}/question`) também expõe e a que não carrega sufixo de
migração. As duas famílias são **aceitas na entrada** do parser — ignorar um
`question.v2.asked` que chega significaria travar uma pergunta na tela sem
resposta possível — e ambas são normalizadas para o mesmo tipo interno. A saída
usa sempre a rota sem `v2`. Se um artefato futuro divergir as duas formas, este
parágrafo é o ponto de revisão.

### sessões filhas

```text
GET /session/{sessionID}/children -> Session[]
Session.parentID ^ses
SubtaskPartInput { type: "subtask", prompt, description, agent, model?, command? }
SubtaskPart      { ... mesmos campos, com id/sessionID/messageID }
GET /agent -> Agent[]   // Agent.mode: "subagent" | "primary" | "all"
```

Não há evento próprio de subagente. A relação é `parentID`, e o ciclo de vida
do filho aparece nos mesmos eventos de sessão e mensagem do pai.

## 3. pergunta não é permissão

O ponto que `D-040` e `AC-032` isolam, e que o `/doc` sustenta: são superfícies
separadas no binário.

| | pergunta | permissão |
| --- | --- | --- |
| endpoint | `/question/{id}/reply` \| `/reject` | `/session/{id}/permissions/{permissionID}` |
| corpo | `{ answers: string[][] }` | `{ response: "once" \| "always" \| "reject" }` |
| eventos | `question.asked/replied/rejected` | `permission.asked/replied` |
| efeito de responder | o agente continua com a informação | **um efeito acontece** |
| “sempre” | não existe | `always` existe e persiste |

Regras:

- As duas nunca compartilham componente de UI, nem estilo de botão, nem posição
  na tela. Um usuário que aprendeu a clicar rápido numa deve continuar lendo a
  outra.
- Uma pergunta **nunca** concede permissão, nem quando o texto da opção sugere
  isso. Permissão continua sendo pedida à parte, e continua sendo prévia ao
  efeito.
- Responder pergunta não revalida trust; executar ferramenta revalida.
- Nem pergunta nem permissão são auto-respondidas, e nenhuma das duas é
  restaurada como pendente depois de restart — a regra já vale para permissão em
  T-011 e passa a valer igual para pergunta.

## 4. estado real, não animação

- Um item de todo em `in_progress` reflete o que o OpenCode reportou por
  `todo.updated`, não o fato de existir uma requisição em voo. Spinner que gira
  porque a UI está esperando **não** é estado do agente e não pode ocupar o mesmo
  lugar visual.
- A projeção mostra sempre a que sessão pertence. Todo do filho não se mistura
  com todo do pai.
- Lista vazia é lista vazia, e é assim que se renderiza; não é “carregando”.

## 5. subagentes de leitura antes de escritores

`D-040` fixa a ordem, e este contrato a torna verificável:

- **Fase A — leitura.** Sessão filha criada com `parentID`, projetada como nó
  aninhado sob o pai, com estado e resultado próprios. O conjunto de ferramentas
  do filho é restrito à leitura pelo campo `tools` do `prompt_async` (mapa
  `{ nome: boolean }`) e pelo `agent` escolhido entre os de `mode: "subagent"`.
- **Uma ferramenta de escrita habilitada numa tarefa declarada read-only é falha
  de contrato**, não uma configuração. O runtime recusa o envio antes de chamar
  o binário, e não confia na declaração do agente para isso.
- **Fase B — escritores isolados.** Só depois de `AC-031` provado. Cada escritor
  vive em seu worktree, e nenhum escritor compartilha diretório com outro.
- Subagente **não cria worktree por si**. As duas coisas se combinam na fase B
  por decisão explícita, nunca por efeito colateral de criar um filho.

## 6. recuperação depois de queda do SSE

O perfil não assume replay nem `Last-Event-ID`. Depois de reconectar `/event`:

1. `GET /session/status` para o estado das sessões;
2. `GET /session/{id}/todo` para cada sessão projetada — a lista inteira, que
   substitui a projeção local;
3. `GET /question` para as perguntas pendentes;
4. `GET /session/{id}/children` para a árvore;
5. `GET /session/{id}/message` para reconciliar o transcript.

Regras que a reconexão não pode violar:

- **reconciliar, não descartar.** Uma pergunta que sumiu de `/question` entre a
  queda e a volta foi respondida ou rejeitada por outro caminho; a UI a remove e
  registra, em vez de deixá-la clicável.
- **não reenviar prompt.** SSE cair não é o prompt ter falhado.
- uma pergunta pendente na tela antes da queda só continua clicável se voltar em
  `GET /question` com o mesmo `id`.
- nenhuma dessas respostas é persistida em disco pelo unigma.

## 7. o que o unigma não faz

- não guarda histórico próprio de todo, pergunta ou sessão;
- não agenda, não reordena, não repriorriza, não retenta;
- não cria endpoint de escrita para o que o binário só expõe como leitura;
- não usa `/experimental/*` nem `/tui/*` para nenhuma destas projeções;
- não adapta Claude Code ou Codex, não abre browser agent, não usa backend ou
  cloud — `D-040` mantém a fronteira.

## 8. matriz de falhas

| # | cenário | comportamento exigido |
| --- | --- | --- |
| P-01 | `status`/`priority` desconhecidos em `Todo` | renderizar como texto, sem cor/ícone inventado, sem reordenar |
| P-02 | `todo.updated` com lista menor | substituição integral; itens somem, nada é preservado localmente |
| P-03 | `question.v2.asked` chega | normalizado para o tipo interno; resposta sai pela rota sem `v2` |
| P-04 | resposta a pergunta já respondida | erro do binário exibido; a UI não reenvia nem finge sucesso |
| P-05 | pergunta rejeitada pelo usuário | `POST /reject`; o agente decide o que fazer, a UI não substitui a resposta |
| P-06 | pergunta cuja `options` está vazia | recusa de protocolo; não transformar em campo livre por conta própria |
| P-07 | `custom: true` | campo livre permitido **além** das opções, nunca no lugar delas |
| P-08 | filho com ferramenta de escrita em tarefa read-only | envio recusado no runtime, antes do binário |
| P-09 | filho referenciando sessão pai inexistente | projeção descartada, com diagnóstico; sem criar nó órfão |
| P-10 | queda de SSE com pergunta na tela | §6: só continua clicável se voltar com o mesmo `id` |
| P-11 | `session.error` durante subtask | erro projetado no nó do filho, não no pai |
| P-12 | evento desconhecido | ignorar com diagnóstico, sem efeito na UI e sem persistir payload |
| P-13 | dois filhos concorrentes | projeções independentes; sem fila própria, sem serialização inventada |
| P-14 | sessão remota | as projeções vêm do mesmo host que possui a sessão; nada é consultado no cliente |

## 9. prova exigida antes de fechar AC-032

Contra o binário fixado, e nenhuma delas satisfeita por mock:

1. `todo.updated` real refletido na projeção, incluindo encolhimento da lista;
2. pergunta real: `asked` → `reply` → `replied`, e um segundo caso com `reject`;
3. demonstração de que responder pergunta **não** produziu efeito de permissão —
   a permissão correspondente foi pedida à parte;
4. subagente de leitura real com `parentID`, projetado e concluído, com o envio
   de uma ferramenta de escrita recusado (P-08);
5. queda de SSE seguida de recuperação HTTP, com uma pergunta pendente
   sobrevivendo e outra desaparecendo corretamente;
6. inspeção provando um único processo `opencode serve` e nenhum estado durável
   escrito pelo unigma.

As provas 1–5 dependem de provider/modelo autorizado; a 6 não. Isso não bloqueia
o contrato, só o aceite.

## 10. decomposição futura

| etapa | escopo | depende de |
| --- | --- | --- |
| J-1 | tipos internos e normalização das duas famílias de pergunta | — |
| J-2 | RPC versionado das três projeções (T-010) | J-1 |
| J-3 | runtime: assinatura de eventos, reconciliação de §6 e recusa de P-08 | J-2 |
| J-4 | UI: todo, perguntas separadas de permissões, árvore de filhos | J-3 |
| J-5 | escritores isolados | `AC-031` provado |
| J-6 | cenário de runner com as seis provas de §9 | J-4, provider autorizado |

J-5 não começa antes da prova de `AC-031`, e nada em J-1…J-4 pode ser
apresentado como suporte remoto sem `T-054`/`T-055`.
