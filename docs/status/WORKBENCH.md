# unigma — workbench operacional

> quadro vivo das frentes de trabalho. O histórico detalhado fica nos arquivos
> datados desta pasta; este quadro responde **o que está ativo, onde parou e qual
> é o próximo passo**.

**última atualização:** 2026-09-03

**feito nesta rodada:** o runtime resolve primeiro o OpenCode Linux x64 embarcado
em `resources/app/opencode/bin/opencode`, com licença e proveniência ao lado;
empacotamento, auditoria condicional e smoke focado foram ligados ao workflow.
Compile/testes locais são o limite desta rodada; runner e artefato ainda pendentes.

**feito nesta rodada:** superfícies de distribuição Linux/Windows e textos
exibidos pelas extensões foram remarcados para `unigma`; o Debian deixou de
registrar o repositório/chave Microsoft; o auditor agora verifica identidade
exibida em metadados do pacote. `npm run test-build-scripts` passou com 270
testes, além do teste focal do auditor e ESLint dos arquivos TypeScript alterados.
Isso ainda não é clearance legal nem validação de artefato empacotado.

## onde estamos, em uma leitura

O caminho remoto por SSH está construído e validado no runner de ponta a ponta,
**menos a matriz oficial e o workbench real**. Existe um par versionado, um
transporte OpenSSH, um staging com ativação atômica e dois smokes que provam os
dois lados contra um `sshd` real e um servidor real. O resolver agora devolve
`ResolvedAuthority`; o comando explícito de staging cobre a ausência do servidor
sem provisionar por omissão.

**o limite honesto desta rodada:** nenhuma evidência atual exercita o resolver.
Os três runs verdes na ref dele — matriz Linux `33692190082`, smoke de conexão
`33693339241` e smoke de staging `33693927993` — provam transporte, staging e
ativação, que o resolver *consome*. Abrir uma janela remota de verdade exige um
workbench real e continua sem cobertura. Por isso o remoto está implementado, não
suportado.

**próximo passo:** a matriz oficial `T-053`/`AC-007` — abrir a janela, sessão,
queda de conexão e reconexão contra um host real. É o que converte implementado
em suportado.

**logo depois:** o passo de Welcome que sugere configurar uma identidade SSH sem
gerar nem guardar chave, visível só em sessão SSH.

**depois disso**, por natureza do bloqueio: notices, titularidade e branding
(`E00-A`/`E00-B`) dependem de decisão humana; os épicos de produto
(`AC-003`, `AC-004`, `AC-006`, `AC-010`, `AC-011`, `T-043`) vêm quando o remoto
estiver fechado.

**dívidas conhecidas**, registradas para não virarem surpresa: o smoke de
conexão pré-popula o servidor em vez de exercitar o push do payload, por decisão
explícita, e quem cobre o push é o smoke de staging; `remote/LICENSE` ainda
carrega copyright herdado; e o auditor de distribuição, embora agora cubra o
pacote do servidor, não cobre o payload montado.

**foco atual:** implementação incremental de `E02/E03` no runtime OpenCode e
workbench nativo, mantendo os gates `E00/E01` em review/partial
do CLI Rust **preservando o Code Server**, em
[`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md),
que emenda no plano de ondas
[`../planos/2026-08-28-ondas-refundacao.md`](../planos/2026-08-28-ondas-refundacao.md)
entre a onda 1 e a colheita da onda 2. `CLI-001` está em `review`: os testes Rust
e a compilação de `terminal-suggest` passaram localmente; os gates de runner da
etapa A estão verdes.
`OVN-D024` fechou a matriz oficial em 2026-08-30 no head `91867fb1`; a matriz
final de contratos OpenCode/SSH fechou no head `d00521d6`: Windows
`33345230165` e Linux/WSL2 `33347302898` concluíram todos os passos, incluindo
instalação limpa, pacote, auditoria de distribuição, smoke e evidência de
artefato. As entradas formais estão em [`EVIDENCE.md`](EVIDENCE.md); o que
continua em aberto é o inventário de terceiros da raiz, clearance legal e
qualquer capacidade de E-02 em diante.
Os runs anteriores `33267418418` (Windows, `a3300897`) e `33279351708`
(Linux WSL, `e6b4e1bd`) permanecem como registro histórico do recorte do CLI.
Em 2026-08-30, `c00f37b3` removeu `@github/copilot` e `@github/copilot-sdk` da
raiz e de `remote/`, limpou as linhas correspondentes do About e removeu o
workaround morto do postinstall. `compile-client`, `typecheck-client`,
`test-build-scripts` (262/262), eslint e os testes do auditor passaram; os dois
lockfiles não contêm mais esses pacotes. O auditor root caiu de 721 para 695
manifest-only; CLI segue `rc=0`.
O notice root ainda não foi regenerado: o fluxo completo exige o artefato CG
interno do Azure DevOps, indisponível neste ambiente. A varredura interrompida
durante a poda da árvore foi descartada e não é evidência legal.
Nesta rodada, o caminho residual de Agent Sessions Welcome foi removido da
configuração de startup, layout, tema e contribuição de walkthrough; os três
arquivos da página órfã também foram removidos. A validação ainda é `review`,
pois compile/typecheck e runner precisam confirmar o recorte completo.
Em 2026-08-30, a execução Windows `33288698590` no commit `4814f40a` passou
build, checks e auditoria do pacote, mas falhou no smoke: 61 passaram e os dois
casos Integrated Browser dependentes de `workbench.panel.chat` falharam. O
recorte local seguinte desativa apenas essa superfície por `D-032`, preserva os
serviços compartilhados, declara os dois casos como capability não suportada e
adiciona uma asserção negativa. `compile-client`, `typecheck-client`, 60 testes
 do runtime, 6 testes da policy SSH, 262 testes de build e o teste focal da
 capability passaram sob Node `24.18.0`. O auditor da CLI com `--scope cli`
 retorna `0`, sem manifest-only ou licença ausente; o escopo root está em 695
 manifest-only e os 7 avisos de licença são falsos positivos do parser.

## quadro

| id | escopo | fase | estado | próximo passo verificável | depende de | fonte principal |
| --- | --- | --- | --- | --- | --- | --- |
| `DOC-001` | adaptar o workflow e reorganizar `docs/` | documentação final | `done` | manter este quadro na próxima solicitação multi-tarefa | nenhuma | [`README.md`](../README.md), [`fontes/MODELO-DE-TAREFAS.pdf`](../fontes/MODELO-DE-TAREFAS.pdf) |
| `OVN-001` | triagem, delegação e consolidação do overnight E00–E03 | implementação/verificação | `in_progress` | consolidar resultados de 1A–1F e dos recortes 2A/2B, desbloquear ambiente/gates humanos e não iniciar onda 3 | nenhum; sem colisão de arquivos | [`planos/2026-08-27-e00-e03-ondas.md`](../planos/2026-08-27-e00-e03-ondas.md), [`BACKLOG.md`](../BACKLOG.md) |
| `OVN-D024` | retirada do Agent Host herdado e do CAPI | implementação/review | `review` | executar compile/typecheck/testes e auditor de notices no runner após publicar a ref | T-100–T-104 locais; runner | [`../planos/2026-08-28-ondas-refundacao.md`](../planos/2026-08-28-ondas-refundacao.md), [`../DECISIONS.md`](../DECISIONS.md) |
| `CLI-001` | etapa A: desacoplar o Agent Host do CLI Rust, preservando Code Server, bridge, multiplexer, protocolo e `command-shell` | implementação/review | `review` | colher Node 24/runner, revisar notices e decidir tratamento do baseline clippy; não promover por teste local | auditoria CLI; `D-027`; `D-029` | [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md), [`2026-08-29-cli-audit.md`](2026-08-29-cli-audit.md) |
| `CLI-002` | etapa B: OpenSSH → `unigma-server` remoto → extension host → `unigma-agent-runtime` → `opencode serve` (T-050…T-053) | implementação/review | `review` | colher a matriz SSH no runner e validar a fiação do resolver; conexão e staging já passam isoladamente no runner | `CLI-001`, `D-028`, `D-032`, host autorizado | [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md), [`../SSH-CONTRACT.md`](../SSH-CONTRACT.md) |
| `CLI-003` | auditoria do `code tunnel` e de `@microsoft/dev-tunnels-*` (`Q-3`) | discovery | `ready` | levantar, sem alterar código, quem consome o subcomando `tunnel`, o que ele exige do serviço Microsoft e o que cairia junto; entregar veredito preservar/remover para decisão | nenhuma; não bloqueia `CLI-001` nem `CLI-002` | [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md) §7, [`2026-08-29-cli-audit.md`](2026-08-29-cli-audit.md) |
| `OVN-T105` | dependências órfãs após D-024 | backlog bloqueado | `blocked` | remover Claude/Codex do root e regenerar lockfile por instalação normal autorizada; `@microsoft/dev-tunnels-*` fica fora deste corte enquanto `Q-3` não for decidida; as crates `ahp`/`ahp-types` saem em `CLI-001`/A.6 | T-104; `CLI-001`; autorização de instalação | [`BACKLOG.md`](../BACKLOG.md), [`../DECISIONS.md`](../DECISIONS.md) |
| `OVN-T023` | verificar storage de referência, lifecycle e diagnóstico redigido | verificação | `review` | executar suíte compilada em Node 24 e confirmar ausência de conteúdo sensível | T-010/T-020, runner | [`2026-08-27-overnight.md`](2026-08-27-overnight.md) |
| `OVN-T020` | verificar esqueleto, ativação lazy e lifecycle do runtime | verificação | `review` | repetir compile e suíte de lifecycle em Node 24/npm <12 | T-010, runner | [`../planos/2026-08-27-e00-e03-ondas.md`](../planos/2026-08-27-e00-e03-ondas.md) |
| `OVN-T030` | verificar contribuição nativa e fronteira arquitetural | verificação | `review` | repetir compile/teste browser na matriz oficial e cobrir integração quando liberada | T-010, runner | [`../planos/2026-08-27-e00-e03-ondas.md`](../planos/2026-08-27-e00-e03-ondas.md) |
| `E00-A` / `T-002/T-004` | notices, terceiros e identidade de distribuição | release candidate | `blocked` | concluir inventário legal e classificar lacunas antes de release | revisão independente | [`2026-08-26-third-party-inventory.md`](2026-08-26-third-party-inventory.md), [`THIRD-PARTY-REVIEW.md`](THIRD-PARTY-REVIEW.md) |
| `E00-B` / `AC-012` | autoria, direitos e não colisão do branding | decisão de escopo | `partial` | manter obrigações legais e remover identidade upstream; prova formal não é gate por D-030 | D-030 | [`BRANDING-CLEARANCE.md`](BRANDING-CLEARANCE.md), [`../DECISIONS.md`](../DECISIONS.md) |
| `E01-A` / `T-010` | contrato RPC e erros sanitizados | regressão | `review` | executar/registrar a suíte integrada do workbench quando o alvo existir | build e harness do runner | [`BACKLOG.md`](../BACKLOG.md), [`2026-08-26-campanha.md`](2026-08-26-campanha.md) |
| `E01-B` / `T-011` | compatibilidade HTTP/SSE do OpenCode | evidência | `partial` | obter provider/modelo autorizado para prompt/streaming/diff real; depois validar bundle service-only | bundle service-only; provider autorizado | [`OPENCODE-COMPATIBILITY.md`](../OPENCODE-COMPATIBILITY.md) |
| `E01-C` / `T-012` | preflight local e bridge workbench↔extension host | regressão/runner | `review` | rodar validação oficial; depois conectar inventário plugin/regra e prova OpenCode real | `E01-B`, runner sequencial | [`LOCAL-INTEGRATIONS-POLICY.md`](../LOCAL-INTEGRATIONS-POLICY.md), [`2026-08-26-campanha.md`](2026-08-26-campanha.md) |
| `E01-D` / `T-013` | contrato SSH fail-closed | implementação/review | `partial` | provisionar fora do agente `sshd` + host key + `unigma-server` de teste; então executar matriz sem replay ou segredo | host Linux x64 e `unigma-server` autorizados | [`SSH-CONTRACT.md`](../SSH-CONTRACT.md) |
| `E01-E` | evidência e fechamento de E-00/E-01 | backlog | `blocked` | consolidar runs, artefatos, aceite e status após as frentes acima | E00/E01 pendentes | [`planos/2026-08-26-e00-e01.md`](../planos/2026-08-26-e00-e01.md) |
| `E02/E03` | runtime OpenCode e workbench nativo funcional | implementação | `in_progress` | fechar streaming incremental, permissões reais e contrato nativo de `@`/`/`; só então colher runner | E-00/E-01 em review/partial; provider/modelo autorizado para prompt real | [`BACKLOG.md`](../BACKLOG.md), [`OPENCODE-COMPATIBILITY.md`](../OPENCODE-COMPATIBILITY.md) |
| `E09` / `T-095..T-099` | perfil service-only e bundle `unigma+opencode` | backlog | `partial` | auditar superfícies do `serve` e transformar o resultado em patch mínimo, manifesto e artefato aceitos | E-00/T-011 | [`OPENCODE-SERVICE-ONLY.md`](../OPENCODE-SERVICE-ONLY.md) |
| `THEME-001` | tema embarcado `theme-unigma` | implementação/review | `review` | colher validação de pacote no runner; alto contraste próprio continua fora do escopo | auditoria e runner | `DECISIONS.md`, `REQUIREMENTS.md`, `ACCEPTANCE.md` |

## estados

- `backlog`: não iniciado ou sem autorização/pré-condição;
- `ready`: dependências claras e próximo passo executável;
- `in_progress`: execução em andamento;
- `review`: implementação existe, mas QA, security, regressão ou evidência ainda
  não fecharam a tarefa;
- `partial`: parte comprovada e pendência explícita; não é aceite;
- `blocked`: existe impedimento registrado; não mascarar como `ready`;
- `done`: todos os gates aplicáveis e a documentação foram concluídos;
- `cancelled`: removida por decisão explícita.

## como atualizar

1. Ao receber uma solicitação multi-tarefa, crie IDs locais (`DOC-`, `BUG-` ou o
   ID do backlog) e liste dependências antes de editar.
2. Marque somente uma linha como `foco atual`; cada troca registra o próximo
   passo da linha anterior.
3. Depois de cada comando relevante, atualize estado, evidência e bloqueio; não
   espere o fim do prompt para reconstruir a sequência.
4. Subagentes podem trabalhar em paralelo apenas quando os arquivos e decisões
   não colidem; findings voltam ao Lead, que distribui correções.
5. Ao fechar a frente, registre a transição no histórico datado e atualize
   `BACKLOG.md`/`ACCEPTANCE.md` sem promover hipótese a fato.

## fila de intervenção

| tipo | frente | necessário | estado |
| --- | --- | --- | --- |
| escopo | `E00-B` / `AC-012` | prova formal e trademark clearance não são gates por D-030; preservar obrigações legais aplicáveis | decidido |
| ambiente/permissão | `E01-A` / `E01-C` / `E01-D` | Node `24.18.0`/npm `<12` já disponível localmente; runner Windows/WSL e host Linux x64 autorizado continuam pendentes; nenhum segredo deve ser coletado | pendente |
| decisão técnica | `E01-B` / `E01-C` | bundle OpenCode fixado e inventário confiável de plugins/regras | pendente |
| escopo/aceite | `E02/E03` | manter 2A/2B como recortes verificados, sem promover os épicos sem os gates E00/E01 | pendente |
| implementação | `T-051` / `T-052` | transporte, staging, confirmação fail-closed e ativação atômica passam no runner com payload real | concluído |
| implementação | resolver / `AC-007` | `resolve()` devolve `ResolvedAuthority` e o staging tem comando com confirmação; falta exercitar contra um workbench real, que nenhum smoke cobre | aguardando matriz |
| implementação | Welcome / identidade SSH | passo de walkthrough visível só em sessão SSH, que sugere e explica o comando; não gera nem guarda chave, porque isso tornaria o produto custodiante de credencial | pacote seguinte |
| verificação | `T-053` / `AC-007` | matriz oficial SSH: abrir janela remota de verdade, sessão, queda de conexão e reconexão. É o que converte o resolver de implementado em suportado | próximo passo |
| dívida | payload | o auditor de distribuição cobre desktop e servidor, mas não o payload montado; o smoke de conexão pré-popula em vez de exercitar o push, por decisão explícita | registrado |
| decisão/poda | `Q-3` / `CLI-003` | poda concluída e validada no runner em 2026-09-02; o que resta é decisão futura, não trabalho pendente | concluído |
| autorização | `E00-A` / `E00-B` / notices | `remote/LICENSE` distribuído com o pacote do servidor ainda carrega o copyright herdado; titularidade, notices de terceiros e clearance continuam decisão humana | pendente |

## transições recentes

| data | id | transição | evidência |
| --- | --- | --- | --- |
| 2026-09-03 | `THEME-001` | tema próprio implementado → `review` | `theme-unigma` com dark/light, defaults do workbench e onboarding atualizados; `npm run test-theme-contrast` passou com texto entre `6,47:1` e `19,16:1` e foco entre `6,34:1` e `7,19:1`, `npm run test-build-scripts` passou com 269 testes e ESLint focal passou. Runner/pacote e alto contraste próprio continuam pendentes |
| 2026-09-02 | resolver / `AC-007` | `resolve()` deixou de recusar toda autoridade | `ac4e51ce`. Os gates continuam iguais; depois deles o resolver lê o commit do cliente de `appRoot/product.json` — mesmo mecanismo do `vscode-test-resolver`, injetado pelo build —, renderiza o destino preservando o alias byte a byte para não sobrescrever o `ssh_config` do usuário (§4.1/§4.3), chama `openRemoteServer` e devolve `ResolvedAuthority`. Commit ausente ou fora de SHA-1 recusa com `ssh.client-commit-unavailable`, sem adivinhar. Servidor não staged recusa com mensagem acionável que nomeia o comando `Stage Remote Server`, nunca provisionando sozinho (§5). `deactivate()` deixou de ser vazio e encerra sessões e leases. Lógica extraída para `remoteSshTarget.ts` e `remoteSshResolver.ts`, com `extension.ts` como fiação fina; 80 testes |
| 2026-09-02 | staging / UI | comando de staging com confirmação modal | o comando escolhe o diretório de payload por diálogo — sem caminho oculto, download ou CDN, que §5 recusa —, valida o manifesto e mostra host, versão, tamanho e hash antes de qualquer escrita. O hash aparece **só** nessa confirmação, conforme `D-033`, e não vai para o canal de output nem para log |
| 2026-09-02 | regressão | matriz Linux e os dois smokes verdes na ref do resolver | `unigma-linux-wsl-validation` `33692190082`, `unigma-remote-ssh-smoke` `33693339241` e `unigma-remote-staging-smoke` `33693927993` (`payload-mode.real`). A primeira tentativa da matriz, `33691430539`, falhou em `npm ci` com `ETIMEDOUT` buscando headers do Electron em `electronjs.org` após cinco tentativas: falha de rede do WSL, não do código, confirmada pela repetição verde. **Limite explícito:** nenhuma dessas evidências exercita o resolver. Elas provam transporte, staging e ativação, que ele consome; abrir uma janela remota de verdade exige workbench real e continua sem cobertura |
| 2026-09-02 | `T-052` / staging remoto | staging e ativação atômica passando no runner com payload real | `unigma-remote-staging-smoke` run `33686239262`, `smoke=pass` com `check.payload-mode.real`. Staging explícito com confirmação obrigatória, script POSIX entregue por stdin e nunca em argv — que é visível no `ps` do host remoto —, payload tar por stdin, validação remota de manifesto/tamanho/SHA-256, extração e `mv -T` atômico preservando a versão anterior. O smoke monta o par a partir do depósito, envia por SSH, ativa, confirma idempotência na segunda execução, e então sobe o servidor **ativado** pelo transporte de conexão e bate `GET /version` contra o commit. Payload montado em `1,2 s`, staging em `3,3 s` |
| 2026-09-02 | fiação do resolver SSH | implementação local → `review` | `compile-extension:unigma-remote-ssh`, suíte focada `80/80` e ESLint passaram. `remoteSshTarget.ts` preserva aliases puros; `remoteSshResolver.ts` separa gates, commit, transporte e mapeamento; ausência de servidor oferece somente um `ControlMaster` de staging até confirmação explícita. Runner e workbench real ainda pendentes |
| 2026-09-02 | smoke de staging | mock que se autoconfirmava foi barrado | a primeira versão caía num servidor sintético sempre que os caminhos de payload da máquina de desenvolvimento faltavam — o que é sempre, no runner, porque esses caminhos ficam fora do WSL. O sintético responde `GET /version` com um commit que mandaram ele imprimir, então `check.version-commit` era um mock confirmando a si mesmo, e `AGENTS.md` não aceita mock como evidência de suporte. O payload passou a vir do depósito publicado, único lugar dentro do WSL onde servidor e opencode reais coexistem; o `opencode-linux-artifact.yml` passou a publicar lá também (`published opencode-latest -> …/c2eacd72…`). O modo sintético continua existindo, mas tem de ser pedido pelo nome |
| 2026-09-02 | `T-051` / caminhos remotos | host passou a ser fonte de verdade sobre si mesmo | `d6091d62`. `remoteUserBaseDirectory` era fornecido pelo cliente, mas o cliente não sabe o `$HOME` do host remoto; o smoke não expôs isso porque escolhia o diretório dos dois lados. O script passou a derivar de `$HOME`, validando remotamente home inválido e limite de endereço do socket, com status próprios. A restrição que isso criou: `ssh -L <porta>:<socket>` precisa do caminho no momento em que a sessão é criada, e o sshd não expande `~`. Resolvido com `ControlMaster`: uma conexão, uma autenticação, o bootstrap emite o `socketPath` efetivo no handshake e o encaminhamento é acrescentado à mesma conexão com `ssh -O forward`. A convenção de caminho vive numa tabela de templates só, consumida pelo TypeScript e pelo shell, para não poder divergir. 63 testes; smoke `33660552878` passou no runner |
| 2026-09-02 | auditoria de distribuição | pacote do servidor passou a ser auditado | `44715b4f` e `e28a36e5`. O auditor era moldado no layout desktop e o servidor nunca era verificado — foi por isso que as três extensões de identidade upstream chegaram ao pacote sem ninguém notar. Novo perfil `--server` checa layout, identidade, galeria desabilitada, endpoints, extensões proibidas, conteúdo transiente e uma asserção nova: nenhuma extensão exclusivamente `ui` pode ser embarcada, que é exatamente a regressão do filtro de `extensionKind`. Roda no workflow **antes** de publicar no depósito, então o depósito nunca recebe pacote não auditado. Contra o artefato antigo `09aa87ff`, reprova pelos motivos certos; no build atual, `audit=pass` no run `33662153305`, seguido de `published unigma-server-latest -> …/e28a36e5…` |
| 2026-09-02 | auditoria / falso positivo | guarda corrigida antes de virar bloqueio | a checagem de conteúdo transiente sinalizava `node_modules/undici/lib/cache` e `node_modules/undici/lib/web/cache`, o que reprovaria **todo** build futuro do servidor. São fontes de dependência, não cache de runtime: cache de runtime é escrito ao lado da aplicação ou no diretório de dados do usuário, nunca dentro de uma árvore de dependências. A varredura deixou de descer em `node_modules`. Uma guarda que um build correto não consegue satisfazer é pior que nenhuma, porque a resposta vira desligá-la |
| 2026-09-02 | distribuição servidor | auditoria REH adicionada antes da publicação | `npm run test-build-scripts` passou com 267/267 testes; ESLint, YAML e `git diff --check` passaram; fixture servidor cobriu pacote válido, extensão proibida/Copilot, extensão UI-only, gallery habilitada e layout incompleto; o tar antigo `09aa87ff…` reprovou por extensões proibidas, UI-only e conteúdo transitório |
| 2026-09-02 | `T-051` / `T-053` | transporte refeito com autoridade de `$HOME` remoto | compile da extensão, 63 testes, eslint, `git diff --check` e smoke local passaram; o smoke usa `sshd` efêmero, `ForceCommand` e 16 checks, sem tocar no home real |
| 2026-09-02 | `T-051` / `AC-007` | smoke de conexão remota passando no runner | `unigma-remote-ssh-smoke` run `33656041461`, `smoke=pass` com 16 checks. O smoke sobe um `sshd` próprio em porta alta no loopback, como usuário comum, com config, host key, `authorized_keys` e `known_hosts` descartáveis; pré-popula o diretório versionado a partir de `unigma-server-latest`; e então chama o transporte real. Prova, em ordem: handshake pronto, porta local encaminhada aberta, `GET /version` respondendo `200` com **exatamente** o commit do `PROVENANCE.txt` — que é o que demonstra que o túnel chegou ao servidor certo e que cliente e servidor são o mesmo build (`D-028`) — e, após `dispose()`, o processo `ssh` encerrado com a porta local fechada. Não exercita transporte de payload: o diretório versionado é pré-populado, por decisão explícita |
| 2026-09-02 | smoke / ambiente | `sshd` instalado no WSL, com autorização | o smoke reportou `check.sshd=fail`: a imagem do WSL tinha `ssh` e `ssh-keygen`, mas não o servidor. Instalado por passo de workflow com autorização explícita do mantenedor. Isso provisiona a bancada de teste, não o produto: §5 do contrato continua proibindo o unigma instalar ou configurar `sshd` em host remoto, e o smoke não usa o serviço do sistema, suas host keys nem sua configuração |
| 2026-09-02 | smoke / dois defeitos | consertos que só a execução real revelou | primeiro, o script importava os módulos compilados por `import` estático enquanto a extensão gera CommonJS, então todo named export vinha `undefined` (`SyntaxError: Named export 'buildRemoteBootstrapScript' not found`); passou a usar `createRequire`, mantendo o transporte real sob teste em vez de uma reimplementação. Segundo, a autenticação falhava com `Permission denied (publickey)` porque o `StrictModes` do `sshd` percorre todos os pais de `AuthorizedKeysFile` e recusa um deles world-writable: o diretório de trabalho precisa ficar sob `/tmp` para o socket caber no limite de endereço, e `/tmp` é `1777`, então um arquivo `0600` dentro de um diretório `0700` do próprio usuário era rejeitado. O stderr bruto do OpenSSH da bancada efêmera passou a ser preservado ao lado do relatório, sem o que a falha no runner era apenas um nome de categoria |
| 2026-09-02 | `T-051` / `T-053` | smoke de conexão implementado; validação no runner pendente | seam opcional de `known_hosts`, script `build/unigma/smoke-remote-ssh.ts` e workflow WSL adicionados; o smoke local não foi executado porque sobe `sshd` |
| 2026-09-02 | `T-051` / transporte | transporte implementado e exercitado contra o servidor real | `5f78028d` e `e6641eb7` adicionaram `remoteServerHandshake.ts` (puro) e `remoteServerTransport.ts` (spawner injetado), 57 testes passando. O desenho evita descobrir porta remota dinâmica: o `unigma-server` sobe em `--socket-path` e o OpenSSH encaminha uma porta local para o socket UNIX remoto, então um único `ssh` com o script de bootstrap no stdin — nunca em argumento, que aparece no `ps` do host — cobre servidor e túnel. O servidor fica em foreground, de modo que encerrar o `ssh` encerra exatamente o processo que a autoridade criou (contrato §5.3). `--without-connection-token` é deliberado: o socket é UNIX, mora na área do usuário remoto e só é alcançável pela sessão já autenticada. `StrictHostKeyChecking=yes` porque §4.2 proíbe alterar `known_hosts`. Executado de verdade contra o pacote do servidor nesta máquina Linux x64: handshake `unigma-remote:{"status":"ready"}` com o socket escutando, e uma segunda execução concorrente recusada com `socket-occupied` |
| 2026-09-02 | `T-051` / defeitos encontrados na execução | dois consertos que só o teste real revelou | o caminho do socket dentro do diretório versionado estourava `sockaddr_un.sun_path` (108 bytes no Linux): o commit sozinho gasta 40, e o servidor respondia `listen EINVAL` para um diretório base tão comum quanto um checkout sob o home. O socket passou a ficar ao lado do diretório versionado, com prefixo de 12 caracteres do commit, e um caminho longo demais é recusado por nome em vez de virar `EINVAL` opaco. Além disso, a detecção de socket órfão dependia de `fuser`/`lsof`, pacotes opcionais: um host saudável sem eles falhava a conexão, e "há algo escutando" nunca provou que o processo era desta autoridade. A posse passou a ser reivindicada com `mkdir`, atômico em POSIX, com o pid gravado no lock para que uma sessão morta sem trap não bloqueie o host |
| 2026-09-02 | `T-053` / depósito de artefatos | cliente e servidor passam a coexistir no WSL | `f83866d4` adicionou `build/unigma/publish-latest-artifact.sh` e o chamou nos dois workflows Linux. O depósito fica em `~/.local/share/unigma-artifacts`, ao lado do de toolchains: versões sob `versions/<nome>/<commit>` e o ponteiro `<nome>-latest` trocado com `mv -T`, atômico no mesmo filesystem. Retém a versão anterior e poda as mais velhas. O cliente só é publicado em `success`, depois da auditoria e do smoke desktop. Confirmado no run `33640248825`: `published unigma-server-latest -> …/versions/unigma-server/d1e6a4a1…` |
| 2026-09-02 | pacote do servidor | dois defeitos corrigidos | `d1e6a4a1`. Primeiro: `gulpfile.reh.ts` comparava `manifest.extensionKind` com a string `'ui'`, mas o campo é array; o `switch` nunca casava e toda extensão com `main` era embarcada, inclusive `unigma-remote-ssh`, declarada `["ui"]`, cujo resolver não tem o que fazer no host remoto. Segundo: a lista de exclusão de identidade upstream existia só em `gulpfile.vscode.ts`, então o servidor levava `github`, `github-authentication` e `microsoft-authentication` — exatamente os nomes que `audit-distribution.ts` rejeita, mas o auditor só era apontado para o pacote desktop. A lista virou `build/unigma/distribution-excluded-extensions.ts`, consumida pelos dois gulpfiles e pelo auditor. Verificado no artefato do run `33640248825`: os cinco nomes sumiram e `unigma-agent-runtime` continua presente, como deve. `handlebars` passou a ser embarcada porque declara `["ui","workspace"]` |
| 2026-08-27 | `DOC-001` | `in_progress → done` | PDF entendido, fontes/plano/status reorganizados e links validados |
| 2026-08-27 | `OVN-001` | `backlog → in_progress` | triagem delegada em ondas read-only; bloqueios humanos registrados acima |
| 2026-08-27 | `OVN-001` | triagem → correção/verificação | bridge sanitizado e associado a workspace; permissão alinhada à matriz; auditor exclui `node_modules`; compile/lint/typecheck locais passaram |
| 2026-08-27 | `OVN-T023/T030` | backlog → `review` | diagnóstico allowlisted, filtragem de eventos tardios e proteção de lifecycle aplicadas; testes oficiais pendentes |
| 2026-08-27 | `OVN-001` | verificação local ampliada | `test-build-scripts`: 270 testes/40 suites; `compile-client`: passou em `2.47 min` sob Node 26; a tentativa Node 24 terminou em `tsgo exited with code unknown` após ~13 min |
| 2026-08-29 | `OVN-D024` | UI residual de Agent Sessions removida | busca estática sem `agentSessionsWelcomePage`, `AgentSessionsWelcomePage` ou `openAgentSessionsWelcome` em `src`; eslint e `git diff --check` passaram nos cinco arquivos alterados |
| 2026-08-27 | `D-023` / `E09` | decisão confirmada | `serve` já é headless; manter `service-only`, sem poda ampla antes de auditoria de superfícies alcançáveis/empacotadas |
| 2026-08-27 | `OVN-001` / onda 1 | lanes 1A–1F executadas | auditoria E00-A, bloqueio humano E00-B, compile/teste E01-A, auditoria headless E01-B, preflight E01-C e matriz pura E01-D registrados; onda 2 não iniciada |
| 2026-08-27 | `OVN-T020/T030` / onda 2 | recortes 2A/2B verificados | runtime compile + suíte oficial Node 24/npm 11 passaram com 59 testes; cliente compile anterior + 8 testes browser passaram em Node 26; compile-client na matriz Node 24 falhou no worker tsgo; runner e integração E02/E03 continuam pendentes |
| 2026-08-26 | `E01-C/T-012` | implementação → `review` | bridge serializável, preflight fail-closed, compile/teste local e typecheck; runner/inventário real pendentes |
| 2026-08-29 | `CLI-003` | criada em `ready` | `Q-3` separada por decisão explícita: o destino do `code tunnel` e de `@microsoft/dev-tunnels-*` vira auditoria própria, fora do escopo da etapa A |
| 2026-08-29 | `CLI-001` / `CLI-002` | criadas em `ready`/`blocked` | auditoria somente-leitura do CLI em [`2026-08-29-cli-audit.md`](2026-08-29-cli-audit.md); decisões `D-027` (preservar Code Server) e `D-028` (`unigma-server` do próprio fork); plano [`../planos/2026-08-29-cli-ssh-remoto.md`](../planos/2026-08-29-cli-ssh-remoto.md); nenhum código alterado |
| 2026-08-29 | `OVN-D024` / `T-100–T-104` | implementação → `review` | subsistema Agent Host, CAPI, SDK legado, registros de build e smoke/E2E removidos; busca estática sem import residual; runner, artefato e notices pendentes |
| 2026-08-30 | `E01-B` / `T-011` | contrato do cliente validado contra o binário real | `OpenCodeHttpClient` compilado conectou a `/usr/bin/opencode` `1.18.23` (health, OpenAPI `3.1.0`, `/path.directory`, SSE `server.connected`); `GET /provider` (`5 750 600` bytes) era rejeitada pelo limite de 4 MiB e o limite HTTP passou a 16 MiB, com o guarda de evento SSE mantido; teste opt-in `OPENCODE_REAL_E2E=1` adicionado; 61 testes + 1 pending por padrão, 62 com o E2E, `typecheck-client`, `test-build-scripts` 262/262 e eslint passaram sob Node `24.18.0`; prompt/streaming/permissão reais e bundle service-only continuam pendentes |
| 2026-08-30 | `E01-D` / `T-050/B.2` | scaffold → `partial` | resolver `ssh-remote` fail-closed, parsing sem segredo, probe `ssh -V` e gates locais implementados; transporte, `unigma-server`, host key e conexão real continuam bloqueados |
| 2026-08-29 | `CLI-001` / `T-110–T-113` | implementação → `review` | CLI Rust sem consumidores AHP, `PROTOCOL_VERSION=4`, módulos removidos, Code Server preservado; `cargo test` 33 testes e compile de `terminal-suggest` passaram; clippy baseline, Node 24/runner e notices pendentes |
| 2026-08-31 | `E02/E03` / `T-032/T-033` | backlog → implementação incremental | UI nativa passou a renderizar conteúdo/diff e aprovações; bridge mapeia `permission.asked`/`permission.replied` e o diff `SnapshotFileDiff`; compile/teste local anteriores passaram, runner e prompt real continuam pendentes |
| 2026-08-31 | `T-043` | implementação → `partial` | `/doc` do OpenCode `1.18.23` confirmou `/command` e `/skill`; contrato/catalogo transitório, parser e autocomplete nativos foram commitados. Retentativas Windows `33465962415` e Linux/WSL `33465963804` passaram; `@` continua textual até haver fonte de referências comprovada e T-044 permanece bloqueada por contrato intersessão |
| 2026-09-01 | `T-050` / `D-032` | contrato → implementação parcial | bootstrap SSH por push confirmado foi definido; validador puro do manifesto v1 passou em 9 testes focados. Transporte OpenSSH, geração do par, staging, ativação e VPS continuam pendentes; nenhuma escrita remota foi feita |
| 2026-09-01 | `T-050` / payload local | implementação parcial | checkout OpenCode `c2eacd72…`/1.18.23/MIT foi auditado; montador local do par com manifest SHA-256 passou 2 testes. O build externo, licença/notices de dependências, artefato final, staging e VPS ainda não foram executados |
| 2026-09-01 | providers/modelos | implementação parcial | runtime consulta `/provider?directory=` sob trust/preflight e emite IDs/rótulos sanitizados; painel nativo persiste a visibilidade global por usuário em `unigma.agent.hiddenModels`. Seleção por sessão exige modelo descoberto, usa `prompt_async.model` e só fica ativa na UI após ACK; validação no runner segue pendente |
| 2026-09-01 | OpenCode artifact | artefato produzido | `.github/workflows/opencode-linux-artifact.yml` fixou `OPENCODE_VERSION=1.18.23` e o run `33543332505` gerou `bin/opencode`, `LICENSE-opencode.txt` e `PROVENANCE.txt` do commit `c2eacd72…`; o binário respondeu `1.18.23`. Empacotamento no par e distribuição continuam pendentes |
| 2026-09-02 | `PR #9` | integrado na `main` | o conflito era restrito a dois workflows (`opencode-linux-artifact.yml` e `unigma-server-linux-artifact.yml`), cujas versões em `main` eram anteriores às da branch; resolvido sem perder conteúdo exclusivo. Merge `4f23bc2e` levou +17 200/−540 390 em 2 806 arquivos. Depois do merge, `unigma-linux-wsl-validation` (`33622281552`) e `unigma-server-linux-artifact` (`33622291887`) passaram **na `main`**. Os checks herdados do upstream (macOS, Monaco, chat-lib, Component Fixtures) já falhavam na `main` antes do PR e abortam em `Checkout microsoft/vscode`/`Setup system services`, antes de tocar no fork |
| 2026-09-02 | `CLI-001` / baseline de lints | baseline limpo | `cargo clippy -- -D warnings` passou sem lint pendente e `cargo test` somou 33 testes (28 + 5) sob o checkout atual; o `[patch.crates-io]` de `russh`/`russh-cryptovec`/`russh-keys` era resíduo — o próprio Cargo reportava que não entrava no grafo e não havia uso em `cli/src` —, foi removido e o lock perdeu três dependências `git` externas, sem alterar clippy nem os testes |
| 2026-09-02 | `E01-E` / validação | matriz Windows reexecutada | `unigma-self-hosted-validation` run `33613368047` passou na mesma ref, cobrindo o alvo Windows depois das mudanças de build |
| 2026-09-02 | `CLI-003` / `Q-3` | auditoria concluída, decisão ainda humana | os nove módulos de `cli/src/tunnels` servem ao Code Server/RPC preservado por `D-027` e nenhuma dependência Rust atual é exclusiva de Dev Tunnels; o CLI produz apenas o binário `code`. Restaram referências obsoletas: `extensions/tunnel-forwarding/src/extension.ts:271-280` invoca `code tunnel forward-internal`, que não existe mais no dispatch Rust, e `build/lib/i18n.resources.json` aponta `remoteTunnel`/`tunnelHost`, diretórios inexistentes. `tunnel-forwarding` compila localmente mas já é excluída da distribuição. Nada foi podado: a remoção depende de decisão explícita |
| 2026-09-02 | `CLI-003` / `Q-3` | poda executada e validada | por autorização explícita, `fc65a3f8` removeu a extensão `tunnel-forwarding`, suas entradas em `build/npm/dirs.ts`, `gulpfile.extensions.ts`, `gulpfile.vscode.ts` e `eslint.config.js`, as specs `code-tunnel`/`code-tunnel-insiders` do `terminal-suggest` com seus testes, e as entradas i18n `remoteTunnel`/`tunnelHost` de diretórios inexistentes. A guarda nominal em `build/unigma/audit-distribution.ts` foi mantida de propósito: ela rejeita o nome no artefato, então continua valendo contra resíduo stale ou reintrodução. `cli/` não foi tocado. `cda7907f` restaurou `src/vs/base/test/node/uri.perf.data.txt`, que a poda havia editado sem motivo — é corpus sintético de benchmark, não referência viva |
| 2026-09-02 | poda de CI | workflows inexecutáveis removidos | `27cf8383` removeu `pr.yml`, `pr-node-modules.yml` e os quatro `pr-*-test.yml` alcançáveis só por `pr.yml`, todos agendados em labels `1ES.Pool` de `microsoft/vscode`, mais `copilot-setup-steps.yml`, que usa `vscode-large-runners` e configura um agente Copilot que este fork não integra. Nenhum deles podia ser escalonado aqui: falhavam no setup e produziam check vermelho sem sinal. As actions `restore-node-modules`/`save-node-modules` ficaram, porque `component-fixtures.yml` e `css-order-scan.yml` ainda as usam |
| 2026-09-02 | poda / `E01-E` | poda validada na matriz oficial | depois da poda, na `main` `27cf8383`, `unigma-server-linux-artifact` run `33633940417` passou em 5m53s e `unigma-linux-wsl-validation` run `33634579380` passou em 15m9s, cobrindo dependências, compile do runtime, pacote Linux x64, auditoria de distribuição e smoke desktop. A remoção não regrediu build nem empacotamento |
| 2026-09-02 | `E01-E` / validação | matriz oficial reexecutada na ref atual | `unigma-linux-wsl-validation` run `33612053543` passou depois das mudanças de build (esbuild no `gulpfile.reh.ts`, `remote/LICENSE`, correções de tipo em `unigmaAgent` e `ChangesetReviewActionViewItem`), confirmando ausência de regressão no alvo desktop Linux |
| 2026-09-02 | `T-050` / payload v1 | par montado e aceito pelo validador | com o artefato `09aa87ff…` e o OpenCode `1.18.23`, `build/unigma/make-payload.ts` produziu `server/unigma-server.tar.gz` (95 469 565 B), `bin/opencode` (185 661 568 B), `LICENSE-opencode.txt` e `manifest.json` (`totalSizeBytes` 281 131 133). `validateBootstrapManifest` aceitou o manifesto real (`valid: true`). Transporte OpenSSH, staging, ativação remota e VPS continuam pendentes |
| 2026-09-02 | `T-050` / `unigma-server` | artefato Linux x64 produzido | run `33610235193` gerou `server/unigma-server.tar.gz` com 3 224 entradas, `bin/unigma-server` executável, `extensions/`, `node_modules/`, `out/`, `node` e `product.json`, mais `PROVENANCE.txt` (commit `09aa87ff…`, node `24.18.0`) e `LICENSE-unigma-server.txt`. A causa da lentidão anterior era o server usar a trilha `gulp-tsb` com mangling enquanto o desktop já usava esbuild: alinhado o `gulpfile.reh.ts`, o empacotamento caiu para 44 s |
| 2026-09-02 | `T-050` / `unigma-server` | build do servidor ainda sem artefato | `.github/workflows/unigma-server-linux-artifact.yml` foi criado para empacotar `vscode-reh-linux-x64` como `server/unigma-server.tar.gz`. Os runs corrigiram defeitos reais do fork — `gulpfile.reh.ts` exigia `@github/copilot-linux-x64` sem `builtInExtensions` (`60e01a77`), a task `-ci` pressupunha compile prévio (`44a67eac`), `ChangesetReviewActionViewItem` promovia `updateChecked`/`getTooltip` a públicos e quebrava o mangler (`f6dfbc0e`) e o `tsgo` acusou três erros de tipo em `unigmaAgent` (`2df27a14`) — além de um bloqueio de ambiente: `/tmp` do WSL é tmpfs e mantinha `available` em 5.336 MB contra 11.021 MB fora dele (`51ac5631`). Nenhum artefato de servidor foi aceito até aqui |
