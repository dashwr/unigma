# plano — CLI Rust: desacoplar o Agent Host e habilitar o SSH remoto

> **data:** 2026-08-29
>
> **status:** plano operacional ativo para a frente CLI/SSH. **Não substitui**
> [`2026-08-28-ondas-refundacao.md`](2026-08-28-ondas-refundacao.md); emenda nele
> como uma onda intermediária (ver [emenda](#emenda-onde-este-plano-entra)).
>
> **não autoriza** suporte, distribuição, release, publicação nem clearance legal.
>
> **fonte:** decisão `D-024` (retirada do Agent Host herdado) e a auditoria
> somente-leitura do CLI Rust registrada em
> [`../status/2026-08-29-cli-audit.md`](../status/2026-08-29-cli-audit.md);
> contrato em [`../SSH-CONTRACT.md`](../SSH-CONTRACT.md); tarefas em
> [`../BACKLOG.md`](../BACKLOG.md).

## 1. por que este plano existe

A onda 1 do plano de refundação removeu o Agent Host herdado do **workbench, do
build e dos testes TypeScript**. Ela **não tocou no CLI Rust** (`cli/`), onde o
mesmo subsistema continua compilado e acoplado ao caminho que o SSH remoto
precisa usar.

A auditoria separou duas coisas que estavam misturadas no mesmo arquivo:

| camada | veredito |
| --- | --- |
| **Code Server** — `cli/src/tunnels/code_server.rs`, `server_bridge.rs`, `server_multiplexer.rs`, `protocol.rs`, o RPC genérico de `control_server.rs` e o entry point `command-shell` | **preservar.** É a base do extension host remoto; sem ele não há SSH remoto |
| **Agent Host / AHP** — `cli/src/tunnels/agent_host*.rs`, `cli/src/commands/agent_host.rs`, os módulos órfãos `cli/src/commands/agent*.rs`, `SharedActiveAgentHost`, `ensure_supervisor_running`, `apply_to_bridge`, flags `--agent-host-bridge-*` | **remover.** É o harness herdado, não o oficial (`D-017`, `D-022`, `RQ-022`, `RQ-105`) |

O erro a evitar é tratar as duas camadas como uma só e remover o Code Server
junto com o Agent Host.

## 2. arquitetura alvo

```text
desktop unigma (Windows x64 ou Linux x64)
  └─ extensions/unigma-remote-ssh  ── autoridade remota `ssh-remote+<alvo>`
      └─ cliente OpenSSH do sistema          (transporte; fonte de verdade)
          └─ unigma-server no host remoto    (Code Server do próprio fork)
              └─ extension host remoto
                  └─ extensions/unigma-agent-runtime
                      └─ opencode serve      (loopback do host remoto)
```

Invariantes que o plano não pode violar:

- o `opencode serve` **não** substitui o Code Server; ele roda dentro do
  extension host remoto;
- no máximo um `opencode serve` por extension host;
- o loopback remoto nunca é exposto ao desktop; o acesso passa pela autoridade;
- nenhum segredo, chave, `known_hosts` ou senha é lido, gerado, copiado ou
  impresso pelo agente.

## 3. emenda: onde este plano entra

```
onda 0 → onda 1 (TS/build, feita) → [ ESTE PLANO: etapa A ] → onda 2 (runner)
                                                                 ├── onda 3
                                                                 ├── onda 4
                                                                 └── onda 5 (probe SSH bruto)
                                                                        └── [ ESTE PLANO: etapa B ] → E-05 fechado
```

- **começa** logo após a onda 1, na mesma ref, antes da colheita da onda 2 — a
  etapa A muda código Rust e TypeScript de completions, e o runner deve validar
  a árvore já reduzida por inteiro, não pela metade;
- **acaba** quando `T-050`/`T-051` tiverem evidência real contra a VPS, o que
  fecha o gate remoto de `E-05` e habilita `T-052`/`T-053`;
- **depende** da onda 0 (ambiente Node 24 + VPS preparada) e, para a etapa B, da
  onda 4 (runtime OpenCode real) e da onda 5 (probe SSH bruto validado);
- **não depende** das ondas 3, 6 e 7.

## 4. etapa A — desacoplar o Agent Host do CLI

Somente remoção e desacoplamento. **Nenhum comportamento novo.** Ordem
obrigatória: cortar consumidores antes de apagar módulos, senão o `cargo check`
para de dar diagnóstico útil no meio do caminho.

| # | id | tarefa | arquivos |
| --- | --- | --- | --- |
| A.1 | `T-110` | tirar o supervisor do `command-shell`: remover `ensure_supervisor_running` e a construção de `SharedActiveAgentHost`; o comando passa a servir o stream com Code Server puro | `cli/src/commands/tunnels.rs` |
| A.2 | `T-110` | remover `active_agent_host` de `ServeStreamParams`, `HandlerContext` e `make_socket_rpc`; remover `SharedActiveAgentHost` e `ready_active_agent_host`; remover a chamada a `apply_to_bridge` em `handle_serve` | `cli/src/tunnels/control_server.rs`, `cli/src/tunnels.rs` |
| A.3 | `T-111` | remover as flags `--agent-host-bridge-*`, `apply_to_bridge` e o subcomando `agent`/`agent host` da superfície de CLI | `cli/src/commands/args.rs` |
| A.4 | `T-111` | apagar os módulos do subsistema e suas declarações `mod` | `cli/src/tunnels/agent_host.rs`, `agent_host_registry.rs`, `agent_host_registry_acl_windows.rs`, `cli/src/commands/agent_host.rs`, `cli/src/tunnels.rs`, `cli/src/commands.rs` |
| A.5 | `T-111` | apagar os módulos órfãos nunca declarados em `commands.rs` e os helpers exclusivos de lifecycle/registry | `cli/src/commands/agent.rs`, `agent_ps.rs`, `agent_kill.rs`, `agent_logs.rs`, `agent_stop.rs`, `agent_relay.rs`, `agent_discovery.rs`, `agent_endpoints.rs`, `cli/src/tunnels/idle_timeout.rs`, `cli/src/tunnels/user_data_path.rs` |
| A.6 | `T-112` | remover as dependências que ficam órfãs (`ahp`, `ahp-types` e, se a busca confirmar zero usos, `tokio-tungstenite`) e revalidar `Cargo.lock` por build normal | `cli/Cargo.toml`, `cli/Cargo.lock` |
| A.7 | `T-112` | limpar o `constants.rs`: manter `PROTOCOL_VERSION=4` conforme `D-029`; reavaliar o comentário de `SERVER_DATA_PARENT_DIR`, que permanece em uso por `state.rs` | `cli/src/constants.rs` |
| A.8 | `T-113` | remover `agentHostOptions` e o subcomando correspondente das completions de shell, e ajustar o teste | `extensions/terminal-suggest/src/completions/code.ts`, `extensions/terminal-suggest/src/test/completions/code.test.ts` |
| A.9 | `T-113` | busca estática final: nenhum `agent_host`, `AgentHost`, `ahp`, `--agent-host-bridge` ou `agentHostOptions` residual fora de documentação histórica; descrições de comandos externos, como `azd`, não são o subsistema removido | árvore inteira |

**testes — somente no fim da etapa A:**

```bash
cd cli && cargo clippy -- -D warnings && cargo test && cd ..
npm run compile-client
npm run typecheck-client
npm run eslint
npm run hygiene
npm run gulp compile-extension:terminal-suggest
npm run test-build-scripts
```

**critério de saída da etapa A:** CLI compila e passa os testes sem o Agent
Host; `command-shell` continua servindo o Code Server; nenhuma flag ou módulo
residual; diff restrito a `cli/`, `extensions/terminal-suggest/` e documentação.
`cargo clippy -- -D warnings` deve ser colhido separadamente: os cinco lints
atuais em `update_service.rs`, `util/errors.rs` e `json_rpc.rs` são baseline
preexistente e não devem ser misturados neste patch.

**o que a etapa A explicitamente não faz:** não remove `code tunnel`, não altera
`serve-web`, não mexe no protocolo do Code Server e não implementa nada de SSH.

## 5. etapa B — SSH remoto ponta a ponta

Começa **depois** da etapa A validada e da onda 5 (probe SSH bruto). Aqui há
código novo; cada bloco tem critério próprio, mas o teste continua concentrado
no fim.

### B.1 — decidir e documentar a entrega do `unigma-server` (`T-050`)

`product.json` já define `serverApplicationName: "unigma-server"` e
`serverDataFolderName: ".unigma-server"`, mas **não define `updateUrl`,
`downloadUrl`, `quality` nem `commit`**. Consequência direta: o caminho de
download automático de `code_server.rs` (`UpdateService::get_latest_commit`) não
tem endpoint e não funciona neste fork.

Três estratégias possíveis, a decidir antes de escrever código:

| estratégia | como funciona | custo |
| --- | --- | --- |
| **tarball próprio** (o que Cursor e Antigravity fazem) | publicar `unigma-server-linux-x64.tar.gz` por commit em um endpoint próprio; o host remoto baixa e extrai em `~/.unigma-server/bin/<commit>` | exige endpoint público e `updateUrl`/`commit` no `product.json` |
| **push pelo cliente** | o cliente envia o tarball pela própria sessão OpenSSH e extrai no host remoto; nenhum endpoint público | mais lento na primeira conexão; sem CDN |
| **caminho pré-instalado** | o responsável instala o servidor na VPS e a extensão só o localiza e reutiliza | mínimo esforço para validar B.2–B.4; não é experiência de produto |

Decisão `D-032` substitui `D-031`: o cliente faz **push pela sessão OpenSSH** do
par `unigma-server` + `unigma+opencode` do mesmo commit, após confirmação por
host mostrando versão, tamanho e hash. A instalação é versionada/atômica na área
do usuário remoto; não usa CDN, elevação, download remoto nem instalação global.
OAuth, plugins e providers continuam configurados pelo usuário no host remoto.

Não existe atalho de intercompatibilidade: o servidor precisa ser do mesmo fork
e commit do cliente, porque o protocolo do extension host e o workbench são
acoplados por commit. Reutilizar o servidor upstream Code - OSS deixaria o
extension host remoto sem as extensões internas do unigma.

### B.2 — autoridade remota (`T-050`)

| # | tarefa |
| --- | --- |
| B.2.1 | implementar o `RemoteAuthorityResolver` de `ssh-remote+<alvo>` em `extensions/unigma-remote-ssh/`, chamando `evaluateRemoteSshConnection` como gate obrigatório de pré-conexão |
| B.2.2 | invocar o cliente OpenSSH do sistema como único transporte; sem relay, sem reimplementação de protocolo, sem `StrictHostKeyChecking=no`, sem `ssh-keyscan` |
| B.2.3 | mapear cada falha do OpenSSH para as categorias já fixadas no contrato (`ssh.host-key-untrusted`, `ssh.client-unavailable`, `ssh.connection-lost`, …), sem vazar segredo em log |
| B.2.4 | localizar/instalar o `unigma-server` no host conforme a estratégia de B.1 e estabelecer o túnel de porta/socket até o extension host remoto |

### B.3 — runtime no host remoto (`T-051`)

| # | tarefa |
| --- | --- |
| B.3.1 | garantir que `unigma-agent-runtime` ativa no extension host **remoto** e inicia ou reutiliza um único `opencode serve` remoto |
| B.3.2 | provar que caminho, Git, worktrees e terminal referem-se ao host remoto; nenhum processo local é iniciado para o workspace remoto |
| B.3.3 | encerrar apenas o que a sessão criou; sem processo órfão após queda de SSH |

### B.4 — fluxo de agente remoto (`T-052`)

| # | tarefa |
| --- | --- |
| B.4.1 | manter o mesmo contrato de sessão, diff, aprovação e erro da UI nativa, com o contexto de autoridade carimbado em cada sessão |
| B.4.2 | distinguir erro de SSH de erro do OpenCode na superfície de usuário |
| B.4.3 | isolar estado local e remoto: dois workspaces simultâneos não compartilham sessão nem processo |

**testes — somente no fim da etapa B (`T-053`):**

```bash
npm run gulp compile-extension:unigma-remote-ssh
npm --prefix extensions/unigma-remote-ssh test
npm run gulp compile-extension:unigma-agent-runtime
npm --prefix extensions/unigma-agent-runtime test
npm run typecheck-client
./scripts/test-integration.sh
```

Mais a matriz remota de `SSH-CONTRACT.md` §2 executada contra a VPS Linux x64,
com cliente Windows x64 e cliente Linux x64, registrando comando, versão do
OpenSSH, ref/SHA do build, cenário, resultado e ausência de segredo em log.

**critério de saída da etapa B:** cada linha suportada da matriz tem evidência
reproduzível; cada linha recusada falha de modo acionável; `AC-007` colhido.

## 6. depois deste plano

Em ordem, fora do escopo aqui:

1. **onda 6** — bundle OpenCode fixado, agora também no host remoto;
2. **`T-053`/`AC-013`** — smoke incluindo o cenário remoto;
3. **`E-06`** — orçamento de performance e revisão de segurança do caminho remoto;
4. **distribuição do `unigma-server`** — só depois de `E00-A`/`E00-B` saírem de
   `blocked`, porque publicar um servidor é distribuição.

## 7. decisões abertas

| # | questão | efeito se não decidida |
| --- | --- | --- |
| Q-2 | estratégia de entrega do `unigma-server` (B.1) e, se aplicável, o endpoint de `updateUrl` | a etapa B fica presa ao caminho pré-instalado e não vira experiência de produto |
| Q-3 | destino do `code tunnel` e das dependências `@microsoft/dev-tunnels-*` | superfície e inventário de terceiros continuam maiores que o necessário |

`Q-1` foi resolvida por `D-029`: o CLI anuncia `PROTOCOL_VERSION=4`.
`Q-3` saiu deste plano por decisão explícita: vira a frente separada `CLI-003`,
uma auditoria própria do `code tunnel`. A etapa A **não** toca no tunnel, e o
resultado daquela auditoria não bloqueia nem a etapa A nem a etapa B.

## 8. riscos

| risco | efeito | mitigação |
| --- | --- | --- |
| remover o Code Server junto com o Agent Host | SSH remoto fica impossível e o corte é irreversível na prática | a tabela da §1 é normativa; a etapa A não toca em `code_server.rs` |
| corte da etapa A quebrar `command-shell` | túnel e SSH param juntos | ordem obrigatória A.1→A.9 e bloco de testes completo no fim da etapa |
| tratar o probe SSH bruto da onda 5 como aceite da integração | suporte falso | o aceite de `E-05` depende de `T-050`–`T-053`, não do probe |
| divergência de commit entre cliente e `unigma-server` | extension host remoto não conecta ou conecta degradado | fixar commit na estratégia escolhida em B.1 e falhar fechado em incompatibilidade |
| árvore compartilhada com trabalho não commitado | perda de trabalho alheio | nunca usar reset/checkout destrutivo; conferir `git status` antes e depois |
