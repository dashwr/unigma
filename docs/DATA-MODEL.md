# unigma — modelo de dados

> **status: arquitetura aprovada; modelo ainda não implementado.** Não há banco
> de dados nem esquema de domínio implementado.

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
