# referências oficiais — experiência agentiva

Consulta: 2026-09-05. Pesquisa documental, não teste de produto nem autorização
de mudança. Complementa [Cursor × OpenCode](2026-09-05-cursor-opencode.md).
As páginas acompanham produtos vivos: não constituem contrato do OpenCode
embarcado `1.18.23`, nem especificação dos componentes herdados de Code - OSS.

## objetivo e fronteira

O objetivo confirmado é um IDE Code - OSS com experiência nativa de agente,
providers abertos, execução local/remota, sessões, revisão e permissões via
OpenCode. Comparar experiências não implica copiar internals proprietários,
adicionar harnesses concorrentes ou prometer paridade.

O responsável autorizou **reabrir decisões**, não aprovou ainda as alternativas.
Até uma decisão explícita em `DECISIONS.md`, continuam vigentes as restrições
de persistência, harness único, ausência de backend/cloud e segurança.

## capacidades verificadas e consequências

| Produto | O que a documentação sustenta | Limite relevante para unigma |
| --- | --- | --- |
| OpenCode | HTTP/OpenAPI/SSE; modelos e variantes; ferramentas, regras, MCP, sessões filhas, todo e reversão | API deve ser confirmada no binário fixado. Sessão filha não cria worktree automaticamente; snapshot não protege escritores externos |
| VS Code | contexto implícito do editor e referências explícitas; revisão/checkpoints; Workspace Trust; extension host remoto | contexto disponível no editor não é todo enviado ao modelo. Trust não é sandbox. Recursos Copilot não são automaticamente recursos do fork |
| Cursor | busca/contexto de codebase; plano revisável antes de executar; worktrees separados | busca documentada envolve serviços Cursor; não comprova o suposto índice de embeddings exclusivamente local. Plano aprovado não aprova cada efeito; worktree não é sandbox |
| Claude Code | loop de ferramentas, contexto separado de subagentes, worktrees, permissões e checkpoints | checkpoints não cobrem genericamente Bash, alterações externas ou sessões concorrentes; equipes são experimentais e não garantem isolamento automático |
| Codex | execução/revisão local, subagentes, sandbox com política de rede e aprovações; worktrees Git | sandbox é propriedade do ambiente efetivo, não do texto de uma regra. Worktree exige Git e tem ciclo de vida próprio; permissões irrestritas removem proteções |
| Antigravity | subagentes com workspace herdado/compartilhado/isolado; permissões e sandbox de terminal em preview | sandbox deve estar habilitado; execução fora dele tem privilégios do host. Não foi confirmada garantia de undo transacional |

## distinções obrigatórias

1. **Intenção, implementação, evidência e aceite são estados diferentes.** Uma
   página oficial de concorrente comprova a descrição dele, não o suporte unigma.
2. **Permissão precede o efeito; diff normalmente vem depois.** Um botão de
   revisão não transforma edição já realizada em proposta sem efeitos.
3. **Trust, regra, permissão, sandbox e worktree não são sinônimos.** Regras
   orientam o modelo; sandbox impõe limites de processo; Git separa checkouts.
4. **Undo tem escopo.** Não prometer preservar buffers sujos, untracked ou
   mudanças de terceiros sem cenário real e proteção de concorrência. Comparar
   hashes antes de restaurar ainda deixa uma corrida entre comparação e escrita.
5. **Paralelismo cobra contexto e coordenação.** Subagentes de leitura são uma
   etapa distinta de múltiplos escritores. Não criar scheduler paralelo ao harness.
6. **Contexto precisa de origem e versão.** Arquivo salvo, seleção de buffer e
   referência documental são entradas diferentes; não enviar silenciosamente
   todo o workspace nem criar índice persistente por inferência.
7. **Fast/deep não é Autopilot.** Perfil de interação, variante de modelo e
   seleção automática têm controles e custos diferentes. Não fixar janela 200k.

## alternativas para decisão humana

Estas alternativas **não são tarefas de implementação liberadas**:

| Tema | Alternativa conservadora recomendada | Alternativa que amplia escopo |
| --- | --- | --- |
| contexto | anexos explícitos e busca sob demanda, sem índice próprio | índice persistente: definir armazenamento, privacidade, invalidação e custo |
| edição | revisão posterior claramente rotulada; detectar buffer sujo e parar | proposta isolada em worktree e integração revisada; definir origem de mudanças dirty |
| reversão | indisponível onde houver escritores externos ou garantia insuficiente | reversão compartilhada: exige protocolo de concorrência, não apenas endpoint revert |
| paralelismo | subagentes de leitura primeiro | escritores em worktrees explícitos, com política de criação, integração e limpeza |
| interação | manter seleção explícita/Autopilot separados de perfis | fast/deep com orçamento e ferramentas definidos; decidir colisão do `@` com anexos |
| expansão | OpenCode único harness; experiência local-first | browser/cloud/adaptadores: revisar requisitos, segurança, suporte e persistência |

Para aprovar uma alternativa, registrar: escolha, não objetivos, requisitos
afetados, fonte de verdade, autorização de efeitos, custo, matriz de falha e
aceite. Só então decompor contratos RPC, runtime, UI e testes para executores.

## fontes oficiais

**Resultado humano posterior à tabela:** em 2026-09-05 foram aprovados contexto
sem índice próprio (D-038), direção de worktree revisável (D-039) e manutenção
da fronteira/harness único com leitura antes de escritores (D-040). As alternativas
acima registram a comparação, não permanecem todas em votação. Fast/deep,
sintaxe de anexos e detalhes de integração/dirty continuam sem aprovação.

### OpenCode

- https://opencode.ai/docs/server/
- https://opencode.ai/docs/agents/
- https://opencode.ai/docs/tools/
- https://opencode.ai/docs/models/
- https://opencode.ai/docs/rules/
- https://opencode.ai/docs/permissions/
- https://opencode.ai/docs/mcp-servers/
- https://opencode.ai/docs/tui/
- https://opencode.ai/docs/lsp/

O detalhe de endpoints, código local e drift de versões está na proposta
Cursor × OpenCode; capacidades adicionais exigem atualizar
`OPENCODE-COMPATIBILITY.md` contra `/doc` do artefato, sem inferir suporte do dev.

### VS Code

- https://code.visualstudio.com/docs/editing/workspaces/workspace-trust
- https://code.visualstudio.com/docs/chat/chat-overview
- https://code.visualstudio.com/docs/remote/remote-overview

### Cursor

- https://cursor.com/docs/context/codebase-indexing
- https://cursor.com/docs/agent/modes
- https://cursor.com/docs/configuration/worktrees

### Claude Code

- https://code.claude.com/docs/en/agents
- https://code.claude.com/docs/en/permissions
- https://code.claude.com/docs/en/checkpointing

### Codex

- https://learn.chatgpt.com/docs/codex/cli.md
- https://learn.chatgpt.com/docs/agent-approvals-security.md
- https://learn.chatgpt.com/docs/environments/git-worktrees.md

### Google Antigravity

- https://antigravity.google/docs/subagents/
- https://antigravity.google/docs/permissions/
- https://antigravity.google/docs/sandbox/

O índice `https://antigravity.google/docs/llms.txt` retornou 404; as páginas
específicas foram acessíveis. Ausência de confirmação nesta pesquisa não prova
ausência de capacidade no produto.
