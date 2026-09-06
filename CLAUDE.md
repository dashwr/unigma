@AGENTS.md

# Claude Code neste repositório

`AGENTS.md`, importado acima, é a instrução canônica e continua servindo o
OpenCode sem alteração. Este arquivo só existe porque o Claude Code lê
`CLAUDE.md` e não lê `AGENTS.md`. Nada aqui substitui aquelas regras; em
conflito, vale `AGENTS.md`.

## precedência das instruções carregadas

`.claude/CLAUDE.md` é material herdado do upstream e descreve o VS Code, não o
unigma. Trate-o como contexto de arquitetura do fork, subordinado a `AGENTS.md`:
ele não conhece o board, as autorizações, o depósito de artefatos nem os limites
de execução local deste projeto.

## armadilha desta máquina

O `node` do `PATH` é v26 e quebra o hook de pre-commit e a suíte do runtime.
Prefixe o Node fixado em toda invocação de `git commit`, `npm run` e
`node --test`:

```bash
export PATH="/home/dasher/.local/node-v24.18.0-linux-x64/bin:$PATH"
```

## limites que valem em cada sessão

- Não rode build amplo, empacotamento ou smoke com payload real aqui: esta
  máquina já travou e precisou ser reiniciada. O runner self-hosted é a
  autoridade, e um ciclo custa de cinco a vinte minutos.
- Não trate `/rewind` como rede de segurança: os checkpoints não cobrem o que foi
  alterado por Bash, e boa parte do trabalho deste repositório é script, workflow
  e build.
- Instrução é contexto, não bloqueio. O que precisa ser garantido está em
  `.claude/settings.json` e nas regras de `.claude/rules/`.
- Entrega só é entrega com prova de runner citada no backlog. Documento revisado,
  diff limpo e teste local não fecham `AC`.
