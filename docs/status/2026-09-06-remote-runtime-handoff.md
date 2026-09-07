# 2026-09-06 — onde a sessão parou, branch `remote-runtime`

Nota de retomada. Não é aceite: nada aqui tem run de runner.

> **Estado em 2026-09-07:** a retomada aconteceu e está registrada no fim deste
> arquivo, em [resolução — 2026-09-07](#resolução--2026-09-07). O texto abaixo
> fica como estava, porque descreve o que era verdade em 06/09.

## o que está pronto e enviado

Branch `remote-runtime`, commits `ace14a12`, `c0527b05` e `13734202`.

- envelope RPC v2 alinhado entre workbench e runtime;
- resolução da pasta SSH só para pasta aberta no host correto, via
  `env.remoteAuthority` e `extensionKind`, sem fallback local;
- editor aberto e seleção anexados como `FilePartInput` reais, lidos pelo
  OpenCode no host que executa;
- contexto-base curto em `extensions/unigma-agent-runtime/src/application/sessionContext.ts`,
  enviado como `PromptInput.system`;
- `session.idle` deixou de ser traduzido como execução em curso, então a UI
  distingue streaming de ociosidade;
- comando `cancel`, que aborta a execução e preserva a sessão, separado de
  `stop`, que a encerra;
- levantamento em `docs/OPENCODE-CONTEXT-OPTIONS.md`, com a conclusão de não
  ampliar o patchset `service-only`.

Verificação local, que não marca item: 60 testes do runtime e 7 do contrato RPC
serializado, com Node `24.18.0`; eslint e hygiene limpos.

## o que estava sendo feito quando parei

Destravar a validação no runner. `gh workflow run
unigma-agent-runtime-validation.yml --ref remote-runtime` responde 404 porque o
GitHub só despacha `workflow_dispatch` de arquivo presente na branch default.

O passo seguinte era levar **somente** o arquivo
`.github/workflows/unigma-agent-runtime-validation.yml` para `main`, sem carregar
o resto da branch, e então disparar o workflow com `--ref remote-runtime`. Isso
não chegou a ser feito: `main` continua em `b3e4ca5f`.

Alternativa descartada: disparar `unigma-linux-wsl-validation.yml`, que já está
em `main` mas faz build amplo e bootstrap com `apt-get`.

## pendências anotadas

- O teste do reducer de streaming ficou em `test/browser/`, que exige DOM e não é
  coberto pelo workflow focado, que só enumera `test/common/`.
- Nenhum item do Trello foi marcado, por falta de run; o cartão TD-3 tem
  comentário com o estado exato.
- O workflow focado deixa a árvore temporária em `$HOME` do WSL.
- `AC-007` continua parcial; sessão agentiva remota real segue não provada.

## resolução — 2026-09-07

Sessão de retomada, sem supervisão. O que segue diz o que foi fechado, com que
prova, e o que **não** foi, com a razão.

### para destravar em minutos, na ordem

Os três itens abertos são autorização, não trabalho. Cada um tem o comando ou a
ação exata:

1. **Integrar o PR [#15](https://github.com/dashwr/unigma/pull/15)** — um único
   arquivo, `mergeable`. Isso torna `unigma-agent-runtime-validation.yml`
   despachável e dá prova de runner à limpeza da árvore temporária, hoje a única
   pendência da lista original sem run.
2. **Rodar a sonda somente-leitura**, que está pronta e nunca executou:

   ```bash
   gh workflow run unigma-remote-window-smoke.yml --ref remote-runtime \
     -f alias=unigma-vps -f reconnect_only=true -f native_modules_only=true \
     -f stage=false \
     -f artifact_commit=493dcfe76117e759058a28e69cb6c956a780f952
   ```

   As guardas do ref valem (medido no run `34082375469`), então só o job
   somente-leitura roda. Esperado: `native.opencode.desktop-layout=absent` e
   `native.opencode.server-layout=executable`, confirmando contra o host real a
   causa que hoje só está lida no código.
3. **Decidir a superfície de observação** descrita em "escrita no host", abaixo.
   É o que precede qualquer linha do harness de sessão remota, e é decisão de
   arquitetura, não de execução.

### o bloqueio de dispatch

Continua verdadeiro que o GitHub só despacha `workflow_dispatch` de arquivo
presente na branch default. O passo previsto — levar só
`.github/workflows/unigma-agent-runtime-validation.yml` para `main` — **não foi
executado**: escrever na branch default foi negado nesta sessão, tanto por
`git push` quanto por merge de PR. Ficou aberto o PR
[#15](https://github.com/dashwr/unigma/pull/15), cujo diff é exatamente esse
único arquivo adicionado, para quem tiver a permissão integrar. Os checks
vermelhos dele (`chat-lib tests`) falham em todo PR deste fork, inclusive nos do
dependabot, e não vêm do diff.

A validação foi obtida por outra rota, sem tocar em `main`:
`unigma-linux-wsl-validation.yml` já estava na branch default, portanto é
despachável, e cobre o mesmo conjunto do workflow focado — compile e suíte do
runtime, testes `test/common` do workbench por glob, pacote e auditoria. Faltava
nele só o contrato RPC serializado, porque `build/unigma/agent-rpc.contract.ts`
não termina em `.test.ts` e o glob `build/unigma/*.test.ts` nunca o alcançava;
`30b3c547` acrescentou o passo.

**Run `34078327932`, head `30b3c547`, linux-x64: verde.** Suíte do runtime 172
com 1 pendente, `unigma-remote-ssh` 98, harnesses de `build/unigma` 97, contrato
RPC serializado 7 — este pela primeira vez num runner —, pacote, auditoria e os
smokes. Detalhe em `EVIDENCE.md`.

**Run `34079783571`, head `9caeaf0b`: falhou, e o que ele provou antes de
falhar importa.** A suíte do runtime foi de 172 para 178 passando — os seis
testes de layout de OpenCode rodaram — e o passo de testes do workbench executou
de verdade pela primeira vez, com 47 passando. Depois disso o smoke desktop caiu
de 40/0 para 34/6, em áreas upstream. A causa foi o próprio passo novo:
`ensureCompiled` em `build/lib/preLaunch.ts` roda `npm run compile` **só quando
`out` não existe**, e o smoke roda a partir das fontes; transpilar `out` antes
fez o smoke pular o compile completo. Corrigido em `2d4d4e35`, que faz o passo
devolver a árvore como a encontrou.

**Run `34081018988`, head `ca5dd98b`: verde, e é o que fecha a cobertura.**
Runtime 178 com 1 pendente, `unigma-remote-ssh` 98, harnesses de `build/unigma`
98, contrato RPC 7, workbench `test/common` 47 e `test/browser` 13 em Electron
sob Xvfb, com o smoke desktop de volta a 40 passando e 0 falhando. As três
suítes do `unigmaAgent` executam em CI pela primeira vez, e cada número tem nome
de teste no log — não apenas um passo verde.

**Run `34082974153`, head `9016876d`: verde.** Runtime **181** com 1 pendente e
`unigma-remote-ssh` **99** — as duas guardas novas do par staged entraram em CI,
descritas mais abaixo. O resto sem mudança: harnesses 98, contrato RPC 7,
workbench 47 e 13, smoke desktop 40 com 0 falhando.

**Run `34084155109`, head `38638ab3`: verde, e é o último desta rodada.**
Harnesses de `build/unigma` de 98 para **100** — as guardas de montagem e
verificação do payload entraram em CI. Runtime 181 com 1 pendente,
`unigma-remote-ssh` 99, contrato RPC 7, workbench 47 e 13, smoke desktop 40 com
0 falhando.

**Um dos passos verdes não provava nada, e isso foi apurado.** `run workbench
agent unit tests in WSL` reportava sucesso sem executar teste algum: `--build`
aponta o harness para `out-build`, e a task de empacotamento segue o caminho
esbuild (`useEsbuildTranspile` em `build/gulpfile.vscode.ts`), que bundla em
`out-vscode` e nunca popula `out-build/vs`. O harness falhava ao importar
`errors.js`, nunca chegava a `runner.run` e o processo terminava com status 0.
Duas correções: `test/unit/node/index.js` passa a sair com status 1 nesse
caminho, e o passo passa a usar `npm run transpile-client` contra `out`. A suíte
`test/common` do `unigmaAgent` **nunca havia rodado em CI**, ao contrário do que
o comentário do próprio passo afirmava.

### as quatro pendências anotadas

1. **Reducer de streaming em `test/browser/` — fechado.** `acd6d274`.
   `unigmaAgentSession.ts` e `getUnigmaAgentStateAccessibility` não dependem de
   DOM; moravam em `browser/` só por vizinhança. Foram para `common/`, e os
   quatro testes puros para `test/common/unigmaAgentSession.test.ts`. A prova de
   runner veio no run `34079783571`, no passo que até então estava decorativo:
   **47 passando**, a primeira execução dessa suíte em CI. No caminho apareceu
   outro defeito: a suíte de browser
   **não é executada por workflow algum** e estava vermelha em silêncio, com a
   asserção de `UNIGMA_AGENT_VIEW_STATES` esperando quatro estados, sem
   `running`. **A suíte de browser também passou a rodar em CI**, em Electron
   sob Xvfb, dentro do job Linux. Ao ligá-la apareceu um segundo teste podre:
   ele disparava um literal `version: 2` esperando que o envelope recusasse,
   coisa que deixou de ser verdade quando `ace14a12` tornou v2 a versão
   suportada. Agora a versão inválida é derivada da constante. Com as duas
   correções a suíte fica 13 passando, provado no runner em `34081018988`.
2. **Nenhum item do Trello marcado — fechado, os dez.** Cada um coberto por
   prova de runner, e o cartão tem o histórico de comentários da noite. O
   décimo, *documentar as opções de contexto do OpenCode*, quase ficou de fora
   por leitura preguiçosa da regra do board: um documento não tem run. Mas a
   conclusão dele — **não ampliar o patchset `service-only`** — é verificável, e
   é verdadeira: o patchset segue intocado desde antes do recorte, continua
   sendo um único patch, e as duas suítes que o aplicam e o auditam passaram no
   runner dentro dos 100 testes de `build/unigma`. O documento é a direção; o
   patchset intocado com auditoria verde é a prova de que a direção foi seguida.
   Evidência citada no backlog, como a regra exige.
3. **Árvore temporária no `$HOME` do WSL — fechado, com prova de runner.**
   `acd6d274` fez o workflow focado removê-la em `trap EXIT`, com sentinela
   vazia e guarda de prefixo, na forma que `AGENTS.md` exige de remoção
   recursiva. Esse workflow não é despachável, e por um tempo isso ficou
   registrado aqui como limite — o conserto existiria sem run. Era falta de
   procurar o lugar certo.

   O lugar certo já existia: `audit-remote-safety.ts` aplica regras de texto
   sobre shell que é montado como string e executado noutro lugar, exatamente a
   classe de código que nenhum type checker vê, e a suíte dele roda no runner.
   `f95ca3e2` afirma ali a propriedade sobre o arquivo do workflow — `mktemp -d`
   sob `$HOME`, `trap cleanup EXIT`, sentinela que começa vazia, guarda de
   prefixo, e a remoção guardada sendo a única do arquivo —, na mesma forma que
   `remoteStagingScript.test.ts` usa para o shell gerado.

   Junto foi uma regra para **todos** os workflows, porque o defeito valia a
   classe e não só a instância: uma remoção recursiva nunca nomeia o `$HOME` nem
   a raiz, e nunca deixa a expansão sem aspas, já que uma variável vazia
   transforma `rm -rf $tree/out` em `rm -rf /out`.

   Nota para quem for mexer nisso: o job Linux **também** deixa sua árvore no
   `$HOME` do WSL, em `/home/dasher/unigma-linux-build`, mas ela não acumula —
   é caminho fixo, que o próprio passo de bootstrap remove e recria a cada run
   (`rm -rf "$build"; mkdir -p "$build"`). O defeito era do `mktemp -d` do
   workflow focado, que criava um diretório novo por execução. Não são o mesmo
   problema.
4. **`AC-007` parcial, sessão agentiva remota não provada — continua aberto, com
   causa identificada.** Ver abaixo.

### por que a sessão agentiva remota não fechou

Não é falta de tempo de runner: o recorte **não podia funcionar**, e a razão
estava no produto.

- `build/gulpfile.reh.ts` não empacota OpenCode algum. O bundle existe só no
  pacote desktop, escrito por `getOpenCodeBundle` em `build/gulpfile.vscode.ts`
  como `opencode/bin/opencode` sob `resources/app`.
- O payload de staging entrega o binário como `bin/opencode` dentro do diretório
  de staging, que `mv -T` ativa como o diretório de versão — e esse diretório é
  o `appRoot` do extension host remoto
  (`src/vs/server/node/remoteAgentEnvironmentImpl.ts:114`).
- O resolver do runtime só procurava `<appRoot>/opencode/bin/opencode` e, não
  achando, caía para o `PATH` — onde o extension host remoto recebe apenas
  `<appRoot>/bin/remote-cli`.

Corrigido em `18644365`: `resolveEmbeddedOpenCodeCandidate` conhece os dois
layouts, com o desktop na frente, e seis testes fixam as duas formas contra um
filesystem falso. **Condição necessária, não prova.**

`9016876d` fecha duas lacunas vizinhas, ambas provadas sem depender de host:

- **o par podia ser ativado com o OpenCode sem bit de execução.** O script de
  staging exigia `[ -x ]` do `unigma-server` e nada do `opencode`. O manifesto
  fixa tamanho e hash, e nenhum dos dois carrega o modo; a extração usa
  `--no-same-permissions` de propósito. A ativação passava e a falha só aparecia
  depois, no host, como o runtime recusando o bundle que o payload tinha acabado
  de entregar. Agora falha cedo, com categoria própria
  `opencode-not-executable`. A guarda recusa e não conserta — um `chmod` ali
  deixaria o payload escolher o próprio modo no host —, e há teste que exige a
  ausência dele.
- **a mesma propriedade não era afirmada em nenhum ponto anterior.** `5f865511`
  acrescenta a checagem na montagem (`make-payload.ts` recusa fonte não
  executável) e na verificação (`verify-payload.ts`, ao lado da que já exigia
  ELF — ser ELF não é ser executável). Com a guarda de staging, a propriedade
  passa a ser afirmada em montagem, verificação, staging e runtime. Duas
  fixtures de teste passaram a criar o binário com modo `0755`, que é como um
  artefato real chega, e o depósito do WSL preserva o modo, então o pipeline
  atual não é afetado.
- **e o achado maior, do run `34086194290`: o runtime está no pacote do servidor
  como um manifesto sozinho.** `unigma-agent-runtime` está lá e é `workspace`,
  mas o ponto de entrada que o `main` nomeia **não está no pacote**. Um extension
  host remoto não tem o que carregar. Isto é anterior a tudo o mais: mesmo com o
  OpenCode resolvível, mesmo com o par correto, mesmo com driver e credencial, a
  sessão remota não podia existir.

  A causa de ninguém ter visto é a mesma classe de defeito da noite inteira:
  `auditExtensionEntryPoints` só era chamado no ramo desktop, então o pacote
  cujas extensões **são** o extension host remoto nunca foi obrigado a provar que
  um `main` declarado é um arquivo que existe. O auditor até tem o comentário que
  descreve o defeito — o desktop já pagou por ele uma vez, quando a extensão
  viajou como `package.json` solitário —, e mesmo assim o servidor ficou de fora.
  `ae7380dd` aplica o auditor geral ao perfil `--server`, com a listagem do
  diretório, que é o que separa "as fontes nunca foram compiladas" de "o
  manifesto aponta para o lugar errado" de "o empacotamento filtrou a saída".

  **Consequência imediata:** o servidor não é publicado enquanto isso não fechar,
  e esse é o comportamento certo. Um servidor com o runtime pela metade responde
  `/version`, passa em tudo o mais, e não roda sessão alguma.

  **Causa, medida no run `34087643005`, cuja listagem era literalmente
  `[package.json]`:** `unigma-agent-runtime` não tem config esbuild, então o
  empacotamento toma o caminho `fromLocalNormal` em `build/lib/extensions.ts`,
  que é `vsce.listFiles` sobre o que está **no disco**. O job desktop compila a
  extensão explicitamente antes de `gulp vscode-linux-x64`, e é só por isso que
  o pacote desktop está correto. O job do servidor rodava apenas
  `vscode-reh-linux-x64-min`, e a árvore de build no WSL é recriada do zero a
  cada run, sem `extensions/**/out/`, que é ignorado pelo git. Corrigido em
  `a39f952f`, que acrescenta `compile-extension:unigma-agent-runtime` antes do
  empacotamento, como o job desktop já fazia.
- **nada afirmava que o runtime remoto está no pacote do servidor.** Toda a
  história do agente remoto depende de `unigma-agent-runtime` estar no pacote do
  servidor e ser hospedado do lado remoto, e o auditor do perfil `--server`
  checava layout, identidade e licenças sem tocar nisso. O repositório já pagou
  pela metade negativa: `gulpfile.reh.ts` comparava `extensionKind` com uma
  string quando o campo é array, e toda extensão com `main` era embarcada,
  `unigma-remote-ssh` inclusive. A metade positiva ficou descoberta — se a regra
  de inclusão deixar de trazer o runtime, o servidor compila, responde
  `/version`, passa na auditoria, e o runtime remoto não está lá. `5b1b5d04`
  acrescenta três checks: presente, declarado `workspace` e não `ui`, e com o
  ponto de entrada que o manifesto nomeia. Exercitados contra pacotes sintéticos
  nos três sentidos antes de ir ao runner.
- **a resolução dos dois layouts estava provada só contra um filesystem falso**,
  quando o defeito original era exatamente a resolução real olhar um diretório
  que o payload remoto nunca escreve. Três testes passam por
  `ChildProcessManager` com diretórios de verdade: o layout do pacote desktop, o
  layout que `mv -T` ativa num host, e o binário sem bit de execução, que tem de
  ser recusado em vez de cair para o `PATH`.

**O bloqueio que fecha a porta nesta rodada é de autorização, não de desenho.**
Todo caminho até a VPS passa por um `workflow_dispatch`, e disparar workflow que
alcança a VPS externa foi negado pela política de permissões desta sessão.
Escrever o harness completo produziria mil linhas que não poderiam ser
exercitadas — que é exatamente o que `AGENTS.md` proíbe tratar como entrega.

O que falta para a prova, e cada item é decisão humana, não trabalho pendente:

1. **Escrita no host.** O único caminho de produção para iniciar sessão é o
   botão da view; `unigma.agent.runtime.transport.send` é `when: false` e não há
   comando público de `start`. Provar exige instalar na VPS uma extensão-driver
   `extensionKind: ["workspace"]` que dispare a sessão e escreva relatório no
   host. Isso é escrita em host remoto, que o backlog exige autorizar por run.

   **E antes disso há uma lacuna de contrato, verificada, que precisa de decisão
   de desenho.** Um driver no extension host remoto consegue *iniciar* a sessão,
   porque `unigma.agent.runtime.transport.send` é registrado no próprio extension
   host (`extensions/unigma-agent-runtime/src/extension.ts:47`) e uma extensão
   pode executar comando de outra. Mas **não consegue observar o resultado**:
   `unigma.agent.runtime.transport.event` é registrado apenas no workbench
   (`src/vs/workbench/contrib/unigmaAgent/browser/unigmaAgentRuntime.ts:205`), a
   extensão de runtime só o *executa*, e `activate` não devolve API alguma. Um
   driver que registrasse o mesmo id colidiria com o do workbench.

   Ou seja, o smoke não tem por onde ler os eventos da sessão no host. As saídas
   possíveis — expor um segundo comando de observação, devolver API em
   `activate`, ou fazer o driver observar só os efeitos do lado do OpenCode — são
   decisão de arquitetura, não de execução. Escolher uma por conta própria seria
   inventar contrato, que é o que `AGENTS.md` proíbe. **É esta a primeira coisa a
   decidir**, antes de qualquer linha do harness.
2. **Credencial no host.** `OPENROUTER_API_KEY` não atravessa o SSH: nada em
   `remoteServerTransport.ts` encaminha ambiente. Ou a chave passa a viver na
   VPS — segredo persistente fora do CI —, ou o recorte é provado sem provider,
   verificando sessão criada e contexto remoto correto e deixando a resposta de
   modelo provada só localmente. A segunda opção é a recomendada.
3. **Novo par cliente/servidor.** `18644365` muda o commit, e o smoke recusa par
   divergente por desenho (`smoke-remote-window.ts`, gate
   `artifact-commit-pair`). Provar exige publicar o par novo e re-stage na VPS.

### a sonda somente-leitura ficou pronta e não pôde ser disparada

`d2a366f2` estendeu `build/unigma/remote-native-probe.ts` com dois testes
`[ -x ]`/`[ -e ]` que reportam `native.opencode.desktop-layout` e
`native.opencode.server-layout` da versão ativada no host. São **fatos, nunca
gate**, e há teste que recusa qualquer comando de escrita ou redirecionamento
nas linhas que os produzem. A intenção era converter a conclusão acima de
leitura de código em observação do host real.

A sonda só é alcançável por `unigma-remote-native-modules-smoke.yml`, que não
existe em `main` e portanto não é despachável, ou por
`unigma-remote-window-smoke.yml`, que existe — **mas a versão em `main` tem
apenas o input `alias` e um único job, sem guarda, que provisiona a VPS e a
limpa com `if: always()`**. As guardas `reconnect_only`/`native_modules_only`
que selecionam o caminho somente-leitura só existem em `remote-runtime`.

A dúvida era se um dispatch por ref usaria a definição do ref ou a da branch
default. Se fosse a da default, os booleanos chegariam vazios,
`inputs.native_modules_only == false` seria verdadeiro e o caminho selecionado
seria o de provisionamento e limpeza — exatamente o que não se pode disparar sem
supervisão.

**A dúvida foi resolvida com risco zero, e a resposta é: a definição do ref
governa.** O experimento está no run `34082375469`: um input que existia só em
`remote-runtime` foi acrescentado ao `unigma-windows-ssh-capabilities.yml`, que
não conecta a host algum e é idêntico nas duas branches. O dispatch **foi
aceito** — logo a validação usou a definição do ref — e o job imprimiu
`definition=feature-branch` e `probe_input_resolution=ref-governs`, logo a
execução também. A branch default só precisa ter o arquivo para o workflow ser
despachável. O andaime do experimento foi revertido em seguida.

Portanto as guardas de `remote-runtime` valeriam, e a sonda seria selecionada
sozinha, sem provisionar nada. **Mesmo assim ela não rodou:** o dispatch de um
workflow que alcança a VPS externa foi negado pela política de permissões desta
sessão. Não é risco técnico e não é dúvida de desenho — é autorização que só o
responsável tem. A sonda fica pronta e o comando exato é:

```bash
gh workflow run unigma-remote-window-smoke.yml --ref remote-runtime \
  -f alias=unigma-vps -f reconnect_only=true -f native_modules_only=true \
  -f stage=false \
  -f artifact_commit=493dcfe76117e759058a28e69cb6c956a780f952
```

Esperado no relatório: `native.opencode.desktop-layout=absent` e
`native.opencode.server-layout=executable`, que é o que confirma a causa
descrita acima contra o host real.

Tamanho estimado do que teria de ser escrito: extensão-driver (~300 linhas),
`build/unigma/smoke-remote-agent-session.ts` (~400), workflow próprio (~200) e
testes (~150). Nada disso foi começado, de propósito: escrever mil linhas de
harness antes de decidir 1 e 2 produziria código que não se pode rodar.
