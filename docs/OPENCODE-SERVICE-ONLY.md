# OpenCode — perfil service-only

> **status:** direção de produto confirmada em 2026-08-26; pipeline e artefato
> ainda não implementados. Este documento define o alvo do backend local do
> agente, não declara suporte de uma release empacotada.

> **esclarecimento em 2026-08-27:** `opencode serve` já é um servidor headless.
> Portanto, o decepador não é necessário para “tirar a UI” do processo em tempo
> de execução. Ele continua sendo a cadeia de distribuição que prova a fronteira
> `service-only`; nenhuma poda ampla deve ser feita sem evidência de uma superfície
> redundante realmente alcançável ou empacotada.

## 1. fronteira

O OpenCode é o único harness/backend local oficial do unigma. O produto oficial
é distribuído como `unigma+opencode`: um pacote do unigma que contém uma versão
fixada do OpenCode preparada para operar como serviço headless no host do
workspace.

Neste documento, **decepador** é o pipeline reprodutível que transforma uma
árvore upstream em um candidato de runtime service-only. Ele não modifica uma
instalação do OpenCode pertencente ao usuário, não intercepta tráfego e não é um
instalador de providers ou plugins.

| superfície | posição do produto |
| --- | --- |
| `unigma+opencode` | harness oficial do MVP, sujeito a versão, patch e testes fixados |
| OpenCode nativo | fonte de verdade de sessões, ferramentas, permissões, plugins, MCP, skills e providers autorizados |
| extensões externas de Codex ou Claude Code | podem ser instaladas manualmente pelo usuário, mas não têm suporte oficial nem substituem o runtime do produto |
| `unigma+pi` | experimento separado; não é substituto nem compromisso de distribuição |
| catálogo/Marketplace próprio | não existe; o unigma não cria segundo carregador de plugins |

## 2. o que permanece no harness

O perfil service-only preserva, salvo incompatibilidade comprovada, o harness do
OpenCode e suas decisões de execução:

- ciclo de sessão e retomada;
- tool loop, execução de ferramentas e permissões;
- compaction, limites dinâmicos, retries e tratamento de erro;
- plugins, MCP, rules e skills conforme as fontes e políticas do OpenCode;
- providers/modelos configurados localmente pelo usuário;
- streaming, eventos, subagentes e relações entre sessões;
- configuração, armazenamento e diagnósticos próprios do OpenCode.

O unigma apresenta e coordena essas capacidades pela UI nativa e pelo runtime
interno. Não reimplementa o harness no workbench.

## 3. o que é removido ou redirecionado

O patch do perfil remove ou redireciona somente superfícies que duplicam a
experiência do unigma:

- TUI e entradas de apresentação interativa do OpenCode;
- onboarding, prompts interativos e comandos de uso direto que pressupõem que o
  OpenCode é a aplicação principal;
- navegação, todo/plan UI e outras superfícies visuais redundantes;
- qualquer caminho que tente substituir a contribuição nativa `unigmaAgent`.

Remover uma superfície não autoriza apagar sem análise o código do harness que
ela utiliza. O patch deve ser pequeno, revisável, testado e reaplicável sobre o
commit upstream escolhido.

## 4. pipeline do decepador

Cada candidato segue a mesma cadeia, com entradas e saídas registradas:

```text
commit/tag upstream do OpenCode
  -> checkout limpo
  -> patch service-only revisável
  -> testes do OpenCode + contrato HTTP/SSE do unigma
  -> auditoria de licença, notices e proveniência
  -> artefato versionado unigma+opencode
```

O manifesto do artefato deve registrar, no mínimo, commit/tag upstream, série e
hash dos patches, versão efetiva, plataforma, hashes dos arquivos relevantes,
comandos executados e resultado dos testes. Binários não entram no repositório;
um artefato só pode ser candidato de suporte depois de verificado no alvo
correspondente.

## 5. bundle, atualização e rollback

- o bundle é parte do artefato do aplicativo, não uma dependência mutada no
  ambiente do usuário;
- a troca de versão ocorre somente com o processo parado ou após reinício
  explícito; não substituir arquivos em uso;
- a substituição do bundle é atômica e mantém uma versão anterior suficiente
  para rollback;
- configurações, credenciais, sessões, histórico e demais dados do usuário
  permanecem fora do bundle e não são copiados, migrados ou interpretados pelo
  decepador;
- falha de validação rejeita o artefato inteiro e preserva a versão corrente;
- atualização autorizada não implica download automático, servidor central,
  telemetria ou mecanismo próprio de conta.

O comportamento é análogo à atualização atômica de um aplicativo desktop, não à
alteração in-place de uma instalação arbitrária do OpenCode.

## 6. compatibilidade e suporte

O perfil exige uma combinação verificável de:

1. commit upstream do OpenCode;
2. patchset service-only identificado;
3. versão e SHA-256 do executável por plataforma;
4. probe de health, `/doc`, `/path`, SSE, sessão, diff, permissão e restart;
5. teste do `OpenCodeClient` e do fluxo local do unigma;
6. auditoria de licenças, notices, identidade e dados preservados.

O probe de `/usr/bin/opencode` `1.18.23` registrado em
[`OPENCODE-COMPATIBILITY.md`](OPENCODE-COMPATIBILITY.md) é evidência de contrato
HTTP/SSE, não prova de que o binário já seja o bundle oficial service-only.

## 7. inventário pré-patch

### evidência local

Em 2026-08-26, o inventário read-only registrou o binário instalado em
`/usr/bin/opencode` e, depois, o checkout upstream fornecido para a análise de
fonte:

| item | valor |
| --- | --- |
| versão | `1.18.23` |
| SHA-256 | `f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f` |
| formato | ELF x86-64, dinamicamente ligado, não stripped |
| checkout upstream fixado | `/home/dasher/projects/unigma/opencode`, branch `dev`, HEAD `c2eacd72afc4a4984564c393e15ab30011057269`, árvore limpa |
| versão dos pacotes fonte | `packages/opencode`, `packages/core` e `packages/server`: `1.18.23` |

As superfícies abaixo foram observadas somente pela saída de `--help` do binário:
`opencode --help`, `serve`, `web`, `attach`, `run`, `acp`, `mcp`, `providers`,
`agent`, `session`, `plugin`, `debug`, `github` e `db`. Nenhum servidor foi
iniciado, nenhuma instalação ou atualização foi executada e não houve acesso de
rede. A saída de ajuda é evidência da superfície CLI, não evidência de módulos
internos ou do commit upstream que produziu o binário.

### evidência de fonte fixada

O mapa de módulos abaixo foi lido no repositório `origin` de
`https://github.com/anomalyco/opencode`, na revisão
`c2eacd72afc4a4984564c393e15ab30011057269`. A branch local é `dev`, conforme a
convenção do upstream, e `git status --short` não produziu saída. A versão dos
pacotes coincide com a versão observada no binário, mas não há atestado de que
`/usr/bin/opencode` tenha sido construído a partir desta revisão.

### mapa de módulos no commit fixado

| domínio | evidência no upstream | decisão service-only |
| --- | --- | --- |
| agregador CLI | `packages/opencode/src/index.ts:1-142`; `yargs` registra comandos, flags globais, `UI`, `Heap` e encerramento do processo | remover/redirecionar como entrada distribuída; não remover o harness compartilhado por causa do agregador |
| entrada headless | `packages/opencode/src/cli/cmd/serve.ts:6-23` chama `Server.listen`; `packages/opencode/src/server/server.ts:73-115,271-325` monta rotas raiz, evento, PTY, instância, V2, `/doc` e `uiRoute` | preservar/redirecionar para o serviço; retirar a apresentação `uiRoute` e as opções de exposição não permitidas, sem perder o ciclo de vida HTTP |
| camada V2 compartilhada | `packages/server/src/routes.ts:1-68`; `createRoutes`, `createEmbeddedRoutes`, `applicationServices` e `handlers` são fornecidos pela `serverRoutes` do servidor local | preservar os serviços e handlers necessários; não tratá-la isoladamente como o entrypoint bundled |
| contrato HTTP | `packages/opencode/src/server/routes/instance/httpapi/api.ts:48-94` expõe `RootHttpApi`, `InstanceHttpApi`, `OpenCodeHttpApi` e `PtyConnectApi`; `packages/protocol/src/api.ts:25-64` define os grupos V2 `health`, `location`, `agent`, `session`, `message`, `model`, `provider`, `integration`, `credential`, `permission`, `fs`, `command`, `skill`, `event`, `pty`, `question`, `reference` e `projectCopy` | preservar o contrato necessário, mas fechar uma allowlist explícita antes do patch; a API atual é mais ampla que o perfil mínimo |
| sessões e execução V2 | `packages/core/src/session/{execution.ts,execution/local.ts,run-coordinator.ts,prompt.ts,runner/,history.ts,projector.ts,compaction.ts,context-epoch.ts,message.ts,input.ts,event.ts}` | preservar; são o ciclo de sessão, admissão, execução, histórico, compaction e eventos duráveis |
| eventos e streaming | `packages/server/src/handlers/event.ts:20-52`; `EventV2`, stream SSE limitado, `server.connected` e heartbeat | preservar; o runtime consome os eventos sem transportar a apresentação TUI |
| ferramentas e permissões | `packages/core/src/tool/{tool.ts,application-tools.ts,tools.ts,registry.ts,builtins.ts}` e `packages/server/src/handlers/permission.ts` | preservar; `Tool.make`, registro por escopo e aprovação são harness; a adaptação legada fica para análise de consumidores |
| providers, configuração e skills | `packages/core/src/provider.ts`, `src/plugin/provider/`, `src/config/`, `src/skill/`, `src/instruction-context.ts` e `src/system-context/` | preservar; configuração local e capacidades nativas continuam sob o OpenCode |
| plugins e MCP | `packages/core/src/plugin/`, `packages/opencode/src/plugin/`, `packages/opencode/src/mcp/`, `packages/core/src/v1/config/mcp.ts` e `packages/opencode/src/tool/registry.ts` | preservar a capacidade nativa; remover comandos CLI e resolver no patch a adaptação legada/registro canônico, sem catálogo paralelo |
| banco e estado | `packages/core/src/database/`, `src/session/sql.ts`, `src/session/store.ts`, `src/permission/sql.ts`, `src/event/sql.ts` e `src/tool-output-store.ts` | preservar; são estado/histórico do harness, fora do bundle de distribuição do unigma |
| processos e PTY | `packages/core/src/process/`, `src/cross-spawn-spawner.ts`, `src/shell.ts`, `src/pty/` e `packages/server/src/handlers/pty.ts` | preservar quando necessários ao tool loop; definir no patch a fronteira de PTY/ticket, sem expor controle TUI |
| camadas legadas | `packages/opencode/src/session/{retry.ts,overflow.ts,compaction.ts}`, `src/storage/`, `src/tool/registry.ts` e `src/tool/task.ts` | redirecionar ou remover somente após mapear consumidores; preferir Session V2 e registro canônico do Core |
| comandos e entradas interativas | `packages/opencode/src/cli/cmd/{tui.ts,web.ts,attach.ts,run.ts,acp.ts}` e `src/cli/tui/worker.ts` | remover da entrada bundled; reconexão, envio e apresentação passam pelo runtime/workbench |
| apresentação e clientes | `packages/tui`, `packages/app`, `packages/web`, `packages/desktop` e `packages/ui` | remover do runtime service-only; o workbench nativo do unigma é a superfície oficial |
| empacotamento do executável | `packages/opencode/script/build.ts:26-50,159-202` embute web UI e inclui `src/index.ts`, `src/cli/tui/worker.ts` e worker Tree-sitter; `packages/opencode/bin/opencode` seleciona o binário por plataforma | alterar o entrypoint/inputs do bundle para não carregar UI/TUI; manter apenas os recursos necessários ao serviço e validar o wrapper por plataforma |

O pacote `packages/opencode` é deliberadamente um agregador amplo: depende de
Core, Server, Protocol, SDK, TUI, Plugin, LLM e Codemode. O decepador deve podar
entradas e apresentação sem transformar essa observação em remoção cega de
dependências; cada remoção precisa de patch revisável e teste do serviço.

### decisões por superfície

| superfície observada | decisão service-only | dono explícito |
| --- | --- | --- |
| `opencode serve` e suas opções internas de porta/host | preservar como única entrada de processo; forçar loopback e porta pertencente ao runtime | supervisor do runtime + harness OpenCode |
| health, `/doc`, `/path`, `/event`, sessões, mensagens, diff e permissões HTTP/SSE | preservar; a matriz de compatibilidade define o contrato mínimo e o `OpenCodeHttpClient` valida/traduz | serviço OpenCode + runtime do unigma |
| sessões/retomada, tool loop, permissões, compaction, limites e retries | preservar; não remover código compartilhado ao podar a apresentação | harness OpenCode |
| plugins, MCP, rules, skills, providers/modelos e diagnósticos | preservar como capacidades/fontes nativas do OpenCode; sem catálogo, credencial ou carregador paralelo do unigma | configuração e harness OpenCode |
| streaming, eventos e relação pai/filha de subagentes | preservar; o runtime consome eventos e o workbench renderiza estados | harness OpenCode + runtime/workbench |
| `opencode [project]`, TUI padrão, `--mini`, replay e navegação interativa | remover da entrada distribuída ou redirecionar ao workbench nativo | contribuição `unigmaAgent` |
| `opencode web` | remover da entrada distribuída; o workbench é a UI oficial | contribuição `unigmaAgent` |
| `opencode attach` e `run --interactive` | remover como cliente interativo; reconexão e envio passam pelo runtime interno | runtime + workbench |
| `run`, `--prompt`, `--model`, `--agent`, `--continue`, `--session`, `--fork`, `--share` e `--auto` | não expor como comandos/flags de uso direto; preservar somente APIs compartilhadas necessárias ao serviço e à aprovação explícita | runtime/workbench; permissões no harness |
| `acp` | não usar como transporte alternativo no MVP; permanece fora do bundle service-only aceito | runtime OpenCode; protocolo remoto dormente |
| `mcp`, `providers`, `agent`, `session`, `plugin`, `models`, `stats`, `export`, `import`, `db`, `debug` e `completion` | não expor como superfície de uso do produto; não apagar módulos antes do mapeamento no source checkout | harness/configuração para capacidades; workbench para apresentação |
| `github`, `pr`, compartilhamento, `upgrade` e `uninstall` | remover ou desabilitar no bundle; cloud, fluxo GitHub e ciclo de vida pertencem a fronteiras explícitas do produto | runtime desktop e políticas local-first |
| `--mdns`, `--cors` e exposição LAN | remover ou rejeitar; o serviço só aceita `127.0.0.1` no MVP | supervisor do runtime |
| username/password do servidor | não transportar nem persistir credenciais; `401`/`403` é incompatibilidade observável | supervisor/runtime; credencial continua fora do unigma |

### limite do inventário

O checkout agora permite apontar arquivos e módulos do upstream no commit
fixado. Ainda assim, este passo foi estático: não houve build, teste ou execução
do servidor a partir do checkout, e o probe headless registrado em
`OPENCODE-COMPATIBILITY.md` continua sendo do binário instalado. A coincidência
de versão não substitui a proveniência do executável.

Permanecem explícitas, para o patch e seus testes, estas fronteiras técnicas:

- a API declarada inclui grupos além da allowlist mínima; o patch deve fechar o
  contrato aceito sem remover handlers compartilhados por suposição;
- Session V1 e Session V2 coexistem em áreas diferentes; a execução service-only
  deve preferir o Core V2 sem apagar a camada legada antes de mapear consumidores;
- MCP e plugins têm composição entre Core e `packages/opencode`, e o registro
  canônico ainda precisa ser decidido;
- storage, `task`/subagente e PTY têm consumidores legados ou de apresentação que
  precisam de teste de regressão.

Com isso, T-095 está **concluída no recorte de inventário estático pré-patch**:
cada superfície observada tem decisão, evidência de CLI ou fonte e dono
explícito. T-096 está **em preparação, mas não aceita**: existe um rascunho
local não commitado em `/home/dasher/projects/unigma/opencode-service-only-candidate`
com entrypoint/build e corte de `uiRoute`, porém ainda não há patchset
versionado no unigma, manifesto ou bundle aceito. Depois da instalação
autorizada somente nesse worktree, o candidato passou `bun typecheck`,
`bun run script/build.ts --service-only --single --skip-install`, smoke de
`--version`, os testes in-process `httpapi-ui` (12) e
`httpapi-public-openapi` (18), além de probe loopback de health, `/doc`,
`/path`, SSE `server.connected`, 404 no fallback web e shutdown limpo. O diff
de 4 arquivos também foi reaplicado em uma segunda árvore limpa. Os testes
focados de sessão, evento, ações, diff, listen e autorização passaram (49 casos,
193 asserções); `test:httpapi` passou nos modos `coverage` e `auth` (208 casos
cada), mas o modo `effect` não terminou dentro de 900 segundos. O patch
temporário tem SHA-256
`a8190af0ab7dfa0ee01e4f4cf0b752f382253a019545da365aa468b88feae6c2`.

Essa evidência continua limitada ao candidato Linux: não houve teste completo
de prompt/provider real ou do modo `effect` completo, validação Windows,
manifesto ou pipeline versionado. O clone upstream principal e o unigma não
receberam esse código; nenhuma remoção adicional deve ser feita por varredura ou
inferência do binário.

## 8. implementação futura

O trabalho executável está dividido em T-095 a T-099 no
[`BACKLOG.md`](BACKLOG.md). Até a conclusão dessas tarefas, o estado correto é
“direção confirmada, artefato service-only não suportado”.

## referências

- [Arquitetura](ARCHITECTURE.md)
- [Produto](PRODUCT.md)
- [Decisões](DECISIONS.md)
- [Compatibilidade OpenCode](OPENCODE-COMPATIBILITY.md)
- [Requisitos](REQUIREMENTS.md)
- [Aceitação](ACCEPTANCE.md)
