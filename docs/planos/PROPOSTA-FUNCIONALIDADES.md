# unigma — proposta de funcionalidades do harness `unigma-opencode`

> **status:** proposta. Não autoriza implementação; não substitui
> [`../BACKLOG.md`](../BACKLOG.md) nem [`../DECISIONS.md`](../DECISIONS.md). Onde houver
> divergência, **D-### vence**. Pushes só na branch
> `work/2026-08-26-e00-e03`.

## propósito

Documentar, com base na varredura de harnesses agentic consolidados, **quais
funcionalidades devem existir no runtime `unigma-opencode`** (perfil
service-only do OpenCode distribuído com o unigma) e em que prioridade. O
documento é insumo para a fase E-02 em diante; não cria épicos novos além do
que já está mapeado em `BACKLOG.md`.

## escopo da varredura

Comparação entre 6 harnesses agentic de mercado e o OpenCode (que é o runtime
já adotado em `OPENCODE-SERVICE-ONLY.md`):

| harness | origem | status | lido em |
| --- | --- | --- | --- |
| **OpenCode** | upstream | oficial, adotado | `opencode serve` 1.18.23 (HTTP/SSE, tools, permissions, SDK) |
| **Codex CLI** | OpenAI | oficial | `developers.openai.com/codex/`, README |
| **Claude Code** | Anthropic | oficial | `code.claude.com/docs/llms.txt` |
| **Aider** | comunitário | oficial | `aider.chat/docs/` |
| **Continue** | comunitário | oficial | `docs.continue.dev/` |
| **Cursor Agent** | Cursor | oficial | `cursor.com/docs/agent` |
| **deepseek-harness-cli (dsh)** | fork unofficial do Codex (peiyuwang54) | **não-oficial / fork** | master, 26-08-2026 |

> **provenance note:** o deepseek-ai (deepseek-ai/DeepSeek) não publica CLI
> agentic oficial — só API HTTP de chat completion e o modelo. O "dsh"
> comparado é o fork `peiyuwang54/deepseek-harness-cli` (fork do codex com
> Cordis, 56 stars), mantido em sincronia com o "deepseek-harness" upstream.
> Foi incluído por pedido explícito para mostrar **o que um fork de codex
> empilha por cima**; o unigma não vai adaptar nem importar o dsh.

## filtros aplicados (regras invariáveis do AGENTS.md)

1. **Sem backend, conta, RBAC, cloud, telemetria, fila distribuída** (D-001).
2. **OpenCode é fonte de verdade**; paridade é via adapter HTTP/SSE, não via
   patch/fork do opencode.
3. **Workspace confiável + aprovação explícita**; nada de auto-approve global
   sem flag local.
4. **Sem catálogo de providers, sem marketplace, sem instalação silenciosa**.
5. **OpenSSH para remoto**; D-006.
6. **UI padrão em inglês + pacote `pt-BR`**; unigma é desktop próprio, não TUI
   nem IDE extension (D-002, D-016).
7. **Patchset service-only mínimo e reaplicável**; bundle `unigma+opencode`
   versionado (D-022).
8. **Recusa caso a caso** quando a feature não tem requisito novo (YAGNI/KISS).

## resultado

~30 itens em P0 (MVP obrigatório, dentro do que o opencode já entrega ou
adapter trivial), ~11 em P1 (parity forçada via adapter, mesmo release se
der tempo), 4 em P2 (agent teams opt-in, toggle experimental off por padrão).
Cerca de **30-35%** do que cada harness tem foi descartado por padrão.

> `fora de personagem · nota técnica` — o opencode já entrega a maior parte do
> que o codex/claude têm. o adapter existe para preencher 4 lacunas específicas
> (presets nomeados, broker OAuth local, network allowlist, painel de inspeção
> MCP) e 1 camada de auditoria (append-only + hash chain). **nada disso
> substitui o opencode**; tudo conversa com `opencode serve` via loopback.

## P0 — MVP (obrigatório)

### núcleo herdado do OpenCode (preservar; sem código novo)

- **session lifecycle completo** — criar, listar, retomar, deletar; fork
  espelhado quando o opencode documentar. origem: opencode + codex.
- **streaming via SSE** — `/event`, `message.part.updated`,
  `message.part.removed`. origem: opencode.
- **`session.diff`** como base de review e restore. origem: opencode.
- **tools built-in do opencode** — `bash`, `read`/`write`/`edit`, `glob`/`grep`,
  `lsp`, `apply_patch` (pass-through), `todowrite`, `question`, `skill`,
  `webfetch`/`websearch` opt-in, custom tools opt-in. origem: opencode.
- **`AGENTS.md` / `OPENCODE.md` do workspace** com **render budget de
  65.536 bytes** (lição do dsh; evita prompt explosion). origem: opencode +
  dsh.
- **`.opencode/rules`** (system prompt append). origem: opencode + claude.
- **skills locais** em `~/.config/opencode/skills/*` e `.opencode/skills/`.
  origem: opencode + claude.
- **multi-provider via `/config/providers`** — anthropic, openai, ollama,
  lmstudio, bedrock, vertex, foundry, gateways, **deepseek** (via baseURL
  custom, mesma rota de ollama). origem: opencode + dsh prova que deepseek
  cabe.
- **matriz `allow/ask/deny` com wildcards** + `doom_loop` + `external_directory`
  guard. origem: opencode + claude.
- **eventos `permission.updated` / `permission.replied`** como fio condutor da
  UI. origem: opencode.

### adapter unigma (código novo, baixa complexidade, alto retorno)

- **presets nomeados de permission** — `workspace-write` (default),
  `full-auto` (workspace + sem `ask`), `danger-full-access` (sem sandbox + sem
  `ask`). origem: dsh.
- **flag de boot explícita** — `--dangerously-bypass-approvals-and-sandbox`
  (forma longa no MVP; atalho curto fica fora até ter UX estável). origem: dsh.
- **painel `/permissions`** (não slash command) — mostra preset atual, botões
  para alternar, campo "custom" derivado. origem: dsh.
- **broker OAuth local** para providers que exigem (anthropic, openai) —
  loopback + PKCE, refresh token **sempre no keyring**, nunca em disco puro.
  origem: codex + claude + dsh.
- **network allowlist** opt-in para `web_fetch` —
  `networkAllowlist: ['example.com', '*.trusted.test']`. origem: dsh.
- **painel `/mcp` com 6 sub-visões** — `tools`, `desc`, `schema`, `resources`,
  `prompts`, `reload`. origem: dsh.
- **`doctor` command** + `--json` para automação. origem: dsh.
- **shell completion** para `bash/zsh/fish/powershell`. origem: dsh.
- **credenciais em arquivo `0600`** (POSIX) + fallback keyring. origem: dsh +
  boa prática.
- **CLI headless** `unigma run --json --output-schema <schema>` para
  CI/integradores. origem: dsh + opencode.

### auditoria local (D-014)

- **append-only local** em
  `~/.local/share/unigma/audit/YYYY-MM-DD.jsonl` com **hash chain** (cada
  linha inclui `prev_hash` + `sha256(this)`). origem: consenso dos 6
  harnesses + dsh.
- **eventos registrados** — `session.created/closed`,
  `permission.asked/granted/denied`, `tool.invoked/completed/errored`,
  `file.written`, `command.executed`, `auth.refreshed`. origem: codex +
  claude + dsh + boa prática.

### UI/UX

- **paleta de comandos própria** (não TUI). origem: opencode + D-016.
- **atalhos `@` (anexar arquivo) e `/` (comando)** replicados na paleta.
  origem: claude.
- **diff inline com aprovação arquivo a arquivo** (default `ask`; nunca
  auto-approve global). origem: codex + claude + aider.
- **restore/undo via `git stash` dedicado** (não reescrever o passado da
  session). origem: aider + claude + cursor.
- **`/undo` como atalho de paleta** — aplica stash + refresh de `session.diff`.
  origem: aider + claude.

## P1 — mesmo release se der tempo (parity forçada via adapter)

- **compactação client-side** — opencode expõe `/session/status`; a UI
  reescreve o histórico antes de enviar (com `agent/pre-step` análogo ao dsh).
  só faz sentido se o contexto estourar. origem: claude + dsh.
- **`minimal` agent preset** ("perguntar sem mexer") — system prompt fixo +
  `bash` + `str_replace_editor` + sandbox read-only. origem: dsh.
- **subagents via `parentID`** com **quota por workspace** configurável em
  `.unigma/config.toml`. origem: opencode + codex + claude.
- **background agents** usando o worker thread pool do unigma (D-005), com
  quota. origem: cursor + codex + claude.
- **agent view read-only** — unigma desenha a árvore, opencode dá a
  hierarquia via `parentID` + `children`. origem: claude + dsh.
- **ephemeral session** (`/side`) — transcript local mas fora do log
  persistente. origem: dsh.
- **structured output** via `--output-schema` no headless e via SDK.
  origem: claude + dsh.
- **`fast mode`/reasoning-effort toggle** exposto em `/provider` (painel,
  não slash). origem: codex + dsh.
- **OAuth MCP** com broker local (mesma infra do broker OAuth de provider).
  origem: codex + claude + cursor + dsh.
- **`AGENTS.md` index search** opcional (sqlite em memória, **só se** a
  busca ficar lenta). origem: dsh.
- **`cordis.patch.yml` em camadas** (profile + home + `--patch`) — só se a
  config do unigma ficar com 3+ níveis de override. origem: dsh.

## P2 — agent teams opt-in (toggle experimental, off por padrão)

> entra **depois** do MVP, com flag `--experimental-teams`. usuário precisa
> ligar explicitamente; UI avisa que ainda não é estável.

- **agent teams** — roster + task board + mailbox sobre subagentes
  continuáveis. origem: dsh (`ctx.agentTeams`).
- **`/goal` opt-in** + `ctx.goals` (com progresso persistido em arquivo
  local, não cloud). origem: claude + cursor + dsh.
- **code review multi-agent** (subagent que lê o `session.diff` e emite
  comentários estruturados). origem: claude.
- **fork de session** espelhado no opencode quando a feature for
  documentada. origem: claude + dsh.

## recusado (com motivo)

| item | motivo |
| --- | --- |
| TUI standalone | D-016, perfil service-only |
| IDE extension (VS Code/JetBrains) | D-002, unigma é desktop próprio |
| Agents Window / web UI em `127.0.0.1:3080` | D-001, sem backend |
| Share link público | D-001, viola "sem cloud" |
| Cloud session / remote control / mobile | D-001, D-006 (OpenSSH já cobre) |
| Marketplace / discovery de MCP | D-001, D-008 |
| Catálogo de providers | D-001, providers são opt-in por config |
| Auto memory / cross-session learning | viola "sem backend" se virar sync; sem requisito |
| Auto-update binário | D-022, bundle versionado |
| Autocomplete inline (Copilot-like) | outro produto; YAGNI sem requisito |
| Voice-to-code | sem requisito; mic = permissão extra |
| Commit automático | viola "aprovação explícita" |
| Login social sem broker local | D-001, refresh token em disco é vetor |
| Subagent providers plugáveis (codex/claude) | viola D-001; é justamente o que evitamos |
| AdministratorLocked / RBAC | D-001, sem conta, sem RBAC |
| Sandbox `danger-full-access` ligado por padrão | documentar como destrutivo; exigir flag local |
| Adaptar / importar o dsh (deepseek-harness) | unofficial / fork; sem garantia de continuidade; viola "opencode é fonte de verdade" |

## mapeamento por épico (sugestão, não atualização de backlog)

| épico atual | recebe em P0 | recebe em P1 | recebe em P2 |
| --- | --- | --- | --- |
| E-00 service-only | base | — | — |
| E-01 bridge unigma↔opencode | presets nomeados, painel `/permissions`, broker OAuth, network allowlist | — | — |
| E-02 tools built-in | skills locais, custom tools opt-in, `apply_patch` pass-through | — | — |
| E-03 permission/sandbox | presets + flag `--dangerously-bypass-approvals-and-sandbox` + `networkAllowlist` | — | — |
| E-04 session lifecycle | histórico + restore/undo | compactação client-side, ephemeral, fork | — |
| E-05 subagentes | — | subagents + quota, background agents, agent view | agent teams, code review multi-agent |
| E-06 MCP | painel de inspeção (6 sub-visões) | OAuth MCP broker | — |
| E-07 providers | deepseek via baseURL, completion, doctor | structured output, reasoning toggle | — |
| E-08 auditoria | append-only + hash chain | UI de consulta (se ficar barata) | — |
| E-09 dx/cli | headless `--json`, completion, doctor | — | `/goal` opt-in |

## como isso vira cards (sugestão operacional)

- cada item P0 vira pelo menos 1 card por épico com ACs verificáveis.
- P1 fica num board `parity` separado; só entra no sprint se a previsão
  permitir sem cortar P0.
- P2 fica atrás de uma flag; revisão de segurança e D-001 antes de qualquer
  exposição de UI.
- qualquer divergência com `DECISIONS.md` volta para ADR antes de virar
  card.

## fontes e rastreabilidade

- arquitetura e fronteiras: [ARCHITECTURE.md](../ARCHITECTURE.md);
- regras invariáveis: [AGENTS.md](../../AGENTS.md);
- perfil service-only: [OPENCODE-SERVICE-ONLY.md](../OPENCODE-SERVICE-ONLY.md);
- matriz de compatibilidade opencode: [OPENCODE-COMPATIBILITY.md](../OPENCODE-COMPATIBILITY.md);
- backlog vigente: [BACKLOG.md](../BACKLOG.md);
- decisões: [DECISIONS.md](../DECISIONS.md);
- quadro e status da campanha: [WORKBENCH.md](../status/WORKBENCH.md) e [campanha](../status/2026-08-26-campanha.md);
- OpenCode `serve` 1.18.23: [opencode.ai/docs/server](https://opencode.ai/docs/server/);
- Codex CLI: [developers.openai.com/codex](https://developers.openai.com/codex/);
- Claude Code: [code.claude.com/docs/llms.txt](https://code.claude.com/docs/llms.txt);
- Aider: [aider.chat/docs](https://aider.chat/docs/);
- Continue: [docs.continue.dev](https://docs.continue.dev/);
- Cursor Agent: [cursor.com/docs/agent](https://cursor.com/docs/agent);
- dsh (referência histórica, não usado): [peiyuwang54/deepseek-harness-cli](https://github.com/peiyuwang54/deepseek-harness-cli).

## limites deste documento

- não é promessa de prazo;
- não é lista de issues. cada item aqui precisa virar card com ACs antes de
  implementação;
- não substitui `DECISIONS.md`. se houver divergência, **D-### vence**;
- não cobre o que está fora de `docs/` (mudanças em
  `extensions/unigma-agent-runtime/` ou `extensions/unigma-remote-ssh/` que
  não passem por aqui continuam sujeitas a revisão própria).
