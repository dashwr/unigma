# unigma — formato de evidência

> **2026-09-06 — matriz de módulos nativos no host remoto.** Run `34013237745`,
> branch `test/t053-owned-reconnect`, modo somente-leitura do smoke da janela
> (`native_modules_only`), contra a versão `493dcfe7` que já estava ativada. O
> probe roda com o Node empacotado da própria versão e não escreve nada no host:
> `native.node.packaged=true`, `glibc` de execução `2.35` contra compilação
> `2.28`, 8 addons encontrados, 8 verificados, **7 carregados e 0 rejeitados**;
> a única falha é `@vscode/deviceid/.../windows.node` com
> `not-self-registered`, que reproduz na máquina de build por não ter ponto de
> entrada em Linux. `@vscode/spdlog` — o módulo do incidente de log silencioso —
> carregou. `smoke=pass`. **Limites:** isso mede a carga dos addons naquele host
> e naquela versão; não exercita sessão de agente, não substitui a auditoria do
> payload montado e não fecha `AC-007`. Dois runs anteriores (`34012250945`,
> `34012758917`) falharam por transporte local sem socket reutilizável, o que
> motivou registrar as pré-condições locais no próprio relatório.

> **2026-09-06 — queda e reconexão na mesma janela remota.** Run `34011376887`,
> branch `test/t053-owned-reconnect`, commit `ed8b224c`, par `493dcfe7`
> selecionado explicitamente e servidor preparado no host com autorização
> específica. O smoke abriu a janela (resolver em 923 ms, handshake do extension
> host em 331 ms), derrubou apenas o processo SSH criado por ele mesmo e observou
> `ssh.connection-lost` seguido de reconexão das conexões de gerenciamento e de
> extension host, com o mesmo processo de desktop vivo: `check.remote-reconnect`,
> `check.owned-ssh-drop-confirmed` e `check.same-desktop-process-alive` passaram,
> `smoke=pass`. **Limites declarados pelo próprio relatório:** sessão de agente e
> matriz de módulos nativos não foram exercitadas (`agent-session-not-tested`,
> `native-module-matrix-not-tested`); AC-007 continua parcial. O servidor
> permanece preparado na VPS por escolha explícita. Evidência sanitizada em
> `.build/t053-34011376887/`.

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

### primeira janela remota contra host real — 2026-09-04

data:            2026-09-04
tarefa/gate:     `T-053` / `AC-007` — abertura de janela remota
run id:          `33949936848`
workflow:        `unigma-remote-window-smoke.yml`
commit/head:     `493dcfe76117e759058a28e69cb6c956a780f952`
plataforma:      cliente linux-x64 sob Xvfb no WSL2 do runner Windows; host
                 remoto = VPS externa, alias `unigma-vps`
node/npm:        `v24.18.0` / npm 11.x
passos:
  1 `checkout`                                   ok
  2 `prepare WSL paths`                          ok
  3 `stage server on VPS`                        ok
  4 `open remote window under Xvfb`              ok
  5 `clean staged server from VPS`               ok
  6 `upload remote window smoke evidence`        ok
artefato:        `unigma-remote-window-smoke-33949936848`
hashes:          par conferido por `PROVENANCE.txt` antes do lançamento;
                 `desktop.commit`, `server.commit` e `desktop.product-commit`
                 iguais a `493dcfe7`
checks:          os doze verdes, incluindo `check.workbench-resolver`,
                 `check.resolved-authority-consumed`,
                 `check.extension-host-handshake`,
                 `check.connection-token-handshake` e `check.remote-window`;
                 `result=remote-window`, `smoke=pass`
tempos:          `resolveAuthority(ssh-remote)` retornou em 725 ms; handshake do
                 extension host concluído em 261 ms
prova:           uma janela remota abriu contra um host real. O resolver
                 devolveu `ResolvedAuthority`, a conexão de gerenciamento a
                 consumiu, o token de conexão foi aceito e o extension host
                 remoto completou o handshake. É a primeira vez que o caminho
                 inteiro executa fim a fim; até aqui todo verde do E-05 provava
                 apenas as camadas que o resolver consome.
não prova:       **a matriz de `AC-007` não está fechada.** Este run cobre
                 abrir a janela; queda de conexão e reconexão continuam sem
                 evidência. Também não prova sessão de agente remota, provider
                 ou modelo real, cliente Windows (sem caminho por `T-056`) nem
                 qualquer capacidade de E-02 em diante no host remoto.
contexto:        os quatro runs anteriores (`33914111178`, `33945192725`,
                 `33946689619`, `33948264271`) falharam no mesmo ponto
                 reportando servidor ausente contra um host cujo staging smoke
                 passava na mesma execução. A causa era o lock de bootstrap,
                 escopado por commit: a sessão que o perdia recusava em vez de
                 reusar o servidor que o vencedor já havia iniciado, e três
                 estados distintos do handshake colapsavam num código só.
                 `fd07d937` separou os códigos, `316e670e` passou a reportar o
                 status de saída do servidor e `493dcfe7` fez a sessão perdedora
                 reusar o socket.

### primeiro relatório de baseline com processo vivo — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-071` / `T-070` — baseline de inicialização
run id:          `34043447622`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `9dc0f1b7211970780925be2c0c7b35d55ae0a82e`
plataforma:      linux-x64 sob Xvfb no WSL2 do runner Windows
node/npm:        `v24.18.0` / npm 11.x
resultado:       job verde em 16m11s; artefato `unigma-linux-x64-34043447622`
números:         `clean-profile` `ready-ms.median=3156`, `spread=2011`;
                 `idle-folder` `ready-ms.median=3118`, `spread=1241`; três
                 repetições cada
prova:           é a primeira vez que o harness sai com um relatório em vez de
                 uma falha. A correção do cabeçalho (`CPU %/Mem MB/PID/Process`
                 no lugar da string `Process Info`, que só existe como comentário
                 no fonte) fez o `--status` ser reconhecido, e o processo
                 principal apareceu por nome do `applicationName`.
não prova:       **estes números não são baseline de inicialização.** As duas
                 execuções reportaram `renderer.present=no`, e `idle-folder`
                 reportou também `extension-host` e `shared-process` ausentes:
                 o harness devolvia assim que qualquer linha aparecia, ou seja
                 media o instante em que o processo principal começa a responder,
                 antes de a janela existir. Também não prova memória, que
                 continua não publicada por conta da dupla conversão em
                 `ps.ts`/`diagnosticsService.ts`.
correção:        a prontidão passou a exigir a linha `renderer`, e o timeout
                 passou a nomear os papéis já vistos. `ready-definition` entrou
                 no relatório para que o número nunca seja lido como outro
                 evento. Falta o run que produza o primeiro `ready-ms` de janela.

### baseline de inicialização com janela viva — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-070`/`T-071` — instrumentação e baseline inicial
run id:          `34045994035`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `36d5c73a5c2eb4fabcabe50da155f7a9e9a66b9d`
plataforma:      linux-x64 sob Xvfb no WSL2 do runner Windows; máquina de
                 11 813 MB
node:            `v24.18.0`
prontidão:       primeira resposta de `--status` contendo a linha `renderer`
repetições:      3 por cenário

| cenário | ready-ms mediana | spread | processos (MB, mediana) |
| --- | --- | --- | --- |
| `clean-profile` | 5394 | 21 | main 248, renderer 402, extension-host 165, shared-process 154, file-watcher 118, other 331 — soma 1418 |
| `idle-folder` | 6580 | 1373 | main 248, renderer 378, extension-host 260, shared-process 154, file-watcher 201, other 450 — soma 1691 |

prova:           primeiro baseline do projeto medido até a janela existir, com
                 memória por processo. A soma de 1418 MB e 1691 MB contra os
                 11 813 MB da máquina passa na guarda de plausibilidade, o que
                 confirma a correção da dupla conversão em
                 `diagnosticsService.ts`: antes a mesma coluna produzia valores
                 de onze dígitos. `pty-host` ausente nos dois cenários é
                 esperado, porque nenhum terminal foi aberto.
não prova:       **o `spread` não é medida de variância do produto.** Cada sonda
                 relança o executável para perguntar `--status`, então o
                 intervalo real entre sondas é o sleep mais esse lançamento. O
                 `spread=21` do `clean-profile` significa que as três execuções
                 precisaram do mesmo número de sondas, não que a inicialização
                 varie 21 ms. O `ready-resolution-ms=250` publicado neste run
                 relatava o sleep e **subestimava** a resolução; corrigido depois
                 deste run para ser medido por observação, com nota no relatório.
                 Também não prova cenário de agente nem de SSH, ambos ausentes
                 por dependência declarada, nem qualquer comparação com outra
                 máquina ou plataforma.

### baseline com cinco repetições — o instrumento é grosso demais — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-070` — baseline por cenário
run id:          `34047514749`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `d7598717954336853741114c9505d69e7c1b53f5`
resultado:       job verde; `clean-profile` mediu, `idle-folder` falhou e foi
                 reportado como ausente com a razão

`clean-profile`, 5 repetições:

| campo | valor |
| --- | --- |
| `ready-ms.median` | 6408 |
| `ready-ms.min` / `max` | 5376 / 7402 |
| `ready-ms.spread` | 2026 |
| `ready-probes.min` / `max` | **3 / 3** |
| `ready-resolution-ms` | **2596** |

prova:           a hipótese da quantização está confirmada. As cinco execuções
                 precisaram **exatamente do mesmo número de sondas**, então o
                 spread não mede consistência do produto; mede onde, dentro de
                 um mesmo intervalo, a janela apareceu.
não prova:       **estes números não servem como baseline de inicialização.** O
                 intervalo real entre sondas é 2596 ms, dez vezes o que o run
                 anterior publicou como resolução. Uma medição de 6408 ms com
                 incerteza de ±2596 ms não sustenta comparação, regressão nem
                 otimização. A causa é o desenho da sonda: cada uma **relança o
                 executável Electron inteiro** para perguntar `--status`, e esse
                 lançamento é ~2,3 s dos 2,6 s de intervalo. O instrumento pesa
                 quase metade do que mede.

`idle-folder`: `measured=absent`. O produto encerrou antes de responder, com
`Lifecycle#kill()` 5 ms depois de o file watcher iniciar e
`connect ENOENT /run/user/1000/vscode-<hash>-main.sock` no mesmo milissegundo.
O mesmo cenário mediu no run `34045994035` com 3 repetições; aqui falhou na
primeira repetição, depois de 5 repetições de `clean-profile` em sucessão. A
causa **não está estabelecida**; a suspeita é o encerramento da repetição
anterior, que espera 2 s fixos e não a morte da árvore de processos. Não tratar
como diagnosticado.

o que funcionou:  todos os mecanismos adicionados neste dia fizeram o que foram
                 escritos para fazer. A falha virou `measured=absent` com razão
                 no arquivo de evidência em vez de só no log do CI; o
                 `continue-on-error` impediu que uma medição derrubasse um pacote
                 já auditado; e `ready-probes` tornou a quantização legível em
                 vez de deixá-la passar por precisão.

### baseline por log — a prontidão passa a valer, a memória não — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-070`/`T-071` — baseline por cenário
run id:          `34051073811`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `14d1e072fd6c4d356889762d1d387405af764675`
resultado:       job verde; **os dois cenários mediram**, 5 repetições cada

| campo | `clean-profile` | `idle-folder` |
| --- | --- | --- |
| `ready-ms.median` | 1708 | 1709 |
| `ready-ms.min` / `max` | 1705 / 1812 | 1707 / 1808 |
| `ready-ms.spread` | 107 | 101 |
| `ready-probes.min` / `max` | 18 / 19 | 18 / 19 |
| `ready-resolution-ms` | **101** | **102** |
| `ready-log-ms.min` / `max` | 1305 / 1390 | 1321 / 1378 |

prova:           **a prontidão está medida.** A resolução caiu de 2596 ms para
                 101 ms — o instrumento deixou de pesar metade do que mede — e
                 o `idle-folder`, ausente no run anterior, mediu nas cinco
                 repetições. O relógio do próprio produto (`ready-log-ms`) fica
                 consistentemente ~380 ms abaixo do relógio de parede, que é
                 exatamente a relação prevista: a primeira linha de log já está
                 dentro da inicialização. As duas medidas independentes
                 concordam, e é isso que sustenta o número.

                 A causa registrada no commit está confirmada por consequência:
                 a sonda `--status` **era** o custo. Os 5394/6580 ms anteriores
                 mediam sobretudo o relançamento do executável, não o produto.

não prova:       **a memória por processo continua não estabelecida, e piorou
                 de forma informativa.** Duas contradições no mesmo relatório:

                 1. `process.renderer.present=no` nos **dois** cenários, num run
                    em que o log registrou janela pronta em todas as cinco
                    repetições. As duas afirmações não descrevem a mesma árvore
                    de processos, e nada no relatório dizia de qual duvidar.
                 2. `extension-host` e `shared-process` com
                    `memory-mb.median=0` ao lado de `spread=130`, no
                    `idle-folder`. Processo que está na tabela está rodando, e
                    processo rodando não ocupa zero megabytes. O portão de
                    plausibilidade existente não via isso, porque zero cabe
                    embaixo de qualquer teto.

                 **Nenhum número de memória deste run deve ser citado.** O
                 `ready-ms` não depende da tabela de processos e permanece.

ação tomada:     o portão passou a recusar zero, com a razão, e o relatório
                 passou a publicar `process.names-seen` — o primeiro token de
                 cada nome impresso pela tabela, sem o título da janela, que
                 pode carregar caminho de workspace. É o que separa "o mapeamento
                 perdeu a linha" de "a linha não estava lá", e o run seguinte
                 responde isso.

comparabilidade: **o número muda de significado pela terceira vez.** `5394`/`6580`
                 e `6408` foram medidos com a sonda que se relançava; `1708` é
                 outro instrumento. Os anteriores ficam como histórico, não como
                 série comparável.

### primeiro prompt respondido no runner — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-011` / `AC-003` — provider e modelo autorizados
run id:          `34052368433`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `9c1e09fa`
resultado:       `smoke=pass`, 17 checks, nenhum `fail`

| campo | valor |
| --- | --- |
| `opencode.version` / `supported-version` | `1.18.23` / `1.18.23` |
| `provider` | `openrouter` |
| `model` | `nvidia/nemotron-3.5-lightning:free` |
| `check.provider-source-environment` | `pass` |
| `check.model-authorized-present` | `pass` |
| `check.prompt-answered` | **`pass`** |
| `answer` | `answered` |

prova:           **o par autorizado por `D-043` responde a um prompt real, no
                 runner, contra o binário fixado.** É a primeira vez no projeto
                 que um envio ao agente completa fora de fixture. Prova junto
                 que a credencial atravessa por `WSLENV` sem passar por `argv`,
                 que o produto não a escreve em lugar nenhum
                 (`source: "env"`), que o processo é derrubado e a porta fecha,
                 e que o estado isolado é removido.

não prova:       **não é suporte a provider, é suporte a este par.** Um envio
                 respondido não cobre streaming parcial, cancelamento,
                 permissão, diff, recuperação de SSE nem versão incompatível —
                 que são `T-024`, `T-031`–`T-034` e o resto de `T-011`. O prompt
                 usado é trivial e deliberadamente não toca o repositório: ele
                 exercita a credencial, não o modelo.

                 Também não prova quota: o modelo é de tier gratuito, e um run
                 futuro pode legitimamente voltar `refused-by-provider` sem que
                 nada tenha regredido no produto. A categoria existe para isso.

armadilha        `connected` em `/provider` aparece com **qualquer** valor na
evitada:         variável, inclusive inválido — medido antes de escrever a
                 prova. Se o smoke lesse só `/provider`, teria ficado verde sem
                 provar credencial nenhuma. `check.prompt-answered` é o único
                 check tratado como prova, e a distinção está escrita dentro do
                 próprio relatório.

### a tabela de processos não tem linha de janela — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-070` — baseline por cenário
run id:          `34052368433`
resultado:       `process.names-seen=file-watcher gpu-process shared-process
                 unigma utility-network-service zygote` (`clean-profile`) e o
                 mesmo mais `extension-host` (`idle-folder`)

prova:           a pergunta que `names-seen` foi criada para responder está
                 respondida: **não há linha `window` na tabela.** O mapeamento
                 de papéis não perdeu a linha; a linha não existe. Isso remove a
                 hipótese de erro no `ROLES` e desloca a questão para o lado do
                 produto — `getMainDiagnostics` não lista a janela num run em
                 que o log do próprio produto registrou `setReady` nas cinco
                 repetições.

não prova:       **a causa não está estabelecida.** Não sei ainda se é do Xvfb,
                 do momento da coleta ou do que `getMainDiagnostics` enumera.
                 Não tratar como diagnosticado; é questão aberta de `T-070`.

nota:            neste run não houve linha `memory=` de recusa — nenhum processo
                 reportou zero. O zero do run `34051073811` é portanto
                 intermitente, o que torna o portão mais necessário, não menos.

### a sonda de renderer elimina as três hipóteses — 2026-09-06

data:            2026-09-06
tarefa/gate:     `T-070` — baseline por cenário
run id:          `34056404723`
workflow:        `unigma-linux-wsl-validation.yml`
commit/head:     `b094b7c9192084e151e759d6afc3f0ae14f1c6b8`
resultado:       job verde; os dois cenários mediram, 5 repetições cada

| campo | `clean-profile` | `idle-folder` |
| --- | --- | --- |
| `ready-ms.median` | 1707 | 1707 |
| `ready-resolution-ms` | 101 | 101 |
| `renderer-probe.count` | 1 | 1 |
| `renderer-probe.parentage` | `in-tree` | `in-tree` |
| `renderer-probe.ordering` | `after-parent` | `after-parent` |
| `renderer-probe.repetitions-agree` | `yes` | `yes` |

prova:           **as três possibilidades que a leitura de fonte deixou em
                 aberto estão eliminadas.** O renderer existe, a cadeia `ppid`
                 alcança o processo lançado, e a linha dele vem depois da do
                 pai. Não é "não há renderer", não é reparentagem, e não é a
                 ordem contra o pai imediato.

                 O `ready-ms` bateu 1707 nos dois cenários pela terceira
                 medição consecutiva, com resolução de 101 ms. O instrumento de
                 prontidão está firme.

não prova:       **a causa da linha de janela ausente continua não
                 estabelecida.** A sonda mede a ordem contra o **pai imediato**,
                 e `addToTree` (`ps.ts:21-24`) exige que **todo ancestral até a
                 raiz** já esteja no mapa quando a linha do filho é lida. Um
                 ancestral do meio ausente derruba a subárvore e a sonda ainda
                 diria `after-parent`. **Essa lacuna é do instrumento, não do
                 produto**, e está registrada como tal.

                 A sonda também compara contra o PID que o harness lançou,
                 enquanto `--status` enraíza em `info.mainPID`, que vem por IPC
                 da instância viva (`main.ts:439`,
                 `diagnosticsMainService.ts:110`). Que os dois coincidam não
                 está estabelecido pela fonte.

achado novo:     `process.names-seen` do `clean-profile` veio **sem**
                 `shared-process` neste run e **com** no anterior, para um
                 processo que sempre existe. Somado ao zero de memória
                 intermitente de `34051073811`, são dois sinais de que linhas
                 estavam sendo perdidas — o que a leitura de fonte seguinte
                 explicou e a correção do parser endereça.

### primeiro artefato do dia com o par autorizado dentro — 2026-09-06

data:            2026-09-06
run id:          `34056404723`
artefato:        `unigma-linux-x64-34056404723`, 212 MB, expira 2026-12-05

```
commit=b094b7c9192084e151e759d6afc3f0ae14f1c6b8
target=linux-x64
build-host=WIREDNEOMKII
build-environment=Ubuntu WSL2
smoke=passed
runtime-tests=passed
```

prova:           o pacote passou a sequência do workflow e os três smokes de
                 OpenCode rodaram **sobre ele**, incluindo o do provider:
                 `answer=answered`, `smoke=pass`, contra `1.18.23`.

não prova:       **não é release.** `AC-012` (autoria, direitos e não-colisão
                 dos ativos de marca) segue bloqueado, `T-002` espera o artefato
                 de component governance, `T-004` espera decisão de titularidade
                 e `AC-007` segue parcial. O pacote também **não** contém os
                 cinco temas nem a correção do parser, que entraram depois em
                 `b7ce8b3f` e `b717471e`.

aviso:           existe um `../VSCode-linux-x64` na máquina de desenvolvimento,
                 do commit `a159d768`, **sem OpenCode embutido** e com timestamp
                 zerado. É sobra de build antigo e não deve ser usado como
                 referência de nada.

### run interrompida por rede — 2026-09-06

run id:          `34055898816`
resultado:       falha no passo `install dependencies in WSL`, antes de
                 qualquer código deste dia executar
causa:           `AggregateError [ETIMEDOUT]` em
                 `GET https://electronjs.org/headers/v42.8.1/node-v42.8.1-headers.tar.gz`,
                 depois de cinco tentativas do próprio passo. Rede do runner,
                 não o produto e não a mudança. Registrada para que a falha não
                 seja lida depois como regressão.

### o recorte agentivo puro passa no runner, e o remoto ganha causa — 2026-09-07

data:            2026-09-07
tarefa/gate:     T-054 / T-055 (recorte puro); AC-007 **continua parcial**
run id:          `34078327932`
workflow:        `unigma-linux-wsl-validation.yml`, `workflow_dispatch --ref remote-runtime`
commit/head:     `30b3c547`
plataforma:      linux-x64 (Ubuntu WSL2 no runner Windows `WIREDNEOMKII`)
node/npm:        v24.18.0 / npm 11.x
passos:
  1 npm ci                          ok
  2 compile-extension               ok
  3 runtime test                    ok
  4 contrato RPC serializado        ok
  5 gulp vscode-linux-x64           ok
  6 testes common do workbench      **não executou** (ver abaixo)
  7 audit-distribution              ok
  8 smokes OpenCode + smoketest     ok

números do log:  suíte do runtime 172 passando e 1 pendente; `unigma-remote-ssh`
                 98/98; harnesses de `build/unigma` 97/97; contrato RPC
                 serializado 7/7; smoke desktop 40 passando e 52 pendentes.

por que este workflow e não o focado:
                 `unigma-agent-runtime-validation.yml` existe só em
                 `remote-runtime`, e o GitHub só despacha `workflow_dispatch` de
                 arquivo presente na branch default — o 404 registrado em T-054
                 é real e continua. Levar o arquivo para `main` esbarrou em
                 restrição de permissão da sessão; ficou aberto o PR
                 [#15](https://github.com/dashwr/unigma/pull/15) com esse único
                 arquivo. O job Linux já estava em `main`, é despachável e cobre
                 o mesmo conjunto; `30b3c547` acrescentou a ele
                 `build/unigma/agent-rpc.contract.ts`, que o glob
                 `build/unigma/*.test.ts` nunca alcançou por não terminar em
                 `.test.ts`, de modo que o envelope entre workbench e runtime só
                 tinha prova local.

prova:           no runner, e sobre o pacote que o próprio job construiu: o
                 envelope RPC v2, a resolução da pasta SSH restrita ao host
                 correto, o contexto do editor anexado como `FilePartInput`, o
                 contexto-base de `sessionContext.ts`, a distinção entre
                 streaming e ociosidade e o `cancel` que preserva a sessão —
                 tudo pela suíte do runtime e pelo contrato RPC serializado,
                 este último rodando no runner pela primeira vez.

o check verde que não provava nada:
                 o passo `run workbench agent unit tests in WSL` reportou
                 sucesso e **não executou teste algum**. Ele usava `--build`,
                 que aponta o harness para `out-build`; a task de empacotamento
                 segue o caminho esbuild (`useEsbuildTranspile` em
                 `build/gulpfile.vscode.ts`), que empacota em `out-vscode` e
                 nunca popula `out-build/vs`. O harness falhou ao importar
                 `out-build/vs/base/common/errors.js`, nunca chegou a
                 `runner.run`, e o processo terminou com status 0. O comentário
                 do próprio passo afirmava que a suíte do `unigmaAgent` "roda
                 aqui"; ela continuava sem rodar em lugar algum. Corrigido em
                 duas frentes: `test/unit/node/index.js` passa a sair com
                 status 1 quando não consegue carregar a árvore, e o passo passa
                 a usar `npm run transpile-client` com `out`. **Portanto o
                 reducer de streaming movido em `acd6d274` ainda não tem prova
                 de runner**, apesar de o movimento estar certo — a suíte de
                 browser onde ele morava não é executada por workflow algum e
                 estava vermelha em silêncio, com asserção de estados sem
                 `running`.

não prova:       **nada de sessão de agente em host remoto.** Não houve staging,
                 não houve VPS e não existe smoke que inicie uma sessão no
                 extension host remoto. `AC-007` continua parcial. Também não é
                 release, e não altera `AC-012`, `T-002` ou `T-004`.

achado do dia, sem run que o exercite:
                 o recorte agentivo remoto não podia funcionar. O artefato do
                 servidor **não empacota o OpenCode** — `build/gulpfile.reh.ts`
                 não tem equivalente de `getOpenCodeBundle`, que em
                 `build/gulpfile.vscode.ts` escreve `opencode/bin/opencode` no
                 pacote desktop. O payload de staging entrega o binário como
                 `bin/opencode` dentro do diretório de staging, que `mv -T`
                 ativa como o diretório de versão, e esse diretório é o `appRoot`
                 do extension host remoto
                 (`src/vs/server/node/remoteAgentEnvironmentImpl.ts:114`). O
                 resolver do runtime só procurava `<appRoot>/opencode/bin/opencode`
                 e caía para o `PATH`, onde o extension host remoto recebe
                 apenas `<appRoot>/bin/remote-cli`. Corrigido em `18644365`, com
                 seis testes contra um filesystem falso. **É condição
                 necessária, não prova:** só um smoke contra host real fecha
                 isso, e ele não existe.

### o passo de teste passou a executar, e derrubou o smoke — 2026-09-07

data:            2026-09-07
tarefa/gate:     T-054 (cobertura de teste); nenhum aceite se move
run id:          `34079783571`
workflow:        `unigma-linux-wsl-validation.yml`, `--ref remote-runtime`
commit/head:     `9caeaf0b`
plataforma:      linux-x64 (Ubuntu WSL2)
resultado:       **falha**, no passo `run Linux desktop smoke test in WSL`

o que provou:    a suíte do runtime foi de **172 para 178 passando**, com 1
                 pendente: os seis testes de layout de OpenCode de `18644365`
                 rodaram no runner. E o passo `run workbench agent unit tests`
                 executou de verdade pela primeira vez — **47 passando** —,
                 incluindo os quatro testes de reducer movidos em `acd6d274`.
                 O passo que antes durava 2 s passou a durar 10 s.

o que quebrou:   o smoke desktop caiu de 40 passando e 0 falhando para 34
                 passando e **6 falhando**, todos em áreas upstream —
                 `languages`, `statusbar` e `scm` —, com timeout de elemento.

causa, e é do próprio passo novo:
                 `ensureCompiled` em `build/lib/preLaunch.ts` roda
                 `npm run compile` **somente quando `out` não existe**, e o
                 smoke desktop roda a partir das fontes. Ao transpilar `out`
                 antes, o passo fez o smoke pular o compile completo e rodar
                 contra uma árvore só transpilada. Nada a ver com o produto: é
                 acoplamento entre passos por um diretório compartilhado.

correção:        `2d4d4e35`. O passo remove `out` ao terminar, sob guarda de que
                 o caminho é o diretório de build e tem `package.json`, e a
                 suíte de browser deixa de mandar `scripts/test.sh` reapagar
                 `.build/electron`.

não prova:       nada de sessão de agente remota. `AC-007` continua parcial.

### a cobertura de teste do unigmaAgent passa a existir de verdade — 2026-09-07

data:            2026-09-07
tarefa/gate:     T-054 / T-055 (recorte puro e cobertura); `AC-007` **não se move**
run id:          `34081018988`
workflow:        `unigma-linux-wsl-validation.yml`, `--ref remote-runtime`
commit/head:     `ca5dd98b`
plataforma:      linux-x64 (Ubuntu WSL2 no runner `WIREDNEOMKII`)
node/npm:        v24.18.0 / npm 11.x
resultado:       **sucesso**, 19 minutos

números do log:
  suíte do runtime                172 passando, 1 pendente
  `unigma-remote-ssh`             98/98
  harnesses de `build/unigma`     98/98
  contrato RPC serializado        7/7
  workbench `test/common`         47 passando
  workbench `test/browser`        13 passando, em Electron sob Xvfb
  smoke desktop                   40 passando, 52 pendentes, 0 falhando

  A suíte do runtime aparece como **178 passando** neste run: 172 do estado
  anterior mais os seis testes de layout de OpenCode de `18644365`.

prova:           as três suítes do `unigmaAgent` executam em CI pela primeira
                 vez, e cada uma tem nome de teste no log — não apenas um passo
                 verde. `test/common` cobre o reducer de streaming movido em
                 `acd6d274`; `test/browser` cobre a contribuição, o bridge
                 serializável e o `Cancel` sob `stopSession` pendente, em
                 Electron. O smoke desktop voltou a 40 passando e 0 falhando,
                 confirmando que a remoção de `out` ao fim do passo desfez a
                 regressão de `34079783571`.

não prova:       nada de sessão de agente em host remoto. Não houve staging, não
                 houve VPS, e a sonda de layout de OpenCode acrescentada em
                 `d2a366f2` **não foi executada contra host algum** — ver
                 `2026-09-06-remote-runtime-handoff.md` para a razão.
                 `AC-007` continua parcial. Não é release.

### qual definição de workflow um dispatch por ref usa — 2026-09-07

data:            2026-09-07
tarefa/gate:     nenhuma; é medição de infraestrutura de CI
run id:          `34082375469`
workflow:        `unigma-windows-ssh-capabilities.yml`, `--ref remote-runtime`
resultado:       sucesso

pergunta:        um `workflow_dispatch` com `--ref <branch>` usa a definição do
                 ref ou a da branch default? Isso decide se um modo
                 somente-leitura que existe apenas numa branch de trabalho pode
                 ser selecionado, ou se os inputs chegam vazios e o job sem
                 guarda da branch default é o que roda.

método:          um input `probe_input_resolution` foi acrescentado **somente em
                 `remote-runtime`**, mais um passo que imprime de qual definição
                 veio. O workflow escolhido não conecta a host algum, não lê
                 chave e era idêntico nas duas branches, então o experimento não
                 podia causar efeito nenhum.

resposta:        **a definição do ref governa, nas duas pontas.** O dispatch com
                 o input foi aceito — se a validação usasse a branch default, a
                 API teria recusado um input não declarado — e o job imprimiu
                 `definition=feature-branch` e
                 `probe_input_resolution=ref-governs`. A branch default só
                 precisa ter o arquivo para o workflow aparecer como despachável.

consequência:    as guardas `reconnect_only`/`native_modules_only` de
                 `unigma-remote-window-smoke.yml` em `remote-runtime` valem num
                 dispatch por CLI, e o caminho somente-leitura pode ser
                 selecionado sem risco de cair no job que provisiona e limpa a
                 VPS. Continua valendo o alerta para quem usa a **UI** na branch
                 default, onde só o input `alias` existe.

andaime:         revertido no commit seguinte; nada deste experimento fica no
                 workflow.

### as guardas do par staged, provadas no runner — 2026-09-07

data:            2026-09-07
tarefa/gate:     T-054; `AC-007` **não se move**
run id:          `34082974153`
workflow:        `unigma-linux-wsl-validation.yml`, `--ref remote-runtime`
commit/head:     `9016876d`
plataforma:      linux-x64 (Ubuntu WSL2)
resultado:       **sucesso**

números do log:
  suíte do runtime                181 passando, 1 pendente
  `unigma-remote-ssh`             99/99
  harnesses de `build/unigma`     98/98
  contrato RPC serializado        7/7
  workbench `test/common`         47 passando
  workbench `test/browser`        13 passando, em Electron sob Xvfb
  smoke desktop                   40 passando, 52 pendentes, 0 falhando

prova:           as duas guardas do par entram em CI. O script de staging passa a
                 recusar, com categoria `opencode-not-executable`, um par cujo
                 OpenCode perdeu o bit de execução — antes ele exigia isso do
                 `unigma-server` e nada do `opencode`, e a falha só aparecia
                 depois, no host. E a resolução dos dois layouts deixa de estar
                 provada apenas contra um filesystem falso: três testes passam
                 por `ChildProcessManager` com diretórios reais, incluindo o
                 binário sem bit de execução, que tem de ser recusado em vez de
                 cair para o `PATH`. Daí 181 contra 178 no run anterior, e 99
                 contra 98 em `unigma-remote-ssh`.

não prova:       continua sem sessão de agente em host remoto, sem staging e sem
                 VPS. `AC-007` permanece parcial.

