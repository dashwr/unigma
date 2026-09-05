# patchset service-only do OpenCode

Este diretório é o corte `service-only` de `D-023`, guardado como patch em vez de
fork. `docs/OPENCODE-SERVICE-ONLY.md` decide o que sai e o que fica; aqui está a
forma executável dessa decisão.

## proveniência

- upstream: `opencode`, branch `dev`
- commit base: `c2eacd72afc4a4984564c393e15ab30011057269`
- é o mesmo commit fixado em `OPENCODE_COMMIT` no workflow
  `.github/workflows/opencode-linux-artifact.yml`; se um dos dois mudar sem o
  outro, `apply-service-only-patches.ts` recusa antes de compilar qualquer coisa.

## o que o patch faz

`0001-service-only-entrypoint.patch` acrescenta `packages/opencode/src/service.ts`
como entry point próprio e passa a construí-lo sob `--service-only`:

- o binário resultante aceita apenas `serve`, `--hostname`, `--port` e
  `--version`; qualquer outra opção é recusada por erro, não ignorada;
- `--hostname` só aceita `127.0.0.1`, de modo que exposição em LAN deixa de ser
  alcançável por argumento;
- a Web UI e o worker Tree-sitter não são embutidos, e `uiRoute` fica desligado;
- o contrato HTTP/SSE, sessões, permissões, plugins, MCP, regras, skills e
  providers permanecem intactos — a poda é de entradas, não de capacidade.

O patch **não** altera instalação, credencial, configuração ou dados do usuário.

## como aplicar

```bash
node --experimental-strip-types build/unigma/apply-service-only-patches.ts \
  --checkout <checkout-do-opencode> \
  --expect-commit c2eacd72afc4a4984564c393e15ab30011057269
```

O aplicador exige que o checkout esteja exatamente no commit base e com a árvore
limpa, e confere todos os patches antes de aplicar qualquer um. Um patch que não
aplica interrompe o pipeline com o checkout intacto, em vez de produzir um corte
parcial que compila.

## como regerar

O patch foi extraído de um worktree candidato com `git diff` mais o arquivo novo.
Ao atualizar o commit base, reaplique, resolva o conflito no checkout, regenere o
`.patch` e atualize tanto a proveniência acima quanto `OPENCODE_COMMIT`.
