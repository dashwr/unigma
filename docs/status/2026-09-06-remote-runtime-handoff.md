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
   quatro testes puros para `test/common/unigmaAgentSession.test.ts`. **A prova
   de runner desse recorte ficou para o run seguinte**, porque o passo que
   deveria executá-lo estava decorativo — ver acima. Localmente os quatro rodam:
   `npm run test-node -- --runGlob "vs/workbench/contrib/unigmaAgent/test/common/*.test.js"`
   dá 47 passando. No caminho apareceu outro defeito: a suíte de browser
   **não é executada por workflow algum** e estava vermelha em silêncio, com a
   asserção de `UNIGMA_AGENT_VIEW_STATES` esperando quatro estados, sem
   `running`. **A suíte de browser também passou a rodar em CI**, em Electron
   sob Xvfb, dentro do job Linux. Ao ligá-la apareceu um segundo teste podre:
   ele disparava um literal `version: 2` esperando que o envelope recusasse,
   coisa que deixou de ser verdade quando `ace14a12` tornou v2 a versão
   suportada. Agora a versão inválida é derivada da constante. Com as duas
   correções a suíte fica 13 passando, verificado em Electron nesta máquina.
2. **Nenhum item do Trello marcado — fechado.** Os itens do TD-3 cobertos pelo
   run foram marcados, com comentário no cartão descrevendo a rota usada. O que
   não tem prova de runner continua desmarcado.
3. **Árvore temporária no `$HOME` do WSL — fechado.** `acd6d274`. O workflow
   focado passa a removê-la em `trap EXIT`, com sentinela vazia e guarda de
   prefixo, na forma que `AGENTS.md` exige de remoção recursiva.
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

O que falta para a prova, e cada item é decisão humana, não trabalho pendente:

1. **Escrita no host.** O único caminho de produção para iniciar sessão é o
   botão da view; `unigma.agent.runtime.transport.send` é `when: false` e não há
   comando público de `start`. Provar exige instalar na VPS uma extensão-driver
   `extensionKind: ["workspace"]` que dispare a sessão e escreva relatório no
   host. Isso é escrita em host remoto, que o backlog exige autorizar por run.
2. **Credencial no host.** `OPENROUTER_API_KEY` não atravessa o SSH: nada em
   `remoteServerTransport.ts` encaminha ambiente. Ou a chave passa a viver na
   VPS — segredo persistente fora do CI —, ou o recorte é provado sem provider,
   verificando sessão criada e contexto remoto correto e deixando a resposta de
   modelo provada só localmente. A segunda opção é a recomendada.
3. **Novo par cliente/servidor.** `18644365` muda o commit, e o smoke recusa par
   divergente por desenho (`smoke-remote-window.ts`, gate
   `artifact-commit-pair`). Provar exige publicar o par novo e re-stage na VPS.

Tamanho estimado do que teria de ser escrito: extensão-driver (~300 linhas),
`build/unigma/smoke-remote-agent-session.ts` (~400), workflow próprio (~200) e
testes (~150). Nada disso foi começado, de propósito: escrever mil linhas de
harness antes de decidir 1 e 2 produziria código que não se pode rodar.
