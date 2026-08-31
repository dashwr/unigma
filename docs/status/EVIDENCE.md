# unigma — formato de evidência

> **status:** normativo desde 2026-08-28.
> **fonte:** item 0.5 da onda 0 em
> [`../planos/2026-08-28-ondas-refundacao.md`](../planos/2026-08-28-ondas-refundacao.md);
> regra transversal de `../ACCEPTANCE.md`.

Este documento define o único formato aceito para declarar que algo foi
validado. Ele não descreve como rodar os comandos — isso está nos workflows —,
descreve o que precisa estar escrito para que um run conte.

## regra transversal

Fixture, mock, probe externo, compile local ou documentação **não** convertem
direção em suporte. Aceite exige, cumulativamente: comando, ambiente, cenário e
artefato reproduzível. Faltando qualquer um, o resultado é anotado como
diagnóstico, nunca como aceite.

Consequências diretas:

- execução em Node 26 é diagnóstico local, não matriz oficial;
- passar localmente não substitui o runner `self-hosted`;
- um probe do `opencode` instalado na máquina não prova o bundle;
- teste contra fixture não prova integração com processo real.

## campos obrigatórios

Toda entrada de evidência registra, sem exceção:

| campo | descrição |
| --- | --- |
| data | data da execução, `AAAA-MM-DD`. |
| tarefa/gate | `T-0xx`, `AC-0xx` ou o épico que a evidência pretende mover. |
| run id | id do run no GitHub Actions. |
| workflow | arquivo do workflow disparado. |
| commit/head | SHA completo ou curto da árvore executada. |
| plataforma | `windows-x64` ou `linux-x64`, com o host real. |
| Node/npm | versão exata de Node e major de npm usados. |
| resultado por passo | cada passo da sequência oficial com `ok`/`falha`. |
| artefato | nome, id numérico e tamanho em bytes. |
| hashes | SHA-256 do artefato ou dos arquivos relevantes. |
| conclusão | o que a evidência prova **e o que ela não prova**. |

O último campo não é decorativo: ele impede que um recorte verde seja lido como
aceite de épico.

## sequência oficial por plataforma

A ordem abaixo é a executada pelos workflows
`.github/workflows/unigma-self-hosted-validation.yml` (Windows x64) e
`.github/workflows/unigma-linux-wsl-validation.yml` (Linux x64 em Ubuntu WSL2).
Windows roda antes de Linux, sequencialmente, no mesmo host.

1. `npm ci --no-audit --no-fund`
2. `npm run gulp compile-extension:unigma-agent-runtime`
3. `npm --prefix extensions/unigma-agent-runtime test`
4. `npm run typecheck-client`
5. `npm run test-build-scripts`
6. `npm run gulp vscode-<plat>-x64`
7. `node --experimental-strip-types build/unigma/audit-distribution.ts ...`
8. `npm run smoketest -- --tracing --f '^(?!.*(?:Terminal Profiles|Chat|Agents Window)).*$'`
9. publicação do artefato `unigma-<plat>-x64-${run_id}`

O filtro do passo 8 exclui `Terminal Profiles`, `Chat` e `Agents Window` por
escopo declarado. Depois de `T-103`, `Agents Window` sai do filtro porque o
smoke correspondente deixa de existir; a mudança do filtro é ela própria um fato
a registrar na evidência.

## matriz oficial

- Node major `24`, `>= 24.18.0`; `.nvmrc` fixa `24.18.0`.
- npm major `< 12`.
- `build/npm/preinstall.ts` aplica a regra lendo `npm_config_user_agent`.
- Yarn, instalação global e `--ignore-scripts` deixam a árvore inválida e
  invalidam qualquer evidência produzida a partir dela.
- Runner oficial: GitHub Actions `self-hosted`, disparo `workflow_dispatch`,
  timeout de 240 minutos.

## modelo de entrada

Copie o bloco abaixo para o registro datado da frente e preencha todos os
campos. Não remova linhas: campo sem valor é escrito como `não executado` ou
`não aplicável`, com a razão.

```text
data:            AAAA-MM-DD
tarefa/gate:     T-0xx / AC-0xx
run id:          <id>
workflow:        unigma-<...>-validation.yml
commit/head:     <sha>
plataforma:      windows-x64 | linux-x64
node/npm:        v24.18.0 / npm 11.x
passos:
  1 npm ci                          ok|falha
  2 compile-extension               ok|falha
  3 runtime test                    ok|falha
  4 typecheck-client                ok|falha
  5 test-build-scripts              ok|falha
  6 gulp vscode-<plat>-x64          ok|falha
  7 audit-distribution              ok|falha
  8 smoketest                       ok|falha
artefato:        unigma-<plat>-x64-<run_id> (id <numérico>, <bytes> bytes)
hashes:          <sha256>
prova:           <o que fica comprovado>
não prova:       <o que continua em aberto>
```

## registro de referência

Os runs abaixo são o exemplo canônico de evidência completa e continuam válidos
como registro histórico do recorte de núcleo de `AC-013`, head `838ca94e`:

| plataforma | run id | artefato | id do artefato | bytes |
| --- | --- | --- | --- | --- |
| linux-x64 | `32929454545` | `unigma-linux-x64-32929454545` | `9593106630` | `183856993` |
| windows-x64 | `32930950550` | `unigma-windows-x64-32930950550` | `9593599662` | `255329029` |

O que esses runs provam: a mesma suíte mínima de inicialização executou nas duas
plataformas e publicou artefatos. O que não provam: sessão OpenCode integrada,
inventário de terceiros, branding ou qualquer capacidade de E-02 em diante.

## entradas desta frente

### diagnóstico local — onda 0 — 2026-08-28

data:            2026-08-28
tarefa/gate:     onda 0 / ambiente
run id:          não aplicável — execução local, não GitHub Actions
workflow:        não aplicável — execução local, não GitHub Actions
commit/head:     `0dd69604b276bea9aa8b1ce322f15aa61a574a1f`
plataforma:      linux-x64 — laptop local, não runner oficial
node/npm:        `v24.18.0` / `npm 11.16.0`; user agent observado:
                 `npm/11.16.0 node/v24.18.0 linux x64 workspaces/false`
passos:
  1 `npm ci --no-audit --no-fund`              ok — 1.556 pacotes em 9 min
  2 `npm run compile-client`                   ok — 6,7 min, 0 erros
  3 `npm run typecheck-client`                 ok — saída sem diagnóstico
  4 host SSH                                  não executado — pré-condição remota
  5 formato de evidência                      ok — este registro
artefato:        não aplicável — não houve empacotamento
hashes:          `package-lock.json` SHA-256
                 `11059b1a81ea740e891cf2ea69b2f0f0091c1ba40edbbeae9e8495cec4b346f9`
prova:           a instalação limpa, compile e typecheck passaram localmente sob
                 Node `24.18.0`/npm `<12`; a árvore de dependências está
                 reproduzível para continuar a onda 1.
não prova:       runner Windows/Linux, artefato, smoke, suporte de release,
                 host SSH ou qualquer aceite de plataforma; o typecheck não será
                 repetido neste laptop e deverá ser colhido no runner nas ondas
                 futuras.

O registro acima substitui a afirmação anterior de ausência de execução. Ele é
diagnóstico local válido para a onda 0, não evidência de distribuição.

### matriz oficial — etapa A / D-024 — 2026-08-30

data:            2026-08-30
tarefa/gate:     `CLI-001` / `D-024` — retirada do Agent Host
run id:          `33328903196`
workflow:        `unigma-self-hosted-validation.yml`
commit/head:     `91867fb14061ae12fbde1faf61de3732785c61ca`
plataforma:      windows-x64 — runner self-hosted
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `install dependencies`                     ok
  2 `compile unigma agent runtime`             ok
  3 `run focused upstream checks`              ok
  4 `build windows x64 package`                ok
  5 `audit windows x64 package`                ok
  6 `run desktop smoke test`                   ok — 62 passing, 30 pending
  7 `write artifact evidence`                  ok
  8 `upload windows evidence`                  ok
artefato:        `unigma-windows-x64-33328903196` (id `9737358810`, `251993014` bytes)
hashes:          registrados no artefato pelo passo `write artifact evidence`
prova:           com o Agent Host removido, o pacote Windows compila, passa na
                 auditoria de distribuição e no smoke de núcleo; o extension
                 host monta seus proxies e as extensões built-in ativam.
não prova:       inventário de terceiros da raiz, branding liberado, sessão
                 OpenCode real contra `opencode serve` ou qualquer capacidade
                 de SSH remoto.

data:            2026-08-30
tarefa/gate:     `CLI-001` / `D-024` — retirada do Agent Host
run id:          `33330427263`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `91867fb14061ae12fbde1faf61de3732785c61ca`
plataforma:      linux-x64 — Ubuntu WSL2 sobre o runner Windows
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `install Linux dependencies and Node in WSL`  ok
  2 `install dependencies in WSL`                 ok
  3 `compile unigma agent runtime in WSL`         ok
  4 `build Linux x64 package in WSL`              ok
  5 `audit Linux x64 package in WSL`              ok
  6 `run Linux desktop smoke test in WSL`         ok
  7 `write Linux artifact evidence`               ok
  8 `upload Linux evidence`                       ok
artefato:        `unigma-linux-x64-33330427263` (id `9737817330`, `178711178` bytes)
hashes:          registrados no artefato pelo passo `write Linux artifact evidence`
prova:           o mesmo head validado no Windows também empacota, audita e passa
                 no smoke em Linux; a retirada do Agent Host não é específica de
                 plataforma.
não prova:       o mesmo conjunto de lacunas do registro Windows acima.

Correções que tornaram esta matriz possível, todas no mesmo head:

- `0d60cb8e` — o corte de `D-024` removeu o import que registrava
  `IAgentSessionsService`, mas 36 consumidores do stack de chat continuaram
  vivos. O customer `MainThreadChatSessions` falhava em
  `ExtensionHostManager._createExtensionHostCustomers`, mutilando o canal RPC:
  language features mudas, `status.scm.0` ausente e extensões de smoke sem
  ativar. O serviço voltou a ser registrado sozinho, sem nenhuma superfície da
  Agents Window.
- `0d60cb8e` — `ChatStatusBarEntry` era o único registro da área de chat fora do
  gate `isChatPanelEnabled`. Ele mantinha um ícone clicável sem destino e seu
  dashboard lia `defaultChatAgent`, ausente neste `product.json`.
- `91867fb1` — o teste de capability passou a ler as entradas da paleta em vez
  de depender da mensagem de erro de `runCommand`, que só produzia timeout.

### matriz oficial final — remoção de dependências Copilot — 2026-08-30

data:            2026-08-30
tarefa/gate:     `OVN-BRANDING-PACKAGE` / `D-032` — dependências e About
run id:          `33340526388`
workflow:        `unigma-self-hosted-validation.yml`
commit/head:     `ac74acec2d5cbc591f2b98fb198e53cec8a45045`
plataforma:      windows-x64 — runner self-hosted
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `install dependencies`                     ok
  2 `compile unigma agent runtime`             ok
  3 `run focused upstream checks`              ok
  4 `build windows x64 package`                ok
  5 `audit windows x64 package`                ok
  6 `run desktop smoke test`                   ok
  7 `write artifact evidence`                  ok
  8 `upload windows evidence`                  ok
artefato:        `unigma-windows-x64-33340526388` (id `9740716863`, `251764464` bytes)
hashes:          registrados no artefato pelo passo `write artifact evidence`
prova:           a remoção das dependências da raiz e do remote não quebrou a
                 instalação limpa, o pacote Windows, a auditoria de distribuição
                 ou o smoke de núcleo.
não prova:       notice root regenerado, clearance legal de terceiros, sessão
                 OpenCode real ou qualquer capacidade SSH.

### matriz oficial — contrato OpenCode/SSH — 2026-08-31

data:            2026-08-31
tarefa/gate:     `E01-B` / `E01-D` — contratos OpenCode e SSH fail-closed
run id:          `33345230165` (rerun)
workflow:        `unigma-self-hosted-validation.yml`
commit/head:     `d00521d65c9a4bed25d1d54c4056701033ee08fc`
plataforma:      windows-x64 — runner self-hosted
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `install dependencies`                     ok
  2 `compile unigma agent runtime`             ok
  3 `run focused upstream checks`              ok
  4 `build windows x64 package`                ok
  5 `audit windows x64 package`                ok
  6 `run desktop smoke test`                   ok
  7 `write artifact evidence`                  ok
  8 `upload windows evidence`                  ok
artefato:        `unigma-windows-x64-33345230165` (id `9742391434`, `251783295` bytes)
hashes:          registrados no artefato pelo passo `write artifact evidence`
prova:           o patch OpenCode/SSH compila e não regrede o pacote Windows,
                 auditoria ou smoke de núcleo.
não prova:       conexão SSH real, `unigma-server`, provider/modelo real,
                 streaming/diff real, bundle service-only ou notices root.

data:            2026-08-31
tarefa/gate:     `E01-B` / `E01-D` — contratos OpenCode e SSH fail-closed
run id:          `33347302898`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `d00521d65c9a4bed25d1d54c4056701033ee08fc`
plataforma:      linux-x64 — Ubuntu WSL2 sobre o runner Windows
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `install Linux dependencies and Node in WSL`  ok
  2 `install dependencies in WSL`                 ok
  3 `compile unigma agent runtime in WSL`         ok
  4 `build Linux x64 package in WSL`              ok
  5 `audit Linux x64 package in WSL`              ok
  6 `run Linux desktop smoke test in WSL`         ok
  7 `write Linux artifact evidence`               ok
  8 `upload Linux evidence`                       ok
artefato:        `unigma-linux-x64-33347302898` (id `9742755123`, `178649969` bytes)
hashes:          registrados no artefato pelo passo `write Linux artifact evidence`
prova:           o mesmo patch também passa por pacote, auditoria e smoke em
                 Linux/WSL2.
não prova:       conexão SSH real, `unigma-server`, provider/modelo real,
                 streaming/diff real, bundle service-only ou notices root.

data:            2026-08-30
tarefa/gate:     `OVN-BRANDING-PACKAGE` / `D-032` — dependências e About
run id:          `33341927790`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `ac74acec2d5cbc591f2b98fb198e53cec8a45045`
plataforma:      linux-x64 — Ubuntu WSL2 sobre o runner Windows
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `install Linux dependencies and Node in WSL`  ok
  2 `install dependencies in WSL`                 ok
  3 `compile unigma agent runtime in WSL`         ok
  4 `build Linux x64 package in WSL`              ok
  5 `audit Linux x64 package in WSL`              ok
  6 `run Linux desktop smoke test in WSL`         ok
  7 `write Linux artifact evidence`               ok
  8 `upload Linux evidence`                       ok
artefato:        `unigma-linux-x64-33341927790` (id `9741090425`, `178618673` bytes)
hashes:          registrados no artefato pelo passo `write Linux artifact evidence`
prova:           o mesmo head final também passa pela instalação limpa, pacote,
                 auditoria e smoke em Linux/WSL2.
não prova:       notice root regenerado, clearance legal de terceiros, sessão
                 OpenCode real ou qualquer capacidade SSH.
