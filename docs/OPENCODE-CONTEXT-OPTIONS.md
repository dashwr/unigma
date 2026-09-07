# OpenCode: onde o contexto é montado e o que o unigma pode influenciar

> **T-054 / E-05.** Levantamento de código sobre o OpenCode `1.18.23`, feito em
> 2026-09-06 no checkout `/home/dasher/projects/unigma/opencode` (`c2eacd72af`).
> É um levantamento, não um aceite: nada aqui autoriza ampliar o patchset
> `service-only`, e nenhuma opção citada está provada por run de runner.

## 1. Por que este documento existe

O unigma precisa acrescentar o mínimo de contexto próprio ao pedido do usuário
sem duplicar o que o OpenCode já monta e sem carregar um patch upstream que
teríamos de manter para sempre. A pergunta operacional é estreita: **o que dá
para influenciar pela configuração e pela API HTTP, e o que só existiria
alterando o código do OpenCode.**

## 2. Como o system prompt é montado

A montagem efetiva está em `packages/opencode/src/session/llm/request.ts:56-112`,
nesta ordem:

1. `agent.prompt`, quando o agente define um; caso contrário, o prompt fixo
   escolhido por modelo em `session/system.ts:27-49`, com os arquivos em
   `session/prompt/`;
2. o contexto dinâmico recebido em `input.system`;
3. o `system` enviado na própria requisição;
4. a transformação do plugin `experimental.chat.system.transform`.

O contexto dinâmico é montado em `session/prompt.ts:1257-1272` e reúne skills,
bloco de ambiente (`system.ts:67-103`), instruções de arquivo
(`session/instruction.ts`), instruções MCP e o histórico da sessão.

As instruções de projeto seguem `session/instruction.ts:60-68`: `AGENTS.md`
global, `~/.claude/CLAUDE.md`, e no projeto `AGENTS.md`, `CLAUDE.md` e
`CONTEXT.md` — nessa precedência, com `findUp` do diretório da sessão até a raiz
do worktree e o primeiro match de projeto vencendo. `OPENCODE_DISABLE_PROJECT_CONFIG`
e `OPENCODE_DISABLE_CLAUDE_CODE*` desligam partes disso.

## 3. O que dá para influenciar sem tocar no upstream

- `agent.*.prompt` na configuração, que substitui o prompt-base do provider;
- `instructions` na configuração, incluindo caminhos e URLs;
- `PromptInput.system` na requisição — o campo que o unigma usa hoje;
- `model`, `agent` e `variant` por requisição;
- permissões de agente, MCP e skills;
- o plugin `experimental.chat.system.transform`.

`PromptInput` está em `session/prompt.ts:1499-1521` e aceita `model`, `agent`,
`system`, `variant`, `format` e `parts`. As partes de arquivo seguem
`FilePartInput` e, para `mime: 'text/plain'` com URL `file:`, o OpenCode lê o
arquivo **no host onde ele executa**, aceitando `?start=` e `?end=` como recorte
de linhas (`session/prompt.ts:807+`). É por isso que anexar o editor aberto não
exige IO nem no workbench nem no runtime.

## 4. O que exigiria ampliar o patchset

- substituir o pipeline de montagem inteiro;
- criar um campo HTTP que substitua todo o system prompt;
- mudar a precedência entre instruções ou impedir a leitura das de projeto;
- compactar o contexto por política externa antes de `LLMRequestPrep.prepare`.

O patch `service-only` versionado hoje só mexe em entrypoint, exclusão da UI
embutida, empacotamento, rota de UI e opções do servidor
(`build/unigma/opencode-service-only/0001-service-only-entrypoint.patch`). Ele
não cria ponto de controle de prompt, e **não deve passar a criar** para atender
a este recorte.

## 5. O que é volumoso

Por ordem provável de custo: o histórico da sessão (`prompt.ts:1262`), as
instruções de arquivo lidas integralmente (`instruction.ts:155-168`), a lista
verbose de skills (`system.ts:108-116`), as instruções MCP, que não são truncadas
(`system.ts:119-134`), e as descrições de tools (`tool/registry.ts:265-277`).

Isso é avaliação de custo, não medição: nenhum número de token foi coletado.

## 6. Decisão adotada no recorte

O unigma usa apenas `PromptInput.system`, com o preâmbulo curto de
`extensions/unigma-agent-runtime/src/application/sessionContext.ts`: quem está
chamando, a pasta à qual a sessão está presa, o host remoto quando existe e
quantos anexos reais acompanham o pedido. Nada além disso, porque tudo o mais já
é montado pelo OpenCode e repetir só gastaria contexto.
