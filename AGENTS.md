# unigma — instruções do repositório

## antes de trabalhar

- `unigma` é um fork de Code - OSS/Electron com OpenCode como runtime primário;
  comece por `docs/status/WORKBENCH.md` e `docs/README.md`, depois leia
  `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`, `docs/DECISIONS.md`,
  `docs/ACCEPTANCE.md` e `docs/BACKLOG.md` antes de alterar comportamento.
- Inspecione `git status --short --branch` antes de editar e preserve alterações
  não relacionadas; este checkout pode conter trabalho não commitado de outras
  frentes. Nunca use reset/checkout destrutivo para “limpar” a árvore.
- Documentação, fixture ou mock não converte direção em suporte: critérios só
  passam com comando, teste, artefato e cenário reproduzíveis registrados.

## próximo trabalho — SSH remoto

- A frente ativa é `docs/planos/2026-08-29-cli-ssh-remoto.md`, etapa B
  (T-050…T-053). **O próximo passo é a matriz oficial `T-053`/`AC-007`**: abrir
  uma janela remota de verdade, sessão, queda de conexão e reconexão contra um
  host real.
- Já feito e com evidência de runner: par versionado (`T-050`), transporte por
  OpenSSH (`T-051`), staging com ativação atômica (`T-052`) e a fiação do
  resolver, que devolve `ResolvedAuthority` e nomeia o comando de staging quando
  o servidor não está no host.
- **Cuidado ao ler esse verde:** nenhum smoke exercita o resolver nem o
  workbench. Eles provam as camadas que ele consome. Enquanto a matriz não for
  colhida, o remoto está implementado, não suportado.
- Depois da matriz vêm o passo de Welcome que sugere uma identidade SSH sem
  gerar nem guardar chave, e os épicos de produto.
- **Não remova o Code Server** (`cli/src/tunnels/code_server.rs`,
  `server_bridge.rs`, `server_multiplexer.rs`, `protocol.rs`, o RPC genérico de
  `control_server.rs` e o entry point `command-shell`): é a base do extension
  host remoto, preservada por `D-027`. Só o subsistema `agent_host*`/AHP sai.
- O servidor do host remoto é o `unigma-server` deste fork, acoplado por commit
  ao cliente (`D-028`). A entrega é o push do par pela sessão SSH (`D-032`), com
  confirmação explícita antes de qualquer escrita.
- Os testes de cada etapa ficam concentrados no fim dela, conforme o plano.

## depósito de artefatos no WSL

- Os três workflows Linux publicam em `~/.local/share/unigma-artifacts` dentro do
  WSL do runner, ao lado do depósito de toolchains: versões em
  `versions/<nome>/<commit>` e os ponteiros `unigma-latest`,
  `unigma-server-latest` e `opencode-latest`, trocados com `mv -T`. O script é
  `build/unigma/publish-latest-artifact.sh`.
- Só entra no depósito o que já passou os próprios gates: o cliente depois da
  auditoria e do smoke, o servidor depois de `audit-distribution.ts --server`.
- É de lá que os smokes remotos montam o par. Caminhos de artefato numa máquina
  de desenvolvimento **não** existem dentro do WSL; um smoke que dependa deles
  no runner está silenciosamente testando outra coisa.

## contexto anterior — ondas E00–E03

- O plano operacional histórico está em
  `docs/planos/2026-08-27-e00-e03-ondas.md`; ele é a fonte da ordem interna,
  dependências, lanes paralelas e critérios de saída.
- A onda 1 (lanes 1A–1F) já foi executada e está consolidada em
  `docs/status/2026-08-27-overnight.md`. A onda 2 foi executada somente nos
  recortes 2A/T-020 e 2B/T-030, com evidência local; seus bloqueios de matriz e
  aceite continuam registrados. Não iniciar a onda 3 neste estado.
- Dentro de cada lane, siga a ordem escrita; lanes diferentes podem rodar em
  paralelo quando as dependências estiverem satisfeitas, mas não compartilhe
  arquivo ou decisão sem barreira explícita.
- `opencode serve` já é headless. Manter `service-only`, sem poda ampla por
  inferência; auditar superfícies alcançáveis/empacotadas e aplicar somente patch
  mínimo comprovado na trilha de bundle.

## fronteiras que não podem ser confundidas

- `src/vs/workbench/contrib/unigmaAgent/` é a UI nativa do workbench; não deve
  abrir Webview, processo, HTTP/SSE, filesystem ou segredo diretamente.
- `extensions/unigma-agent-runtime/` é a extensão interna que possui o processo
  filho `opencode serve`, cliente HTTP/SSE de loopback e estado local mínimo; há
  no máximo um processo OpenCode por extension host, reutilizado entre sessões.
- `extensions/unigma-remote-ssh/` delega transporte remoto a OpenSSH; `Git`,
  OpenSSH, OpenCode e o filesystem são fontes de verdade, não dados a duplicar.
- UI↔runtime usa RPC TypeScript privado, versionado e serializável. O bridge
  atual usa `unigma.agent.runtime.transport.send` para comandos e
  `unigma.agent.runtime.transport.event` para eventos; não retorne objetos com
  métodos/listeners por `executeCommand`.
- Workspace confiável, origem explícita, validação de fronteira e aprovação do
  usuário precedem integração e efeitos. O preflight ocorre imediatamente antes
  de `ProcessManager.ensureStarted()` e o extension host revalida a decisão;
  ausência ou origem desconhecida deve falhar fechado.
- Não criar backend, banco, conta, RBAC, cloud, telemetria, catálogo, Marketplace
  próprio ou instalação silenciosa. Não copiar prompts, diffs, histórico, tokens,
  caches OAuth, senhas ou chaves SSH.
- `unigma+opencode`/perfil `service-only` é o alvo de distribuição, não presumir
  que um binário OpenCode externo ou um mock seja artefato suportado. Codex e
  Claude Code externos ficam fora do suporte oficial; `unigma+pi` é experimental.
- Preserve `LICENSE.txt` e `ThirdPartyNotices.txt`; não reutilize identidade,
  ícones, binários, endpoints ou chaves Microsoft/OpenCode. Veja
  `docs/status/BRANDING-CLEARANCE.md` antes de tratar branding como liberado.

## toolchain e instalação

- Use Node.js `24.18.0`/x64 conforme `.nvmrc` e npm menor que `12`; o
  `build/npm/preinstall.ts` rejeita outra major de Node ou npm `>=12`.
- O `.npmrc` fixa headers Electron `42.8.1`, `build_from_source=true` e
  `ignore-scripts=false`; Python e toolchain C/C++ nativos são pré-requisitos.
- Só rode `npm ci --no-audit --no-fund` quando a instalação/rede estiver
  autorizada. O install root executa `preinstall`/`postinstall` e instala as
  dependências nested listadas em `build/npm/dirs.ts`; `--ignore-scripts`, Yarn e
  instalação global deixam a árvore inválida ou fora do workflow.
- `test/smoke/README.md` ainda menciona Node 12; isso contradiz o preinstall atual.
  Siga `.nvmrc`, `package.json` e os workflows executáveis.

## comandos focados

- **não rode typecheck amplo, build, empacotamento ou smoke nesta máquina**. Ela
  já travou executando um smoke com payload real e precisou ser reiniciada. O
  runner self-hosted é a autoridade e também o lugar de execução; localmente use
  só alvo mínimo de poucos arquivos, e apenas quando for indispensável e
  autorizado.
- Custo a considerar ao escolher o que validar: um ciclo de runner leva algo
  entre cinco e vinte minutos. Código puro e determinístico compensa empacotar e
  cobrir com teste; código acoplado ao ambiente — shell, socket, `sshd`,
  permissões, versão de OpenSSH, layout de pacote — compensa executar cedo e uma
  peça por vez, porque foi exatamente aí que todo defeito real apareceu.
- **Um check verde merece a pergunta "o que exatamente isso provou?"**. O smoke
  de staging já passou contra um servidor sintético que respondia `/version` com
  um commit que mandaram ele imprimir: um mock confirmando a si mesmo.

Rode a partir da raiz, na ordem mínima afetada:

```bash
# cliente/workbench; não inclui Copilot
npm run compile-client
npm run typecheck-client

# runtime próprio: compile antes da suíte, que lê extensions/.../out/test
npm run gulp compile-extension:unigma-agent-runtime
npm --prefix extensions/unigma-agent-runtime test

# checks comuns
npm run eslint
npm run stylelint
npm run test-build-scripts
```

- `npm run compile` também executa `compile-copilot`; não use esse alvo amplo
  quando `compile-client` cobre a mudança.
- Teste Node focado: `npm run test-node -- --run <arquivo-ou-filtro>`.
  Teste Electron focado: `./scripts/test.sh --run <arquivo>` ou
  `scripts\test.bat --run <arquivo>`; `--glob` também é aceito.
- Teste browser: `npm run test-browser -- --browser chromium --browser webkit`
  instala browsers; use `npm run test-browser-no-install -- ...` só quando eles
  já estiverem disponíveis.
- Integração browser exige `cd test/integration/browser && npm ci && npm run
  compile`; depois use `./scripts/test-integration.sh`/`.bat` ou
  `./scripts/test-web-integration.sh`/`.bat` conforme o alvo.
- Smoke de desenvolvimento: `npm run smoketest`; depois de build/compilação já
  prontos, use `npm run smoketest-no-compile`. O filtro oficial do unigma exclui
  `Terminal Profiles` e `Chat`; essas exclusões não são suporte.
- CLI Rust: em `cli/`, rode `cargo clippy -- -D warnings` e `cargo test`.

## builds e ci

- Empacotamento usa `npm run gulp vscode-win32-x64` ou
  `npm run gulp vscode-linux-x64`; builds de plataforma precisam do toolchain
  correspondente e não devem rodar em paralelo no runner self-hosted compartilhado.
- A validação oficial do produto está em
  `.github/workflows/unigma-self-hosted-validation.yml` (Windows x64) e
  `.github/workflows/unigma-linux-wsl-validation.yml` (Ubuntu WSL2 no runner
  Windows). A sequência é dependências → runtime compile/test → checks focados →
  pacote → `build/unigma/audit-distribution.ts` → smoke → evidência.
- Os demais workflows executáveis, todos `workflow_dispatch` e self-hosted:
  `unigma-server-linux-artifact.yml` (pacote REH, auditado com `--server` antes
  de publicar), `opencode-linux-artifact.yml` (OpenCode fixado em `1.18.23`),
  `unigma-remote-ssh-smoke.yml` (conexão remota) e
  `unigma-remote-staging-smoke.yml` (push do payload, ativação e idempotência).
- Os workflows herdados que agendavam em pools `1ES.Pool` da Microsoft foram
  removidos: nunca puderam ser escalonados neste fork e só produziam check
  vermelho sem sinal.
- O workflow Windows exige bibliotecas Spectre do Visual Studio e `signtool.exe`;
  se o preflight falhar, pare e registre o bloqueio em vez de instalar privilégio.
  O workflow Linux copia o checkout para um caminho de build dentro do WSL.
- Compile local serve para diagnóstico, não prova de artefato ou compatibilidade;
  não declare aceite sem a evidência do runner correspondente. O wrapper de
  artefato, logs e resultados de smoke não são automaticamente pacote de release.

## mudanças e documentação

- `node_modules/`, `.build/`, `out*/`, `extensions/**/out/` e outros outputs
  ignorados não devem ser staged. Confira `git status` após qualquer build e use
  `git diff --check`; o clean-state de `build/` está em
  `.github/workflows/check-clean-git-state.sh`.
- Preserve tabs no código; `package.json` e YAML usam dois espaços conforme
  `.editorconfig`. Novos arquivos TypeScript devem obedecer ao header exigido por
  `eslint.config.js` (runtime próprio usa copyright `2026 unigma contributors`).
  O header de `2026 unigma contributors` só é aceito em
  `extensions/unigma-agent-runtime/**`; em `build/` e nas demais extensões o
  header é o do upstream. **Não altere `eslint.config.js` para acomodar um
  arquivo novo** — copie o header do vizinho.
- O hook de pre-commit roda hygiene, que verifica formatação. O formatador do
  repositório é `node --experimental-strip-types build/lib/formatter.ts --replace
  <arquivos>`. **Não use `npx prettier`**: ele usa outra configuração, converte
  as aspas e a indentação e transforma dois avisos de formatação em centenas de
  erros de hygiene. Ele também não sabe nada de shell — apontá-lo para um `.sh`
  corrompe o script.
- Ao concluir uma etapa, atualize `docs/status/WORKBENCH.md`, registre uma linha
  curta `feito:` em `docs/BACKLOG.md` e atualize o status histórico/`ACCEPTANCE.md`
  somente com evidência real. Release, publicação e clearance legal exigem
  autorização explícita.
