# unigma — modelo de dados

> **status: arquitetura aprovada; implementação parcial.** Referências de sessão,
> estado visual e domínio do router já têm recortes de implementação; consulte
> `status/WORKBENCH.md`. Não há banco próprio autorizado.

## princípio

unigma não replica estados que já pertencem ao Code - OSS, OpenCode, Git ou
OpenSSH. O armazenamento próprio é local, mínimo e não contém credenciais de
provider, chaves SSH, tokens ou cópia do workspace.

O bundle `unigma+opencode` e seu manifesto de proveniência pertencem ao artefato
de build, não ao estado do usuário. Atualização e rollback substituem o bundle;
não migram nem reescrevem os dados mantidos pelo OpenCode.

## dados próprios mínimos

| conceito | campos mínimos propostos | armazenamento | retenção |
| --- | --- | --- | --- |
| referência de sessão | `sessionId` do OpenCode, `workspaceUri` | `workspaceState` | enquanto o workspace existir; removível pelo usuário |
| configuração unigma | chaves definidas pelo schema de settings | settings de usuário/workspace | administrada pelo Code - OSS |
| estado visual local | seleção de painel e filtros não sensíveis | `globalState` ou memória | descartável/removível |
| evento em exibição | referência de sessão, tipo e payload validado | memória | duração da sessão/UI |
| relação e estado de agente | `sessionId`, `parentID` e estado derivado validado | memória; OpenCode/SSE é a fonte de verdade | duração da sessão/UI |
| modo de interação | seleção transitória de ferramenta `@` ou skill `/` | memória e configuração não sensível, quando necessário | até a interação/sessão ou remoção pelo usuário |
| chip de agente | identidade não sensível, `sessionId` e estado `thinking`/`typing`/`idle` | memória | duração da sessão/UI |
| correlação de diagnóstico | `requestId`, referência de sessão e nível | log local do Code - OSS | política local do aplicativo |

`workspaceUri` é necessário apenas para associar uma referência de sessão ao
workspace correto; não é uma cópia do conteúdo do projeto. Não há requisito
para persistir prompts, histórico, diffs, aprovações, resultados ou raciocínio
do router fora do OpenCode.

## Autopilot e Intelligence Index

### contexto e worktrees — D-038–040

Anexo é estado transitório com origem, URI, versão e seleção; o contrato exato
e limites serão definidos antes da implementação. Buffer do editor não é cópia
persistida pelo unigma. Não registrar conteúdo dos anexos em logs ou índice.

Worktree, base e alterações pertencem ao Git; sessão e sua localização pertencem
ao OpenCode. Unigma pode projetar referências validadas, sem banco de tarefas,
snapshot paralelo ou histórico de diffs. Persistência adicional exige decisão.
Todo/perguntas/sessões filhas são consultados novamente no harness após reinício;
não restaurar autorização antiga. Worktree não implica exclusividade contra
processos externos nem inclui automaticamente arquivos dirty/untracked da origem.

### tipos das projeções de leitura — D-040/D-047, protocolo 2 — 2026-09-06

Estes tipos existem em código: `AgentTodoItem`, `AgentQuestionProjection` e
`AgentChildSessionProjection` em
`src/vs/workbench/contrib/unigmaAgent/common/agentProtocol.ts`, com a
normalização correspondente em
`extensions/unigma-agent-runtime/src/domain/projections.ts`. Nenhum deles é
persistido: são estado transitório da sessão/UI, e a fonte de verdade continua
sendo o OpenCode.

| tipo | campos | armazenamento | retenção |
| --- | --- | --- | --- |
| `AgentTodoItem` | `content`, `status`, `knownStatus?`, `priority`, `knownPriority?` | memória | duração da sessão/UI |
| `AgentQuestionProjection` | `requestId`, `index`, `question`, `header`, `options[]`, `multiple`, `custom` | memória | até a pergunta ser respondida ou rejeitada |
| `AgentChildSessionProjection` | `sessionId`, `parentId`, `title?` | memória | duração da sessão/UI |

As invariantes abaixo são o que importa nestes tipos; elas não são convenção de
UI, são propriedade do formato.

**`AgentTodoItem` não tem `id`.** Não existe `id` no schema do artefato, então a
identidade de um item é a **posição no array**. `todo.updated` traz a lista
inteira, e por consequência toda atualização é **substituição integral** —
nunca merge por chave inventada. Não há endpoint de escrita de todo: a projeção
é somente leitura.

`status` e `priority` são **string livre** no schema (os valores nomeados só
aparecem em prosa), então viajam crus. `knownStatus` e `knownPriority` só são
preenchidos quando o valor é um dos nomeados; a **ausência** desses campos é a
instrução para a UI renderizar o texto cru, em vez de escolher um default. Um
item ao qual falte qualquer um dos três campos obrigatórios é **descartado** na
normalização, não completado com valor padrão.

**`AgentQuestionProjection` não tem `always`, não tem `response` e não tem id de
permissão.** Uma pergunta nunca concede permissão, e a ausência de campo é uma
garantia mais forte do que uma regra que alguém precise lembrar: não existe onde
um valor desses viajaria. O validador do protocolo recusa chave extra
(`hasOnlyKeys`), então um payload que tentasse acrescentar um desses campos é
recusado, não ignorado. Permissão continua com comando (`Approve`), corpo e
evento próprios.

`index` é a posição da pergunta dentro do seu `QuestionRequest`, porque o corpo
da resposta é um array de respostas por pergunta e o schema não dá id à pergunta
individual.

**`AgentChildSessionProjection`: a relação é `parentId`.** Não existe evento
próprio de subagente; o ciclo de vida do filho aparece nos mesmos eventos de
sessão e mensagem do pai. Um filho cujo `parentID` não bate com a sessão
consultada é descartado, não adotado.

**Comandos associados**, ambos em `AgentCommand`:

| comando | corpo | efeito |
| --- | --- | --- |
| `answerQuestion` | `sessionId`, `questionRequestId`, `answers: string[][]` (um array de labels por pergunta do request) | responde a pergunta; nunca concede permissão |
| `rejectQuestion` | `sessionId`, `questionRequestId` | dispensa a pergunta sem responder |

`rejectQuestion` é o comando por trás da opção `cancelar` que `D-047` acrescenta
a toda pergunta; é o que torna seguro desabilitar a composição.

**Não implementado:** o lado runtime destes tipos (`J-3`) e a UI (`J-4`). Os
tipos e a normalização existem; a assinatura dos eventos OpenCode
correspondentes no transporte do runtime, não.

### dados do roteamento

A direção aprovada adiciona somente settings e estado local mínimo; não cria um
novo agregado de domínio nem altera as fontes de verdade existentes.

| conceito | campos mínimos propostos | armazenamento | retenção |
| --- | --- | --- | --- |
| configuração do Autopilot | `autopilotEnabled`, `maxModel`, `persistSelectedModel`, `routerModel` (direção padrão: `Luna medium`) | settings de usuário/workspace | administrada pelo Code - OSS; permanece até alteração ou remoção pelo usuário |
| modelo selecionado | `selectedModel` | memória para a interação/sessão; settings somente quando `persistSelectedModel` estiver ligado | descartável ao terminar a interação/sessão quando não persistido; quando persistido, até alteração ou remoção pelo usuário |
| referências de avaliação | `intelligenceIndexRef`, `modelCostRef` (fonte e versão) | settings de usuário/workspace ou `workspaceState`, somente quando necessárias | substituível/removível pelo usuário; guarda referências versionadas, não o índice, a tabela de custos ou um catálogo |

Os modelos disponíveis e configurados, bem como a execução da sessão, continuam
tendo OpenCode e a configuração autorizada do usuário como fonte de verdade.
Para os flags e referências acima, o settings/estado local indicado na tabela é
a fonte de verdade de unigma.
`selectedModel` é apenas preferência/estado de roteamento local: não duplica a
configuração do provider nem seus segredos. As referências de índice e custo,
quando necessárias, devem apontar para uma fonte local explícita e versionada;
não autorizam catálogo remoto, descoberta automática ou sincronização.

A fórmula do Intelligence Index, a pesquisa ou benchmark que a sustenta, os
critérios de elegibilidade, a fonte/unidade dos preços e sua atualização são
detalhes futuros. Este modelo não fixa cálculo, valores, catálogo ou histórico
de decisões do router.

## dados externos e respectivas fontes de verdade

| dado | fonte de verdade | como unigma usa |
| --- | --- | --- |
| sessão, mensagem, diff e permissão de agente | OpenCode | consulta via HTTP/SSE e apresenta referência/estado |
| provider, modelo e MCP | OpenCode e configuração autorizada do usuário | encaminha configuração sem importar segredos |
| arquivo, terminal e workspace | filesystem local/remoto e Code - OSS | usa APIs do workbench; não espelha |
| branch e worktree | Git | consulta e opera por Git |
| host, chaves, agente e `known_hosts` | OpenSSH | delega a autenticação e confiança |
| idioma, tema e preferências do editor | Code - OSS | consome configurações e contribuições de extensão |

## estados transitórios

Uma aprovação pendente, uma operação de subagente e a fila de eventos existem
somente enquanto a sessão está ativa. Após reinício, a UI consulta o OpenCode;
ela não presume que uma aprovação antiga ainda seja válida nem a restaura.

O protocolo de controle remoto, enquanto dormente, possui somente contrato e
tipos versionados. Não há listener, fila, sincronização, identidade remota ou
estado persistido associado a ele no MVP.

## dados deliberadamente ausentes

- usuários, contas, organizações, papéis ou permissões RBAC;
- bancos SQL/NoSQL, migrations, ORM e sincronização;
- telemetria, analytics, perfil em nuvem e logs remotos;
- catálogo remoto de modelos, cache de índice/preços ou cópia local persistida
  de prompts, histórico e raciocínio de roteamento;
- cópia de tokens, caches OAuth, senhas ou chaves SSH;
- cópia indexada ou upload do workspace.
- catálogo, conta, listener ou estado de controle remoto.

Esses dados exigiriam casos de uso novos e revisão explícita de segurança,
retenção, criptografia e autorização.
