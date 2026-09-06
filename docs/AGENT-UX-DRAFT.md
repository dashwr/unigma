# proposta de desenho — interação do painel do agente

**Estado: `[EM REVISÃO]`, com as respostas de `D-047` incorporadas.** Não
autoriza implementação e não fecha aceite nenhum. Cobre a etapa J das
[projeções](PROJECTIONS-CONTRACT.md), com as bordas de
[contexto](CONTEXT-CONTRACT.md) e [worktree](WORKTREE-CONTRACT.md).

Ancorada no código de hoje, não em intenção: `unigmaAgentView.ts` (577 linhas),
`unigmaAgentSession.ts`, `agentProtocol.ts`, `autopilotState.ts`.

## 1. o que existe hoje, dito com precisão

`UnigmaAgentViewPane` é **um painel de estado, não uma transcrição**. Ele
renderiza um estado por vez a partir de `UnigmaAgentSessionViewModel`:

| campo | como aparece hoje |
| --- | --- |
| `state` | um título e uma mensagem: `Ready when you are` / `Preparing the agent` / `Agent result` / `Agent unavailable` |
| `content` | um `<pre>` |
| `result` | a mensagem final, ou "The agent completed without a message." |
| `diff` | bloco `Proposed changes` com rótulo por arquivo |
| `permission` | título, descrição e dois botões, `Approve` / `Reject` |
| `models` / `activeModel` | seleção de modelo |
| autopilot | estado próprio, com progresso indeterminado e `actionable` |

Não existe `todo`, `question` nem sessão filha em `agentProtocol.ts`. A etapa J
é campo aberto do lado do RPC.

**A decisão de fundo é essa, e ela vem antes de qualquer pixel:** um painel que
mostra um estado por vez não tem onde colocar três projeções simultâneas. Todo,
perguntas e sessões filhas coexistem com o resultado; não se revezam com ele.

## 2. proposta — a estrutura

Uma coluna, cinco regiões fixas, sempre na mesma ordem. Nada aparece em lugar
diferente conforme o estado; regiões vazias colapsam.

```
┌─────────────────────────────────────┐
│ cabeçalho: sessão · modelo · estado │  sempre visível
├─────────────────────────────────────┤
│ atenção                             │  pergunta ou permissão pendente
│  (no máximo uma por vez)            │  vazio na maior parte do tempo
├─────────────────────────────────────┤
│ trabalho                            │  todo, sessões filhas, diff
│  (as três projeções de leitura)     │  colapsável, lembra o estado
├─────────────────────────────────────┤
│ transcrição                         │  o que foi dito, rolagem
├─────────────────────────────────────┤
│ composição: texto + anexos          │  sempre visível
└─────────────────────────────────────┘
```

Por que **atenção acima de trabalho**: uma pergunta e uma permissão bloqueiam o
avanço. Uma lista de todo não bloqueia. Colocar o que bloqueia embaixo de uma
lista que cresce é como se perde uma pergunta — e uma pergunta perdida parece
travamento, não espera.

Por que **transcrição abaixo do trabalho**: a transcrição rola e cresce sem
limite. Regiões de tamanho variável acima de conteúdo rolante fazem o conteúdo
saltar. As três de cima têm altura previsível; a de baixo absorve o resto.

## 3. proposta — cada região

### 3.1 atenção: pergunta ≠ permissão, e isso tem de se ver

O contrato de projeções é explícito: pergunta e permissão são endpoints, corpos
e eventos diferentes, e **"sempre" só existe para permissão**. Se a UI as
desenhar iguais, o usuário aprende que as duas se resolvem do mesmo jeito, e
essa é a lição errada exatamente no ponto em que ela custa caro.

Proposta:

- **permissão** tem três ações: `Permitir`, `Permitir sempre`, `Recusar`. Carrega
  o alvo concreto (comando, caminho, ferramenta) acima dos botões.
- **pergunta** tem as opções que o agente mandou e mais nada. **Sem "sempre".**
  Se o agente mandou opções livres, é campo de texto.
- as duas usam tratamento visual distinto — não só um rótulo diferente. Sugestão:
  permissão com borda de destaque e ícone de cadeado; pergunta sem borda, com
  ícone de balão.
- **uma por vez.** Se chegarem duas, a segunda espera e o cabeçalho mostra
  `+1 aguardando`. Enfileirar é honesto; empilhar duas caixas de decisão faz o
  usuário responder a errada.

**Decidido em `D-047`:** uma pergunta pendente **desabilita a composição**, e a
saída entra na própria pergunta. Além das opções que o agente mandou, toda
pergunta ganha sempre as **duas últimas**: `digitar` (texto livre) e `cancelar`.

Isso corrigiu a proposta original, que recomendava não desabilitar por receio de
a pergunta virar modal. A resposta resolve o mesmo receio melhor: a saída deixa
de morar no campo de composição e passa a morar onde o usuário já está olhando.
O campo travado não é armadilha, porque existe sempre uma opção que destrava.

**Posição relativa, nunca fixa.** Se o agente mandar seis opções, `digitar` e
`cancelar` são a sétima e a oitava — para que teclado ou repetição nunca caiam
sobre `cancelar` por acidente de contagem.

Ambas as famílias `question.*` e `question.v2.*` são aceitas na entrada, com
resposta pela rota sem `v2`; isso o contrato já fixava.

### 3.2 trabalho: todo é leitura, e a UI não pode sugerir o contrário

O contrato: `Todo` **não tem `id`**, `todo.updated` manda a lista inteira, e
`status`/`priority` são strings livres no schema. Três consequências diretas de
desenho:

- **marcador próprio, não o checkbox do sistema** (`D-047`): quadrado com um
  quadrado menor dentro para o item feito.

  É um **marcador de estado, não um controle** — sem clique, sem foco de
  teclado, sem estado próprio no unigma, porque não existe endpoint de escrita
  de todo e `Todo` não tem `id` para endereçar um item. O checkbox do sistema
  foi recusado justamente por convidar a um clique que não tem para onde ir.

  A forma escolhida se encaixa em `D-046`: quadrado aninhado é do registro de
  bloco e grade, e a regra de geometria da identidade diz que **arredondado é o
  que se clica**. Um marcador quadrado já diz por si que não é botão, sem
  precisar de tooltip explicando.
- **substituição integral, sem animação de reordenação.** A lista chega inteira;
  fingir que itens se moveram é inventar uma história que os dados não contam.
  Proposta: substituir em bloco, e apenas realçar por ~1 s o que mudou de estado.
- **valor desconhecido renderiza como texto.** Se `status` vier `blocked` e a UI
  só conhecer três estados, mostra `blocked` literal em vez de cair num default.
  Um default silencioso aqui mente sobre o que o agente disse.

Sessões filhas: **as de leitura primeiro**, conforme o contrato. Cada filha é
uma linha com nome, estado e o que está lendo. Proposta explícita: uma filha
**não abre um painel próprio** nesta etapa — expandir para ver, nunca navegar
para fora. Painel por filha multiplica o problema de reconciliação de SSE por N.

Diff: fica aqui, não na atenção. Um diff proposto é trabalho visível, não uma
decisão pendente — a decisão vira permissão quando o agente for escrever.

### 3.3 transcrição

Mensagens do usuário e do agente, em ordem. O que a proposta acrescenta ao que
já existe:

- **queda de SSE reconcilia, não descarta** — o contrato fixa isso. Na UI, uma
  reconexão **não** limpa a transcrição e **não** reenvia o prompt. Proposta:
  uma linha discreta `reconectado` no ponto da lacuna, para que um usuário que
  viu a tela congelar entenda o que aconteceu.
- **nunca inferir "pensando" de animação.** Se não houver evento, não há
  indicador. Um spinner que gira sem evento por trás é o mesmo defeito de
  `Process Info`: a interface afirmando algo que ninguém mediu.

### 3.4 composição e anexos

O contrato de contexto fixa: `1 MiB` por anexo, `4 MiB` por envio, `32` anexos,
**truncamento silencioso proibido**, e `@` continua sendo do agente porque
`AgentPartInput` o usa.

Proposta:

- anexos aparecem como **chips acima do campo**, cada um com nome, tamanho e
  remoção. Tamanho visível o tempo todo, não só quando estoura.
- estouro é **recusa com motivo antes do envio**, no lugar do chip, dizendo qual
  dos três limites foi excedido e por quanto. Nunca um anexo cortado.
- um contador `x/32 · y de 4 MiB` fica visível assim que houver um anexo.
- **`@` não abre seletor de arquivo.** É do agente. Anexar tem gesto próprio —
  proposta: arrastar, colar, e um botão explícito.
- anexo de buffer sujo mostra que é conteúdo não salvo, porque o que vai é o
  que está em disco. Esse é o caso `F-01` do contrato e é o que mais confunde.

## 4. o que a proposta recusa de propósito

- **modal de qualquer tipo.** Bloqueia o workbench inteiro por um evento do
  agente.
- **notificação global** para pergunta ou permissão. Tira a decisão do contexto
  em que ela faz sentido.
- **um painel por sessão filha** nesta etapa (§3.2).
- **badge de contagem no ícone da atividade** antes de existir enfileiramento
  provado. Contador errado é pior que nenhum.

## 5. o que falta você responder

1. A estrutura de cinco regiões da §2 serve, ou você quer transcrição no topo?
2. Pergunta pendente **desabilita** a composição? (recomendo que não — §3.1)
3. Todo sem checkbox está certo, ou você quer um controle mesmo sabendo que ele
   não teria para onde mandar o clique hoje?
4. Sessão filha expande no lugar, ou abre painel próprio?
5. O gesto de anexar: arrastar + colar + botão basta, ou você quer um atalho de
   teclado próprio — sabendo que `@` está ocupado pelo agente?
