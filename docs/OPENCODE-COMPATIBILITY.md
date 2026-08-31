# OpenCode: matriz de compatibilidade do MVP

> **T-011 / E-01.** Matriz operacional para o CLI `opencode serve` via HTTP/SSE.
> Revisada em 2026-08-23 e atualizada com probe real em 2026-08-26. Este
> documento é uma especificação; o probe de `/usr/bin/opencode` `1.18.23` não é
> o bundle oficial service-only e nenhum provider/modelo é anunciado como
> suportado.

> **Atualizacao de fechamento em 2026-08-26:** a fixture matrix local separa o
> probe direto `GET /doc` das 14 operacoes que a especificacao publicada declara
> em `paths`. Isso evita exigir que o OpenAPI liste a rota que o serve para o
> cliente, mas nao converte a matriz em suporte de bundle de release.

## 1. Escopo

Esta matriz cobre somente o processo headless `opencode serve` do perfil
service-only, iniciado pelo runtime do unigma e acessado por HTTP/SSE no
loopback do host do workspace. O binário oficial deve vir do bundle
`unigma+opencode`; um executável externo só serve para probe de desenvolvimento
até que o decepador produza um artefato fixado. Não define ACP, TUI, Webview,
chamada direta a provider, autenticação própria do unigma, MCP, plugins ou
provisionamento SSH.

Os estados abaixo evitam transformar documentacao em promessa de suporte:

| Estado | Significado |
| --- | --- |
| `documentado / requerido` | A interface publica foi encontrada e entra no perfil minimo; ainda exige teste contra um binario fixado. |
| `documentado / condicional` | A interface existe, mas so e habilitada quando a capacidade e o fixture forem verificados. |
| `nao usado` | O OpenCode documenta a interface, mas o adaptador do MVP nao a chama. |
| `nao suportado` | O unigma nao deve anunciar nem criar fallback para essa capacidade. |

O perfil desta tarefa e `T-011-http-sse-minimo-0.1`. Esse identificador e do
documento e nao e uma versao do OpenCode.

## 2. Fatos verificaveis

| Fato | Evidencia publica |
| --- | --- |
| `opencode serve` e um servidor HTTP headless e aceita `--port`, `--hostname` e `--cors`; os defaults documentados sao `4096` e `127.0.0.1`. | [OpenCode Server](https://opencode.ai/docs/server) |
| O servidor publica uma especificacao OpenAPI 3.1 em `/doc`. | [OpenCode Server](https://opencode.ai/docs/server) |
| `GET /global/health` retorna `healthy` e `version`. | [OpenCode Server](https://opencode.ai/docs/server) e [SDK gerado](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts) |
| `/event` e SSE; o primeiro evento documentado e `server.connected`, seguido pelos eventos do bus. | [OpenCode Server](https://opencode.ai/docs/server) |
| O SDK gerado atual modela o stream de `/event` como `{ type, properties }` e o stream de `/global/event` como `{ directory, payload }`. | [SDK gerado](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts) |
| Providers e modelos sao descobertos pelo OpenCode; o ID completo de modelo tem o formato `provider_id/model_id`. | [OpenCode Providers](https://opencode.ai/docs/providers), [OpenCode Models](https://opencode.ai/docs/models) e [SDK](https://opencode.ai/docs/sdk) |
| A documentacao lista configuracoes locais para Ollama, LM Studio, `llama.cpp` e providers customizados OpenAI-compatible. | [OpenCode Providers](https://opencode.ai/docs/providers) |
| Credenciais adicionadas pelo `/connect` ficam no armazenamento do OpenCode em `~/.local/share/opencode/auth.json`. | [OpenCode Providers](https://opencode.ai/docs/providers) |
| A configuracao de permissao aceita `allow`, `ask` e `deny`; o default documentado e permissivo. | [OpenCode Permissions](https://opencode.ai/docs/permissions) e [OpenCode Config](https://opencode.ai/docs/config) |

## 3. Versao e assuncoes

| Item | Regra do MVP |
| --- | --- |
| Versao OpenCode | **Candidata de teste:** release `v1.18.23`, cujo tag local aponta para `31c409a86510e80fd6f798da165c50a6a40fccba`. `/usr/bin/opencode --version` retorna `1.18.23`; SHA-256 Linux observado: `f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f`. Sem manifesto de release local, esse hash não prova sozinho a relação binário→commit. Ela ainda não é o binário bundled service-only de release. |
| Versao observada | O valor de `version` retornado por `GET /global/health` deve ser registrado como evidência de cada teste e precisa ser exatamente `1.18.23` para o MVP; qualquer outra versão falha fechado até nova revisão desta matriz. |
| Checkout upstream candidato | `/home/dasher/projects/unigma/opencode`, branch `dev`, HEAD `c2eacd72afc4a4984564c393e15ab30011057269`, árvore limpa; `packages/opencode`, `core` e `server` declaram `1.18.23`. A revisão fonte ainda não é um patchset ou bundle aceito. |
| Autoridade do contrato | A especificacao publicada por `GET /doc` do binario em teste e a autoridade para paths, metodos, schemas e respostas. O SDK `dev` e referencia publica de tipos, nao uma versao suportada. |
| Combinacao upstream | Code - OSS `1.134.0`, commit `474a349ad5b745e512ef86b864d1c74f7264dd7a`, Node.js `24.18.0` e Electron `42.8.1` continuam sendo a matriz do upstream; isso nao prova compatibilidade com OpenCode. |
| Processo | Um processo filho por extension host, reutilizado entre sessoes e encerrado somente quando foi criado pelo runtime. |
| Rede | Iniciar explicitamente com `--hostname 127.0.0.1`; nao habilitar mDNS, CORS ou exposicao LAN para o fluxo do MVP. |
| Workspace | O processo deve iniciar no workspace autorizado. O adaptador valida `directory` de `/path` quando presente; em versões sem ele, usa `path` e por último `worktree`. `worktree` é metadado de raiz Git e pode ser pai de `directory`, portanto não invalida sozinho um `directory` autorizado. |
| SSE | Nenhum cursor, replay ou semantica de `Last-Event-ID` e assumido; apos uma queda, o estado e reconsultado por HTTP. |
| Credencial do servidor | O perfil padrao nao envia Basic Auth. Um `401` ou `403` causado por `OPENCODE_SERVER_PASSWORD` e uma falha observavel e nao um convite para pedir, ler ou persistir a senha. |

Enquanto a combinação entre release OpenCode, patchset service-only e alvo não
estiver registrada, `opencode serve` está documentado, mas não suportado como
binário bundled de release.

### perfil de empacotamento service-only

O perfil oficial preserva o harness de execução do OpenCode e redireciona TUI,
onboarding, prompts interativos, navegação, todo/plan UI e comandos de uso direto
para a superfície nativa do unigma. Não se deve inferir que um endpoint HTTP
deixou de existir apenas porque uma superfície visual foi retirada; a matriz de
transporte continua sendo definida pelo `/doc` do binário testado.

O pipeline esperado é:

```text
commit upstream -> patch service-only -> testes -> auditoria -> bundle versionado
```

O patchset e o manifesto ainda não existem como artefato aceito. O checkout
upstream candidato agora está registrado para o inventário de módulos, mas o
processo de compatibilidade ainda valida somente o contrato do executável
observado, sem confundi-lo com suporte de distribuição do
`unigma+opencode`. A fronteira completa está em
[OPENCODE-SERVICE-ONLY.md](OPENCODE-SERVICE-ONLY.md).

## 4. Endpoints do perfil minimo

O adaptador deve chamar somente os endpoints desta tabela. Schemas, campos
opcionais e query parameters so entram quando presentes no `/doc` do binario
fixado. Nenhum path e inferido a partir de outro produto.

| Metodo e path | Capacidade | Estado | Regra de uso |
| --- | --- | --- | --- |
| `GET /global/health` | Prontidao e versao | documentado / requerido | Exigir HTTP 200, `healthy: true` e `version` string antes de usar sessoes. |
| `GET /doc` | Probe de contrato OpenAPI | documentado / requerido | Exigir OpenAPI 3.1 e a presenca dos endpoints requeridos antes de marcar o runtime como pronto. |
| `GET /path` | Autoridade de caminho | documentado / requerido | Comparar `directory` ao workspace autorizado quando presente; em sua ausência, usar `path` e depois `worktree`. Divergência do campo autoritativo bloqueia a sessão. |
| `GET /event` | Eventos SSE da instancia | documentado / requerido | Assinar uma vez por processo; validar `type` e `properties`; o primeiro evento esperado e `server.connected`. |
| `GET /session` | Listar sessoes e retomar referencia | documentado / requerido | Usar como fonte de verdade apos start, restart e reconexao. |
| `POST /session` | Criar sessao | documentado / requerido | Enviar somente campos documentados pelo `/doc`; `parentID` e permitido apenas no fluxo condicional de subagente. |
| `GET /session/status` | Estado de todas as sessoes | documentado / requerido | Reconsultar apos reconexao; nao reconstruir estado somente com eventos perdidos. |
| `GET /session/{id}` | Detalhes da sessao | documentado / requerido | Validar que a sessao pertence ao diretorio corrente antes de exibir ou retomar. |
| `GET /session/{id}/message` | Historico necessario para retomada | documentado / requerido | Recarregar mensagens e partes apos restart ou lacuna no SSE; nao persistir copia no unigma. |
| `POST /session/{id}/prompt_async` | Enviar entrada sem bloquear o stream | documentado / requerido | Usar o corpo documentado, incluindo `parts`; nao substituir por `/message` silenciosamente se este path faltar. |
| `POST /session/{id}/abort` | Interromper uma sessao ativa | documentado / requerido | Expor como cancelamento; o resultado deve ser confirmado por estado/evento. |
| `GET /session/{id}/diff` | Consultar diff da sessao | documentado / requerido | Usar para revisao; o diff retornado pelo OpenCode e a fonte de verdade. |
| `POST /session/{id}/permissions/{permissionID}` | Responder a uma permissao | documentado / requerido | Enviar somente `response` com `once`, `always` ou `reject`; nao enviar `remember` sem que o `/doc` testado o exija. |
| `GET /provider` | Descobrir providers, modelos e conectividade | documentado / requerido | Exibir somente entradas retornadas e validadas; nenhum provider e hard-coded. |
| `GET /config/providers` | Descobrir providers e modelos default | documentado / requerido | Usar para defaults declarados pelo OpenCode; nao gravar a resposta em estado proprio. |
| `GET /agent` | Listar agentes disponiveis | documentado / condicional | Habilitar somente quando o fluxo de subagente estiver coberto pelo fixture e pelo binario. |
| `GET /session/{id}/children` | Listar sessoes filhas | documentado / condicional | Usar apenas para subagentes; `parentID` e a relacao de sessao, nao um novo processo OpenCode. |

`GET /global/event` tambem e documentado e possui envelope `GlobalEvent` no SDK,
mas nao faz parte do perfil minimo: o MVP usa `/event` para a instancia que o
runtime possui. Nao fazer fallback automatico entre os dois streams.

### Endpoints fora do perfil

| Grupo | Estado no MVP | Motivo |
| --- | --- | --- |
| `POST /config`, `PUT /auth/{id}`, `/provider/{id}/oauth/*` | nao suportado | Unigma nao altera configuracao de credencial nem conduz OAuth. |
| `/mcp*`, `/lsp`, `/formatter`, `/experimental/*` | nao usado | Politica de MCP/plugins/regras pertence a T-012; capacidades experimentais nao entram no contrato minimo. |
| `/tui/*` | nao suportado | A superficie do agente e nativa do workbench, nao a TUI. |
| `/session/{id}/message` sincrono, `/command`, `/shell` | nao usado | O MVP envia `prompt_async`; terminal e efeitos continuam sob as fronteiras de runtime, trust e aprovacao. |
| `/session/{id}/share*` | nao suportado | Compartilhamento/cloud nao pertence ao MVP. |
| `/session/{id}/fork`, `/init`, `/summarize`, `/revert`, `/unrevert`, `/todo` | nao usado | Nao sao necessarios para o perfil minimo de sessao, streaming, diff e aprovacao. |
| `/file*`, `/find*`, `/vcs`, `/project*` | nao usado pelo adaptador | Filesystem, Git e worktrees continuam fontes de verdade externas; `/path` e a unica verificacao de autoridade deste perfil. |
| `POST /instance/dispose` | nao usado | O supervisor encerra somente o processo filho que possui; nao dispara descarte remoto por endpoint. |
| Worktree | nao e endpoint OpenCode | A operacao e feita por Git em T-041; nao inventar uma operacao de worktree no HTTP do OpenCode. |

## 5. Eventos SSE

O envelope canônico do perfil `/event` e o tipo `Event` do SDK gerado:

```text
{ type: string, properties: object }
```

Eventos usados pelo MVP:

| Evento | Uso | Campos verificaveis no SDK publico |
| --- | --- | --- |
| `server.connected` | Confirmar o inicio do stream | `properties` e objeto aberto. |
| `session.created` | Registrar sessao nova | `properties.info` e `Session`. |
| `session.updated` | Atualizar metadados da sessao | `properties.info` e `Session`. |
| `session.deleted` | Invalidar referencia local | `properties.info` e `Session`. |
| `session.status` | Atualizar `busy`, `idle` ou `retry` | `sessionID` e `status`. |
| `session.idle` | Encerrar estado de processamento | `sessionID`. |
| `session.error` | Apresentar erro de execucao/provider | `sessionID?` e erro tipado quando presente. |
| `message.updated` | Atualizar mensagem user/assistant | `properties.info` e `Message`. |
| `message.part.updated` | Renderizar streaming incremental | `part` e `delta?`. |
| `message.part.removed` | Remover parte invalidada | `sessionID`, `messageID`, `partID`. |
| `session.diff` | Atualizar diff da sessao | `sessionID` e `diff: FileDiff[]`. |
| `permission.asked` | Mostrar pedido de aprovacao | `sessionID`, `id`, `permission`, `patterns`, `metadata`, `always`, `tool`. |
| `permission.replied` | Confirmar resposta de aprovacao | `sessionID`, `requestID`, `reply`. |

Subagentes usam os mesmos eventos de sessao/mensagem. A relacao e identificada
por `Session.parentID`, sessoes filhas e partes de mensagem documentadas; nao ha
um evento ou endpoint proprio de subagente no perfil.

Regras de parsing:

- Validar o payload conhecido conforme o `/doc` e os tipos gerados do binario em
  teste antes de convertê-lo para o contrato interno.
- Ignorar e diagnosticar evento desconhecido sem criar efeito na UI; nao
  persistir seu payload. Um evento desconhecido nao autoriza um fallback.
- Tratar payload invalido de evento requerido como erro de protocolo da sessao;
  nao tentar adivinhar campos ou renomear eventos.
- Em `permission.asked`, a UI deve mostrar a decisao explicita. Unigma nao
  autoaprova e nao restaura uma aprovacao pendente depois de restart.
- O SDK gerado público ainda lista `permission.updated`, mas o `/doc` do binário
  fixado `1.18.23` expõe `permission.asked`/`permission.replied`; o adaptador
  valida e usa os formatos observados no `/doc`, com fixtures locais. Eventos
  legados `permission.updated` continuam aceitos somente para compatibilidade
  com fixtures já existentes.

O SDK gerado tambem mostra que `/global/event` envolve o evento em
`{ directory, payload }`. Como esse endpoint nao e usado, o adaptador nao deve
aceitar esse envelope no lugar do envelope de `/event`.

## 6. Start, restart e incompatibilidade

### Start

1. Exigir workspace confiavel antes de iniciar o processo.
2. Iniciar o filho com a forma documentada
   `opencode serve --hostname 127.0.0.1 --port <owned-port>`.
3. Aguardar `/global/health`; timeout, `healthy: false`, resposta malformada ou
   `401/403` impedem o estado pronto.
4. Consultar `/doc` e verificar todos os paths `documentado / requerido` desta
   matriz. A ausencia de qualquer um produz incompatibilidade, nao fallback.
5. Validar `/path`, assinar `/event` e exigir `server.connected`.
6. Consultar providers/modelos somente depois do probe de contrato.

O processo nao deve iniciar uma instancia por sessao. O runtime registra a
posse do PID/processo que criou e nunca encerra um processo alheio.

### Restart e reconexao

- Queda do processo, falha de bind, timeout de health ou encerramento inesperado
  fecha o SSE e emite um estado interno observavel de indisponibilidade. O nome
  final desse evento RPC pertence a T-010.
- Uma falha pode gerar no maximo uma tentativa automatica de restart. Se o novo
  processo falhar no health/probe, parar a tentativa e exigir retry explicito do
  usuario; nao criar loop de restart.
- Depois de um restart bem-sucedido, repetir health, `/doc`, `/path` e assinatura
  SSE; entao recarregar sessoes, status, mensagens e diff por HTTP.
- Nao presumir que uma aprovacao, mensagem em andamento ou evento perdido foi
  restaurado. A UI deve consultar o OpenCode e marcar a referencia como
  indisponivel quando a sessao nao existir.
- Queda somente do SSE com processo saudavel usa reconexao ao mesmo `/event`,
  seguida da mesma recarga HTTP. Como a documentacao nao define replay/cursor,
  nao usar `Last-Event-ID` nem confirmar entrega exatamente uma vez.

### Classificacao de falhas

| Condicao | Resultado |
| --- | --- |
| Executavel ausente ou processo nao inicia | Indisponivel; informar acao para instalar/configurar OpenCode. |
| Porta ocupada, timeout ou crash | Indisponivel; reiniciar uma vez conforme a politica acima. |
| `401`/`403` no servidor | Autenticacao do servidor requerida; nao suportado sem contrato seguro de credencial. |
| Health invalido, `/doc` ausente/invalido ou path requerido ausente | Incompativel; nao enviar prompts nem usar endpoint alternativo. |
| Evento requerido com schema invalido | Erro de protocolo; interromper o consumo daquela sessao e diagnosticar sem payload sensivel. |
| Provider sem credencial, modelo inexistente ou erro de API | Provider/modelo indisponivel; nao classificar automaticamente como incompatibilidade do servidor. |
| Provider ou modelo nao retornado pelo OpenCode | Nao suportado; nao inventar alias, fallback ou catalogo local. |

Nao ha download, update automatico, troca para ACP, chamada direta ao provider
ou uso de endpoints nao documentados para contornar incompatibilidade.

## 7. Providers e modelos

O adaptador e provider-neutral. Ele descobre o que o OpenCode retorna e nao
replica credenciais, catalogos ou modelos em settings do unigma.

| Provider/categoria | O que e verificavel publicamente | Estado de suporte unigma |
| --- | --- | --- |
| `ollama` local | A documentacao mostra configuracao local via provider OpenAI-compatible e `baseURL`. | Candidato documental; **nao suportado ainda**, pois nao ha modelo testado no perfil bundled. |
| `lmstudio` local | A documentacao mostra configuracao local via provider OpenAI-compatible e `baseURL`. | Candidato documental; **nao suportado ainda**, pois nao ha modelo testado no perfil bundled. |
| `llama.cpp` local | A documentacao mostra configuracao local via provider OpenAI-compatible e `baseURL`. | Candidato documental; **nao suportado ainda**, pois nao ha modelo testado no perfil bundled. |
| Provider customizado OpenAI-compatible | O schema e a documentacao permitem `npm`, `name`, `options.baseURL` e `models`. | Fixture de transporte apenas; nao e uma allowlist de provider. |
| Providers remotos do diretorio OpenCode | A pagina de providers lista muitos providers, mas isso prova capacidade do OpenCode, nao teste do unigma, entitlement ou politica de dados. | **Nao suportado pelo perfil T-011**. Nenhum nome e anunciado como integrado. |

Nao ha modelo fixo suportado nesta etapa. Exemplos como `llama2`,
`google/gemma-3n-e4b` ou outros IDs mostrados na documentacao sao exemplos de
configuracao e nao uma promessa de disponibilidade. Para um teste futuro, o
modelo so pode ser aceito quando:

- o provider e o modelo aparecem na resposta validada de `/provider` ou
  `/config/providers`;
- o ID exato `providerID/modelID` e usado, sem alias ou fallback;
- as capacidades retornadas indicam entrada/saida de texto e `toolcall` para o
  caminho de agente;
- a combinacao provider, modelo, versao do OpenCode e ambiente passa um teste
  local reproduzivel sem credencial registrada no unigma.

Sem esses quatro fatos, o estado e `nao suportado`, mesmo que o provider seja
listado na documentacao do OpenCode.

## 8. Politica de credenciais

- Credenciais de provider pertencem ao OpenCode. O usuario pode configurá-las
  pelos meios documentados do OpenCode, mas o unigma nao abre, copia, importa,
  imprime ou persiste `auth.json`, tokens OAuth, API keys ou arquivos de
  credencial.
- O adaptador nao chama `PUT /auth/{id}`, `/provider/{id}/oauth/authorize`,
  `/provider/{id}/oauth/callback` nem conduz `/connect`.
- O adaptador nao envia `PATCH /config` e nao interpreta `options.apiKey`,
  headers ou campos semelhantes como dados exibiveis. Respostas de provider sao
  efemeras e campos sensiveis sao redigidos antes de qualquer diagnostico.
- O servidor OpenCode pode ser protegido por Basic Auth usando
  `OPENCODE_SERVER_PASSWORD` e `OPENCODE_SERVER_USERNAME`. O perfil do MVP nao
  possui fluxo para obter essa senha; `401`/`403` e falha acionavel, nao motivo
  para solicitar ou extrair segredo.
- A politica de permissao do OpenCode continua autoridade. O unigma somente
  encaminha a decisao explicita do usuario e nao altera `allow`, `ask` ou
  `deny` para evitar uma aprovacao.
- Logs locais podem conter somente versao observada, status HTTP, path do
  endpoint, tipo do evento, `requestId` e referencia nao sensivel de sessao.
  Nunca registrar prompt, diff, conteudo de arquivo, token, senha, API key ou
  payload integral de provider/permissao.

## 9. Fixture e servidor controlado

O teste de contrato deve usar um servidor local controlado, sem credenciais e
sem rede externa. Ele nao deve ser apresentado como OpenCode nem como provider
suportado. Os schemas do fixture devem ser derivados do `/doc` do binario
OpenCode fixado ou, antes disso, marcados como fixture provisoria.

O fixture minimo deve cobrir:

| Cenario | Evidencia exigida |
| --- | --- |
| Start feliz | Health com `healthy: true` e `version`, `/doc` OpenAPI 3.1, `/path`, `/event` e `server.connected`. |
| Sessao | Criacao, listagem, retomada, status, `prompt_async`, mensagens e estado `busy`/`idle`. |
| Streaming | `message.updated`, `message.part.updated` com e sem `delta`, `message.part.removed` e ordem por sessao. |
| Diff | `GET /session/{id}/diff` e `session.diff` com `FileDiff[]`. |
| Aprovacao | `permission.updated`, resposta `once`, `always` e `reject`, depois `permission.replied`. |
| Subagente condicional | `parentID`, `/children` e parte `subtask` somente se o `/doc` do binario os expuser. |
| Erros HTTP | `400`, `401`, `403`, `404`, resposta malformada e provider/modelo ausente. |
| SSE interrompido | Fechar `/event`, reconectar, recarregar sessoes/status/mensagens/diff e provar que nao ha replay presumido. |
| Incompatibilidade | Remover um path requerido, alterar um schema requerido ou omitir `server.connected`; o cliente deve bloquear prompts e emitir erro observavel. |
| Restart | Encerrar o processo controlado, iniciar outro, repetir probe e provar que aprovacao pendente nao e restaurada automaticamente. |
| Seguranca | Inspecao dos logs confirma ausencia de prompt, diff, credencial e payload integral. |

Para provider/modelo, o fixture pode retornar objetos `Provider`/`Model` para
testar descoberta e validacao, mas isso nao prova inferencia. A evidencia de
provider precisa de uma segunda etapa contra `opencode serve` real e uma
configuracao local explicitamente autorizada, sem registrar a credencial.

Procedimento minimo quando houver um binario fixado:

```text
opencode serve --hostname 127.0.0.1 --port <owned-port>
curl --fail --silent http://127.0.0.1:<owned-port>/global/health
curl --fail --silent http://127.0.0.1:<owned-port>/doc
curl --no-buffer http://127.0.0.1:<owned-port>/event
```

O teste deve registrar a versao de `/global/health`, o hash da especificacao
`/doc`, a plataforma, o workspace temporario e o comando. Nao deve registrar o
conteudo das mensagens ou dos headers de credencial.

## 10. Lacunas e riscos

| Lacuna/risco | Tratamento atual |
| --- | --- |
| Release/patchset bundled ainda nao fixados como artefato | O probe de `1.18.23` valida o contrato HTTP/SSE, mas T-021/T-022 e o suporte de release continuam condicionais ao bundle service-only. |
| API publica pode evoluir | Probe `/doc`, adaptador unico e fixture versionado; nao usar fallback especulativo. |
| Discrepancia `permission.asked` versus `permission.updated` | Usar o SDK/OpenAPI do binario testado; manter `permission.asked` nao suportado ate evidencia. |
| Discrepancia `remember?` na prosa versus tipo gerado somente com `response` | Enviar somente `response`; revisar no `/doc` da versao fixada antes de ampliar. |
| SSE nao documenta replay | Reconsultar estado por HTTP apos queda; nao prometer entrega exatamente uma vez. |
| Default de permissao do OpenCode e permissivo | Exigir workspace confiavel e aprovacao explicita na UI; nao depender do default. |
| Provider/modelo sem teste ou entitlement | Nenhum provider/modelo e anunciado; usar somente IDs retornados e posteriormente testados. |
| Credenciais podem aparecer em configuracao ou ambiente | OpenCode permanece dono; unigma nao chama endpoints de auth e redige diagnosticos. |
| Worktree, MCP, plugins e SSH tem contratos separados | Usar Git/T-041, T-012 e T-013; nao ampliar T-011. |

Este documento nao aprova AC-003 ou AC-008 sozinho. O aceite exige fixture,
teste contra processo controlado, versao registrada e evidencia reproduzivel;
no estado atual ambos continuam bloqueados conforme
[ACCEPTANCE.md](ACCEPTANCE.md).

## 11. Fontes

Fontes publicas consultadas em 2026-08-23:

- [OpenCode Server](https://opencode.ai/docs/server): CLI, defaults, health,
  OpenAPI, endpoints HTTP e SSE.
- [OpenCode SDK](https://opencode.ai/docs/sdk): cliente, endpoint de eventos,
  tipos gerados e semantica de `prompt_async`.
- [OpenCode Providers](https://opencode.ai/docs/providers): providers locais e
  remotos, configuracao e local de credenciais.
- [OpenCode Config](https://opencode.ai/docs/config): precedencia, providers,
  server e permissao.
- [OpenCode Models](https://opencode.ai/docs/models): formato de IDs e limites
  da lista de modelos.
- [OpenCode Permissions](https://opencode.ai/docs/permissions): acoes
  `allow`/`ask`/`deny` e respostas de aprovacao.
- [OpenCode Plugins](https://opencode.ai/docs/plugins): catalogo publico de
  nomes de eventos, usado aqui para registrar a discrepancia de permissao.
- [Schema publico de configuracao](https://opencode.ai/config.json): campos de
  server, provider, model e permission.
- [SDK gerado `types.gen.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts):
  tipos `Event`, `GlobalEvent`, `Session`, `Permission`, `Provider` e `Model`.

Fontes locais de escopo e aceite:

- [ARCHITECTURE.md](ARCHITECTURE.md): fronteira do processo, HTTP/SSE, loopback,
  credenciais e fixture controlado.
- [OPENCODE-SERVICE-ONLY.md](OPENCODE-SERVICE-ONLY.md): harness oficial,
  patchset, bundle, atualização atômica e suporte.
- [REQUIREMENTS.md](REQUIREMENTS.md): RQ-002, RQ-003, RQ-007, RQ-103 e RQ-104.
- [ACCEPTANCE.md](ACCEPTANCE.md): AC-003, AC-008 e regra de evidencia.
- [BACKLOG.md](BACKLOG.md): objetivo, criterios e testes de T-011.

## 12. Comandos de validacao

Os comandos executados para esta entrega, no checkout correto, sao:

```text
git -C E:\unigma status --short
git -C E:\unigma diff --check
git -C E:\unigma diff -- docs/OPENCODE-COMPATIBILITY.md
```

No checkout principal do unigma não foram executados `npm ci`, build ou deploy.
O candidato isolado foi instalado, construído e sondado em loopback, conforme a
evidência de T-096 em [OPENCODE-SERVICE-ONLY.md](OPENCODE-SERVICE-ONLY.md); isso
não equivale a teste do bundle service-only. O checkout fonte principal foi
apenas inspecionado em leitura e não recebeu alterações; a revisão registrada é
candidata de upstream, não commit de um artefato bundled.


## evidência T-011 — probe real de 2026-08-26

Foi executado um probe independente contra `/usr/bin/opencode` `1.18.23`,
verificado localmente pelo SHA-256
`f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f`. A
instância foi iniciada com `--pure`, ambiente HOME/XDG temporário e loopback
`127.0.0.1:4097`; nenhum provider ou credencial foi configurado.

Resultado: health (`200`), OpenAPI `3.1.0`, os 14 pares declarados no
`doc.paths`, `/path`, SSE com primeiro evento `server.connected`, listagem e
criação de sessão, status, sessão, mensagens, diff, `prompt_async` (`204`),
abort (`200`) e rota de permissões (`400` para payload sintético) responderam
conforme o perfil. O `OpenCodeHttpClient.connect()` do checkout também
passou contra a mesma instância real. O probe consultou `/provider` e
`/config/providers`, mas não anunciou provider/modelo.

Duas diferenças reais foram incorporadas ao adaptador e à fixture: `/doc` é
consultado diretamente, mas não aparece como operação dentro do próprio
OpenAPI; `/path` usa `directory` e `worktree` na release testada, e este último
é a raiz Git, não necessariamente o diretório autorizado. A suíte-fonte do
cliente não foi executada porque `mocha` não está instalado; a checagem de
sintaxe e o probe independente passaram.

## evidência T-011 — reavaliação da release fixada em 2026-08-26

O tag local `v1.18.23` resolve para
`31c409a86510e80fd6f798da165c50a6a40fccba` (2026-08-25). O executável externo
`/usr/bin/opencode` retornou `1.18.23`; seu SHA-256 Linux é
`f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f`. Não havia
artefato Windows local nem manifesto local que associasse esse SHA ao commit,
portanto SHA Windows e proveniência binário→commit permanecem não verificados.

O processo foi iniciado em workspace, `HOME` e diretórios XDG temporários, com
`/usr/bin/opencode --pure serve --hostname 127.0.0.1 --port <porta>`. Não foram
fornecidas credenciais, configuração de provider, plugin externo ou prompt
real; cada chamada loopback usou `curl --connect-timeout 2 --max-time 5` (SSE:
`--max-time 2`). A release respondeu `healthy: true`, `version: "1.18.23"`,
OpenAPI `3.1.0` com 162 paths e os 14 pares requeridos. Após a resposta estar
disponível, o SHA-256 de `/doc` foi
`dfb7d42a555389f0c662fa2b4a8af1d61633c96710cf54bce3ff2404e2e7d896`; uma
primeira leitura durante o startup retornou corpo vazio e não é evidência de
contrato.

No workspace temporário, `/path` retornou `directory` igual ao diretório de
trabalho e `worktree: "/"`; isso confirmou que `worktree` não pode ser exigido
como igualdade ao workspace. `/event` iniciou com `server.connected`. A sessão
criada respondeu `200` para listagem, status, detalhe, mensagens e diff;
`prompt_async` com `parts: []` respondeu `204`, `abort` respondeu `200`, e a
resposta `once` para uma permissão sintética respondeu `400`, sem
autoaprovação. O processo foi encerrado e iniciado de novo na mesma porta,
repetindo health, `/doc` com o mesmo hash, `/path` (`200`), SSE
`server.connected` e listagem de sessões (`200`).

`GET /provider` (`200`, 5 626 569 bytes) e `GET /config/providers` (`200`,
4 970 bytes) foram consultados apenas como descoberta sem credencial. Nenhuma
resposta foi promovida a provider/modelo suportado, e não houve inferência. A
execução das suítes compiladas permanece bloqueada pela ausência de
`node_modules`/`mocha`; o comando falha com `Cannot find module
'/home/dasher/projects/unigma/unigma/node_modules/mocha/bin/mocha'`. Não se
instala dependência para este gate.

**Estado da reavaliação: parcial.** O transporte real, a versão, o SHA Linux,
health, `/doc`, `/path`, SSE inicial, sessão, endpoints de diff/permissão,
restart e descoberta sem credencial foram observados. Permanecem sem execução
contra o cliente compilado: fixture de incompatibilidade, SSE interrompido e
reconectado pelo adaptador, eventos de prompt/streaming, diff não vazio e uma
permissão pendente real. Esses cenários exigem a suíte local compilada ou um
provider local explicitamente autorizado; não devem ser simulados como suporte
de provider nem avançam T-012.

## evidência T-011 — contrato do cliente contra o binário real em 2026-08-30

O `OpenCodeHttpClient` compilado foi executado contra `/usr/bin/opencode`
`1.18.23` iniciado com `serve --pure --port <porta-reservada> --hostname
127.0.0.1`, em workspace e `HOME`/XDG temporários, sem provider, credencial ou
plugin externo. `connect()` passou: health `200` com `healthy: true` e
`version: "1.18.23"`, OpenAPI `3.1.0` com 162 paths e os 14 pares requeridos,
`/path` com `directory` igual ao workspace e primeiro evento SSE
`server.connected`. O SHA-256 de `/doc` continua
`dfb7d42a555389f0c662fa2b4a8af1d61633c96710cf54bce3ff2404e2e7d896`.

Uma incompatibilidade real do adaptador foi encontrada e corrigida:
`GET /provider` é `documentado / requerido`, mas a release responde
`200` com `5 750 600` bytes num workspace vazio, acima do limite único de
4 MiB que o cliente aplicava a toda resposta HTTP. O `send()` falhava com
`OpenCode response is too large.`. O limite HTTP passou a 16 MiB e o guarda de
buffer de um único evento SSE permaneceu em 4 MiB, porque nenhum evento
observado se aproxima desse tamanho. Nenhum endpoint foi inventado e nenhum
provider/modelo foi promovido a suportado.

Fatos adicionais observados na mesma release, sem alteração de código:

| Fato | Observação |
| --- | --- |
| `serve --port 0` | Não usa porta efêmera: o processo anuncia `opencode server listening on http://127.0.0.1:4096`. O runtime continua reservando e passando uma porta explícita, que o servidor respeita e anuncia. |
| Anúncio de endpoint | A porta efetiva aparece no **stdout** do filho, junto de `Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.`; o `stderr` fica vazio. |
| `/path` | Campos `home`, `state`, `config`, `worktree` e `directory`; fora de um repositório Git `worktree` é `/`, confirmando que só `directory` é autoridade de workspace. |
| Envelope SSE | O evento traz `id` além de `type` e `properties`; o adaptador ignora o campo extra sem erro. |
| Encerramento | `SIGTERM` encerra o processo em ~19 ms; a política de posse do supervisor não precisa de `SIGKILL` no caminho feliz. |
| Rota desconhecida | `GET /not-in-profile` responde `200` (fallback de UI web do binário atual). O cliente continua bloqueando por allowlist do `/doc`, não por status HTTP. |
| `POST /session/{id}/prompt_async` com `parts: []` | `204` sem corpo; `abort` responde `200` com `true`; `permissions/{id}` inválido responde `400` sem autoaprovação. |

O teste de integração `openCodeRealE2E.test.ts` reproduz esse cenário, mas só
executa com `OPENCODE_REAL_E2E=1` e quando `/usr/bin/opencode --version`
retorna exatamente `1.18.23`. A suíte padrão não depende do executável externo
e nenhuma fixture é apresentada como prova de binário suportado.

Comandos executados nesta rodada, sob Node `24.18.0`:

```text
npm run gulp compile-extension:unigma-agent-runtime   # 0 erros
npm --prefix extensions/unigma-agent-runtime test     # 61 passing, 1 pending
OPENCODE_REAL_E2E=1 npm --prefix extensions/unigma-agent-runtime test  # 62 passing
npm run typecheck-client                              # sem erro
npm run test-build-scripts                            # 262/262
npm exec -- eslint <arquivos alterados>               # sem achado
git diff --check                                      # limpo
```

**Estado desta rodada: parcial.** O contrato HTTP/SSE do cliente compilado agora
é executado contra o binário real e o limite de resposta deixou de bloquear uma
operação requerida. Continuam sem evidência: prompt real com provider, streaming
de mensagem, diff não vazio, permissão pendente real, queda e reconexão do SSE
provocadas pelo servidor real, execução em Windows e o bundle service-only. Nada
disso pode ser suprido por fixture, e o probe externo continua não sendo prova de
release suportada.
