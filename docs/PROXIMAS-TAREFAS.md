# próximas tarefas — unigma

Atualizado em 2026-09-05. Fila operacional para execução assistida por modelos;
não substitui os contratos T/AC do [backlog](BACKLOG.md). A reconciliação dos
documentos e nomes do Trello foi verificada em 2026-09-05. Esta é a ordem vigente;
contratos assinalados como pendentes continuam impedindo implementação por
inferência. Pesquisa documental não é prova de suporte de produto.

## protocolo de execução

- Ler `AGENTS.md`, este arquivo e somente os contratos/fontes do recorte escolhido.
- Estados: `[PENDENTE]`, `[BLOQUEADO]`, `[EM REVISÃO]`, `[FEITO]`. Um recorte
  entregue não fecha toda a T nem seu AC. Não refazer entregas históricas provadas.
- Modelo de planejamento define entradas, saída, fronteiras, dependências e
  prova; executor, inclusive GPT 5.6 Luna, implementa o recorte, não inventa a
  arquitetura. Dúvida material ou contrato insuficiente: parar e perguntar.
- Antes de editar: verificar estado Git e arquivos existentes. Não instalar,
  acessar provider, escrever no host remoto, fazer commit/push ou disparar ação
  sensível sem autorização correspondente. Builds/smokes somente no runner.
- Ao entregar: registrar arquivos, commit do artefato, comando/workflow, run,
  cenário, resultado e o que não foi provado no backlog/evidência; atualizar
  WORKBENCH; marcar `[FEITO]` aqui e somente a entrega correspondente no Trello.
  Se Trello falhar, registrar sincronização pendente sem declarar reconciliação.
- Para documentação, registrar revisão de links, consistência e diff. Isso não
  substitui runner de comportamento nem autoriza marcar entregas de produto.

## ordem e portas de saída

| Onda | Recortes | Porta de saída |
| --- | --- | --- |
| 0 | DOC-ROADMAP-001 e decisões de contratos | documentos consistentes; itens Trello mapeados; nenhum detalhe aberto entregue à implementação como se decidido |
| 1 | T-053; diagnóstico T-071 em lane independente | matriz SSH com limites explícitos; baseline somente se houver processo vivo |
| 2 | T-024/T-031–034/T-060–061 e T-054–055 | fluxo local e remoto real, permissões, streaming e recuperação; provider autorizado |
| 3 | D-038/039/040 → contratos de contexto, worktree, todo/perguntas/subagentes | contrato do artefato comprovado e desenho aprovado antes de runtime/UI |
| 4 | capacidades T-040–042, T-056–057 e E08 | dependências e decisões específicas satisfeitas; não bloquear Linux por inferência Windows |
| contínua | E00 legal, E07 qualidade/payload; E09 opcional | evidência de distribuição, sem confundir bundle comum com service-only aceito |

Esta ordem não autoriza execução externa. T-054/055 e a parte de sessão agentiva
da matriz devem ser coordenadas: não exigir AC-007 completo como pré-requisito
da implementação necessária para demonstrá-lo. Abertura/transporte comprovados
permitem detalhar a integração; aceite completo vem depois do fluxo integrado.

## [EM REVISÃO] DOC-ROADMAP-001 — consolidar documentação e board

**O quê:** fechar comparação oficial, contratos de direção, cobertura E00–E09,
fila operacional e correspondência de cada entrega aberta com o Trello.
**Como:** pesquisa em `planos/2026-09-05-referencias-oficiais.md`; decisões humanas
D-038–040; corrigir status atuais sem reescrever fontes brutas ou história datada.
Ler todos os cartões antes de mudar checkboxes; nomes concisos no board, detalhe
local. **Parar:** evidência ausente, status ambíguo ou mudança de escopo não aprovada.
**Prova:** diff sem erros, links locais válidos, mapa de cobertura e releitura dos
itens alterados no Trello. **Não objetivo:** implementar features ou fechar AC.

**Verificado em 2026-09-05:** revisão independente de links/consistência, correção
dos quatro conflitos encontrados e `git diff --check` sem erros. E01/E05/E06/E07/
E08/E09/TD2 relidos após sincronização; nenhum checkbox foi alterado nesta revisão.
AC-013 já estava marcado historicamente e continua limitado ao núcleo. DOC-* fica
`[EM REVISÃO]` no board: a regra atual não permite marcar entrega com revisão de
diff local. Os três contratos novos permanecem `[PENDENTE]`. Não confundir essa
restrição do board com ausência dos documentos entregues.

## [FEITO] T-053 — queda e reconexão na mesma janela remota

**Entregue em 2026-09-06, run `34011376887`, commit `ed8b224c`:** abertura, queda
injetada apenas no processo SSH do próprio teste e reconexão das conexões de
gerenciamento e de extension host, com o mesmo desktop vivo. Registrado em
`status/EVIDENCE.md`. **Não fecha AC-007:** sessão de agente e matriz de módulos
nativos continuam fora, conforme os `info` do relatório. O restante do recorte
segue abaixo.

## [FEITO] T-053 — matriz de módulos nativos no host remoto

**Entregue em 2026-09-06, run `34013237745`:** o probe que só existia dentro do
smoke de staging virou módulo próprio (`build/unigma/remote-native-probe.ts`) e
ganhou um smoke somente-leitura (`smoke-remote-native-modules.ts`), exposto como
modo `native_modules_only` do workflow da janela. Contra a versão `493dcfe7` já
ativada: 8 addons verificados, 7 carregados, 0 rejeitados, `@vscode/spdlog`
carregado; nada foi escrito no host. **Não fecha AC-007** e não substitui a
auditoria do payload montado. **Armadilha registrada:** pedir o modo
somente-leitura com `reconnect_only=false` selecionava o job legado, que provisiona
e sempre limpa o host; as duas guardas agora são explícitas.

## [PENDENTE] T-053 — completar transporte e matriz da janela real

**Bloqueio observado no runner:** `34008859142`, branch `test/t053-owned-reconnect`,
commit `cf6cb5b6`: modo sem provisionamento publicado e disparado; gate recusou
desktop `6e973c67` versus servidor `493dcfe7` antes de conectar. Selecionar par
existente explicitamente ou pedir autorização de preparo; não relaxar igualdade.
Sem prova de queda/reconexão e sem alteração de aceite.

**Estado após `34010310240` e `34010391641`:** seleção explícita de par funciona,
o proxy de queda respeita o probe restrito e o transporte alcança o host. O
servidor daquele commit não está preparado (`missing-version`), então o recorte
está bloqueado por **staging autorizado**, não por defeito conhecido do cliente.

**Entrada:** BACKLOG T-053, SSH-CONTRACT, EVIDENCE; primeira abertura já provada
no run `33949936848`. **O quê:** completar queda e reconexão na mesma janela;
registrar separadamente a sessão de agente, que depende da integração T-054/055.
**Como:** usar `unigma-remote-window-smoke.yml` e par cliente/servidor do mesmo
commit no depósito WSL; verificar provenance do artefato separada do ref do
workflow. Confirmar módulos nativos carregados e rejeitados antes do cenário.
**Correção após inspeção do workflow:** `unigma-remote-window-smoke.yml` atualmente
executa staging, `npm ci` no runner e cleanup remoto incondicional. Não disparar
com autorização limitada a conexão/queda; primeiro separar o modo sem staging e
cleanup e revisar seus efeitos. O script atual só prova abertura, sem injeção de
queda/reconexão. **Armadilhas:** `/version` não prova addons; mock que
devolve commit injetado não prova payload; `TemporarilyNotAvailable` em teste
unitário não prova reconexão. **Parar:** par divergente, alias ausente, falta de
autorização ou necessidade de alteração privilegiada. **Prova:** run real com
abertura → queda → recuperação, sem confundir reabertura manual com reconexão;
registrar limitações. **Trello:** E05; AC-007 permanece item próprio.

## [PENDENTE] T-071 — diagnosticar baseline sem inventar números

**Comparação de flags feita em 2026-09-06** (leitura de código, sem runner),
conforme o passo pedido. `smoke-remote-window.ts` é o lançamento que sabidamente
chega a uma janela sob o mesmo Xvfb; `measure-baseline.ts` é o que não chegou no
run `33950524239`. As diferenças materiais:

| aspecto | smoke que abre janela | harness de baseline |
| --- | --- | --- |
| sinal de prontidão | lê os **logs do produto** (`--log=trace` + `--logsPath`) e espera resolver e handshake | invoca o executável **de novo** com `--status` e procura `Process Info` |
| workspace | sempre `--folder-uri` | `clean-profile` sem pasta; `idle-folder` com pasta posicional |
| workspace trust | **semeia** o estado em `sharedStorage/state.vscdb` e checa `workspace-trust-seeded` | não semeia nada |
| `--shared-data-dir` | passa explicitamente | não passa |
| janela | sem `--new-window` | `--new-window` |
| diagnóstico na falha | os logs do produto | stdout/stderr, que naquele run vieram vazios |

Duas hipóteses saíram daí — modal de trust segurando o startup, e `--status` não
sendo confiável sob Xvfb. **As duas estavam erradas**, e o log do run
`34036136102` mostrou por quê: `--status` respondeu `exit=0` **com a tabela de
processos completa** (`unigma`, `zygote`, `window [1] (unigma)`,
`utility-network-service`, `shared-process`, `file-watcher [1]`,
`extension-host [1]`). A janela abriu. Quem não reconheceu foi o harness.

**Causa raiz, com trilha de código.** `STATUS_READY` era `/Process Info/`, e o
produto **nunca imprime essa string**: ela existe apenas como comentário em
`src/vs/code/electron-main/main.ts:435`. O cabeçalho real é
`CPU %\tMem MB\t   PID\tProcess`, de
`DiagnosticsService.formatProcessList`. O harness procurava um comentário do
fonte, então **não podia ter sucesso em nenhum run, nunca** — e o que ele
reportava como “o produto não respondeu” era o produto respondendo.

**Dois defeitos irmãos, achados na mesma leitura:**

1. **Os nomes de papel também eram do módulo, não da saída.** `main`,
   `extensionHost` e `ptyHost` não aparecem em lugar nenhum de `--status`; o
   processo principal é a linha com o `applicationName` do `product.json`, e o
   extension host chama-se `extension-host [1]`. Pior, o mapa antigo casava
   extension host e shared process no mesmo papel — exatamente a fusão silenciosa
   que o comentário dele dizia impedir.
2. **A coluna de memória não é megabyte.** `src/vs/base/node/ps.ts:29` já
   converte o percentual do `ps` em bytes (`totalMemory * (mem / 100)`), e
   `diagnosticsService.ts:554` aplica **a mesma conversão de novo** antes de
   dividir por um megabyte. O valor é escalado por `totalmem()/100` duas vezes.
   Publicar isso como baseline seria inventar número, que é o que este harness
   existe para recusar.

**Correções aplicadas em 2026-09-06:** o cabeçalho real como sinal de prontidão;
papéis renomeados para os nomes que o produto imprime, com `shared-process` e
`file-watcher` separados e o processo principal resolvido pelo `applicationName`
do pacote; e a memória **não publicada**, com o motivo e a trilha de arquivos no
próprio relatório. `ready-ms`, presença e CPU continuam. Quatro testes novos
usam a tabela real do run `34036136102` — o harness anterior não passaria em
nenhum deles. Local: `node --test` 11/11, `test-build-scripts` 343/343, eslint
limpo.

**Run `34043447622` (commit `9dc0f1b7`), verde em 16m11s: o primeiro relatório
saiu.** `clean-profile` `ready-ms.median=3156` (spread 2011) e `idle-folder`
`ready-ms.median=3118` (spread 1241), três repetições cada. **E ele mostrou o
defeito seguinte:** as duas execuções reportaram `renderer.present=no`, e
`idle-folder` também `extension-host` e `shared-process` ausentes. O harness
devolvia assim que qualquer linha da tabela aparecia — mediu o instante em que o
processo principal começa a responder, **antes de a janela existir**. Esses
números não são baseline de inicialização e não devem ser publicados como tal.

**Corrigido na sequência:** a prontidão exige a linha `renderer`; o timeout
nomeia os papéis já vistos, para separar “nada respondeu” de “parou no shared
process”; e `ready-definition` entra no relatório para o número não ser lido
como outro evento. Dois testes novos cobrem os dois casos (13/13 local,
`test-build-scripts` 345/345, eslint limpo). **Falta o run** que produza o
primeiro `ready-ms` medido até a janela.

**Lote adicional preparado antes desse run**, para não gastar dois ciclos:

1. **Memória corrigida no produto.** `ProcessItem.mem` já é bytes em toda
   plataforma — `listProcesses` converte o percentual do `ps` e o Windows já
   reporta bytes — e `formatProcessItem` aplicava a mesma conversão de novo.
   `processExplorerControl.ts:274` sempre leu o campo corretamente, o que
   confirma qual dos dois consumidores estava errado. Corrigido em
   `diagnosticsService.ts`.
2. **A memória volta ao relatório atrás de uma guarda.** O harness não sabe
   distinguir um megabyte certo de um errado olhando para ele, mas sabe que os
   processos do produto não podem somar mais do que a máquina tem. Somando
   mais, o número é recusado com o observado. Publicar figura impossível é pior
   que não publicar.
3. **Papel `other`.** `zygote` e `utility-network-service` não tinham papel e
   sumiam de qualquer total; agora aparecem.
4. **Resolução de `ready-ms`.** O intervalo de sondagem era 500 ms e o spread
   observado 2011 ms — um quinto do spread era o próprio instrumento. Passou a
   250 ms, e o valor entra no relatório como `ready-resolution-ms`.

Verificação local: `node --test` 14/14, `test-build-scripts` 346/346, eslint
limpo em `diagnosticsService.ts` e nos dois arquivos do harness.

**Instrumentação aplicada antes disso, e foi ela que entregou a causa:** o
lançamento passou a usar `--log=trace` como o smoke, e as duas mensagens de
falha passaram a citar a cauda dos logs do produto. A mensagem de timeout já
citava a saída do `--status`, e foi lendo a tabela dentro dela que o defeito
apareceu.



**Entrada:** run `33950524239`, BACKLOG T-070/071, workflow Linux e harness de
baseline em `build/unigma/`. **O quê:** produzir medição somente com desktop vivo.
**Como:** comparar lançamento Xvfb com o smoke funcional; instrumentar readiness,
saída e ciclo de vida no menor alvo. `--status` com Version/OS/CPUs e sem
`Process Info` não é baseline. **Parar:** correção exigir desligar segurança do
produto ou ampliar máquina/matriz sem decisão. **Prova:** processo identificado,
cenário, ambiente e amostras reproduzíveis; publicação válida continua independente
da medição. **Não objetivo:** otimizar sem baseline ou supor causa sandbox/GPU.

## [BLOQUEADO] T-024/T-031–034 — validar agente local integrado

**Dependência:** provider/modelo autorizado e contratos T-010–012/T-020–023.
**O quê:** exercitar envio, streaming, diff, permissão, cancelamento e reconexão.
**Como:** UI em `src/vs/workbench/contrib/unigmaAgent/`, RPC privado e runtime em
`extensions/unigma-agent-runtime/`; usar o binário fixado, não documentação dev
como prova. Reconsultar HTTP após SSE cair; não reenviar prompt automaticamente.
Revalidar trust imediatamente antes de executar, inclusive prompt enfileirado.
**Parar:** credencial necessária no chat, falta de autorização de custo, resposta
incompatível ou necessidade de segundo harness. **Prova:** cenário real em runner
com eventos/recovery, recusa e cancelamento; evidência sanitizada sem conteúdo de
prompt ou segredo. **Não objetivo:** declarar UI inteira pronta com testes puros.

## [BLOQUEADO] T-054/055 — agente no extension host remoto

**Dependência:** transporte/abertura T-053 provados e contratos de runtime local;
autorização do host e provider. **O quê:** executar o único OpenCode do extension
host no host correto e projetar sessão no cliente. **Como:** preservar Code Server,
RPC e escopo de workspace; validar que filesystem/processo são remotos e HTTP é
loopback daquele host. **Parar:** duplicação de runtime por sessão, listener
público, segredo no cliente ou divergência de commit. **Prova:** sessão real,
permissão, interrupção/recuperação e isolamento de autoridade no runner; então
completar o recorte agentivo de AC-007. Não instalar silenciosamente no host.

## [EM REVISÃO] DOC-CONTEXT-001 — contrato D-038 de contexto explícito

**Contrato escrito em 2026-09-06:** [`CONTEXT-CONTRACT.md`](CONTEXT-CONTRACT.md),
ancorado no `/doc` do artefato fixado `1.18.23` (probe registrado em
OPENCODE-COMPATIBILITY). Define anexo transitório, mapeamento para
`FilePartInput`/`FileSource`/`SymbolSource`/`ResourceSource`, materialização no
boundary, catorze cenários de falha e a decomposição C-1…C-5. `@` permanece
agente. **Limites aprovados em 2026-09-06 por `D-041`** (1 MiB por anexo, 4 MiB
por envio, 32 anexos), o que destrava a etapa C-3. **Falta:** revisão do
planejador. `[EM REVISÃO]` e não `[FEITO]`: a regra do board não fecha entrega
com revisão de diff local.

**O quê:** especificar antes de implementar o anexo transitório de arquivo,
seleção de buffer e documento, com origem, URI, versão e limites de tamanho.
**Como:** partir de `SendInput` textual em T-010 e do contrato do artefato em
OPENCODE-COMPATIBILITY. Separar resolução/materialização no boundary e renderização
na UI. Definir comportamento de buffer sujo, mudança durante envio, URI remota,
symlink fora do workspace, cancelamento e erro. Busca é sob demanda via OpenCode.
**Parar:** endpoint sem prova, sintaxe `@` conflitando com ferramentas, necessidade
de persistir índice/conteúdo ou orçamento não definido. **Prova do contrato:**
casos positivos/negativos e plano de teste versionados, revisão do planejador;
depois dividir em RPC → runtime → UI → integração. Não criar essas camadas de
implementação antes de decidir os parâmetros pendentes.

## [EM REVISÃO] DOC-WORKTREE-001 — contrato D-039 de worktree revisável

**Contrato escrito em 2026-09-06:** [`WORKTREE-CONTRACT.md`](WORKTREE-CONTRACT.md).
Base explícita, dirty/untracked sem cópia nem stash, escopo e localização,
revisão antes de integrar, retenção sem limpeza automática e quinze cenários de
falha. O probe achou `/experimental/worktree` no binário fixado; o contrato o
recusa com motivo (sem base explícita, `startCommand` na criação) em vez de
alegar ausência de API. **Integração decidida em 2026-09-06 por `D-042`:**
`git merge --no-ff` do branch da tarefa, sempre confirmado; cherry-pick recusado
porque produziria no principal um estado nunca testado. Destrava a etapa W-2.
**Falta:** revisão do planejador.

**O quê:** definir tarefa isolada e revisão anterior à integração no principal.
**Como:** Git/OpenCode como fontes de verdade; especificar base e política para
dirty/untracked, escopo de diretório por sessão, diff, conflitos e ciclo de vida.
Checkout de HEAD não contém automaticamente trabalho não commitado. Definir
operação de integração e confirmação, sem assumir merge/cherry-pick automáticos.
**Parar:** escritor compartilhado, branch ocupada, base alterada, buffer sujo,
isolamento não comprovado ou necessidade de limpar dados sem autorização.
**Prova do contrato:** cenários de duas tarefas, mudanças externas, falha parcial,
cancelamento e retomada; aprovação antes de implementação. Undo compartilhado
não faz parte da garantia. Worktree não oferece sandbox de comandos.

## [EM REVISÃO] DOC-PROJECTIONS-001 — contrato D-040 de projeções do harness

**Contrato escrito em 2026-09-06:** [`PROJECTIONS-CONTRACT.md`](PROJECTIONS-CONTRACT.md).
Todo somente leitura com substituição integral, perguntas separadas de permissões
em endpoint, corpo, evento e UI, sessões filhas de leitura antes de escritores e
recuperação HTTP reconciliando em vez de descartar. As duas famílias de pergunta
do `/doc` foram confrontadas: aceitar ambas na entrada, responder pela rota sem
`v2`. **Falta:** revisão do planejador; as provas 1–5 do aceite dependem de
provider autorizado, o que não bloqueia o contrato.

**O quê:** detalhar todo, perguntas e sessões filhas de leitura; depois escritores
isolados, sem segundo scheduler. **Como:** confirmar endpoints/eventos do binário,
definir RPC versionado e recarga HTTP após queda; pergunta não é permissão.
Dados duráveis continuam no OpenCode. **Parar:** necessidade de histórico paralelo,
eventos apenas do dev, scoping incerto ou ferramenta de escrita em tarefa declarada
read-only. **Prova:** pending/reply/reject/recovery e parent-child reais; chips de
UI não comprovam execução. Escritores dependem da prova de D-039.

## frentes preservadas — consultar detalhe T no backlog

| Frente | Trabalho restante / impedimento |
| --- | --- |
| E00 | notices, licenças, proveniência e revisão humana; não repetir a importação upstream |
| E01 | fechar matrizes e compatibilidade concreta; contrato implementado não é AC |
| E02/E03 | recortes locais acima; artefato executável e integração antes de suporte |
| E04 | catálogo/MCP/rules/skills conforme preflight; novas projeções dependem de contratos |
| E05 | matriz, agente remoto, decisão Windows T-056 e Welcome T-057 sem custódia de chave |
| E06 | trust/redação sanitizada, segurança de scripts e baseline; preservar patches existentes |
| E07 | auditar payload montado, entrypoints, símbolos e provenance; investigar CI vermelho sem supor causa |
| E08 | domínio/router já parcial; integração real depende de modelo disponível, custo/fontes e D-016; fast/deep não aprovado |
| E09 | patchset/pipeline/audit existentes não equivalem a service-only aceito; trilha opcional D-026 |

As tarefas T já existentes não ganham novos IDs por aparecer nesta fila. Os três
DOC-* acima são contratos a detalhar, não tickets de implementação liberados;
T-100–107 já foram usados em plano histórico e não devem ser reciclados.

## checklist de cobertura — todo item aberto do board

Cada linha abaixo é um recorte independente `[PENDENTE]`, salvo bloqueio indicado.
O **como/prova** complementa a tarefa canônica no BACKLOG; leia ambos. Não iniciar
grupos inteiros de uma vez. ACs são revisões próprias, nunca efeito colateral de T.

| Estado / ID / board | O quê e como no menor alvo | Parar / prova exigida |
| --- | --- | --- |
| [BLOQUEADO] T-002 / E00, TD1 | Classificar 695 manifest-only root no inventário; obter artefato CG para regenerar notice; revisar `remote/LICENSE` por proveniência | Sem CG/direito confirmado, preservar avisos; auditor do pacote + revisão legal |
| [BLOQUEADO] T-004 / E00 | Responsável decide titularidade/notices com THIRD-PARTY-REVIEW e BRANDING-CLEARANCE | Executor não decide licença; registro humano e artefato auditado |
| [PENDENTE] T-010 / E01 | Completar browser/E2E da bridge usando runner existente; common já tem run33948717879 | Não recontar common como browser; cenário de RPC serializável real |
| [BLOQUEADO] T-011 / E01 | Definir provider/modelo autorizado e validar contrato do binário fixado; perfil service-only separado D-026 | Sem autorização de custo/configuração, não enviar prompt; `/doc` e cenário real |
| [BLOQUEADO] T-012 / E01 | Exercitar inventário/preflight com OpenCode real, origens permitidas/recusadas | Não instalar plugin/MCP implicitamente; refusas e execução autorizada no runner |
| [PENDENTE] T-022/T-032 / E02,E03 | Testar chunks/IDs, queda e recuperação sem duplicação, preservando retry limitado | Não presumir replay ou reenviar prompt; integração comparando transcript antes/depois |
| [PENDENTE] T-040 dívida / E02 | Conectar recarga HTTP ao estado: hoje sessão/mensagem/diff são buscados e descartados; adaptar cliente→runtime→RPC→reducer existente | Sem schema/scoping, parar; teste de lacuna SSE, estado canônico e idempotência |
| [PENDENTE] T-034 temas / E03 | Rodar auditor de contraste no pacote e pedir revisão visual humana Dark/Light/HC | Captura de mock não basta; pacote, teclado/foco e avaliação humana |
| [BLOQUEADO] T-034 idioma / E03 | Definir origem autorizada do pacote pt-BR, testar inglês padrão e ativação do pacote | Não habilitar Marketplace Microsoft; prova Windows/Linux do mecanismo aprovado |
| [BLOQUEADO] T-040 / E04 | Completar criar/retomar/abortar e recuperar sessão no harness, após correção de recarga | Sem provider/contrato, não anunciar suporte; ciclo integrado e falhas |
| [BLOQUEADO] T-041 / E04 | Implementar recortes somente após DOC-WORKTREE/PROJECTIONS; primeiro filho read-only | Worktree não sandbox; parent-child e scoping reais antes de escritores |
| [BLOQUEADO] T-042 / E04 | Integrar seleção dos providers/modelos autorizados descobertos pelo OpenCode | Não inventar disponibilidade/fallback; execução real e recusa de modelo inválido |
| [BLOQUEADO] T-043 / E04 | Provar fontes de referências do catálogo `@`/`/`, preservar contrato e distinguir anexos D-038 | Colisão de sintaxe exige pergunta; resolução e erros via RPC/runtime no runner |
| [BLOQUEADO] T-044 / E04 | Projeção de mensagens intersessão/chips a partir de eventos confirmados | Não inferir thinking de animação; parent-child, ciclo e acessibilidade integrados |
| [PENDENTE] T-045 / E04 | Validar protocolo já tipado no artefato final, mantendo-o dormente | Listener/conta/cloud é regressão; serialização e ausência de ativação no pacote |
| [BLOQUEADO] T-056 / E05 | Comparar alternativas de forwarding Windows previstas no BACKLOG e levar escolha ao humano | Não inferir capacidade pela sintaxe aceita; conexão real e revisão de D-034 |
| [BLOQUEADO] T-057 / E05 | Após contrato de transporte, Welcome orienta identidade SSH gerida externamente | Não gerar/ler/guardar chave; fluxo renderizado e autenticação delegada |
| [PENDENTE] dívida payload / E05,E07 | Exercitar auditor existente T-082 no payload montado, inclusive addons e entrypoints | `/version` não prova módulo; hashes, proveniência, symbols e carga real |
| [PENDENTE] dívida push / E05,TD1 | Separar smoke de conexão prepopulada de smoke que entrega o payload pelo fluxo oficial | Staging requer confirmação específica; prova push→ativação→conexão sem falso verde |
| [PENDENTE] T-060 / E06 | Cobrir trust alterado entre fila e execução, permissões e preflight integrados | D-037 não autoriza agente untrusted; testes reais de recusa sem spawn/efeito |
| [PENDENTE] T-061 / E06 | Cobrir falhas de spawn/transporte e evidência sanitizada no boundary existente | Não emitir Error.message arbitrária; fixtures sintéticas de dados sensíveis e saída redigida |
| [PENDENTE] T-062 / E06 | Revisar scripts gerados: sentinela vazia, safe_rm e pós-condição, tar sem owner/perms | Sem teste seguro/escopo, não executar como root; suíte de invariantes + runner autorizado |
| [BLOQUEADO] T-072 / E06 | Otimizar apenas gargalo medido de T-071, uma alteração por comparação | Sem baseline não otimizar; amostras equivalentes antes/depois |
| [BLOQUEADO] T-073 / E06 | Avaliar patch upstream mínimo somente para gargalo confirmado, registrar custo de rebase | Não podar Code Server/neutral services; benchmark e teste de regressão |
| [BLOQUEADO] T-074 / E06 | Comparar plataformas/cenários contra baseline versionada após T-072/073 | Sem processo vivo/amostra comparável, inválido; relatório reproduzível |
| [PENDENTE] T-080 / E07 | Mapear cada contrato alterado à suíte existente e completar casos negativos | Não segundo runner; suíte focada no runner com ref dos arquivos |
| [BLOQUEADO] T-081 / E07 | Integrar UI/runtime/OpenCode real após T-024; incluir permissão, diff e recovery | Fixture não fecha fluxo real; evidência por cenário/artefato |
| [PENDENTE] T-082 / E07 | Validar payload montado e investigar checks CI vermelhos por logs antes de corrigir | Não chamar CI todo verde nem remover teste; runner do mesmo artefato auditado |
| [BLOQUEADO] T-083 / E07 | Gate de MVP sobre pacote, tornar explícitas exclusões ainda não cobertas | Smoke core não fecha agente/terminal; matriz completa sem esconder falhas |
| [BLOQUEADO] T-084 / E07 | Auditoria pré-release de identidade, notices e direitos após T-002/004 | Não apagar copyright legítimo; relatório do pacote e revisão responsável |
| [BLOQUEADO] T-085 / E07 | Reconciliar AC-001–032 e limites por perfil/plataforma antes de release | AC-012 segue D-030, E09 segue D-026; nenhum AC por aproximação |
| [PENDENTE] T-086 / E08 | Reusar schema/router existentes e fechar configuração operacional com D-016 | Contrato de domínio não prova wiring; validação config→runtime |
| [BLOQUEADO] T-087 / E08 | Validar referências reais versionadas de índice/custo usando parser existente | Unidade/fonte ausente não inventa ranking; fixtures e proveniência |
| [BLOQUEADO] T-088 / E08 | Integrar chamada curta Luna medium se disponível/autorizada, saída estruturada validada | Sem endpoint oculto/segredo/contexto extra; payload mínimo e timeout no runner |
| [BLOQUEADO] T-089 / E08 | Conectar seletor puro já testado ao envio, menor custo elegível sob teto | Não escolher sempre maxModel; cenário real candidato/fallback |
| [BLOQUEADO] T-090 / E08 | Exercitar bypass/persistSelected/timeout/privacy no caminho real | Não autoescalar/retry infinito; matriz de falhas e nenhum prompt em logs |
| [BLOQUEADO] T-091 / E08 | Integrar reducer/estados existentes à UI acessível e configuração | Não inventar fast/deep; teclado, contraste, reduced motion e render real |
| [PENDENTE] T-092 / E08 | Preservar propriedades já provadas e cobrir novo wiring/schema/call | Teste puro não fecha provider; suíte existente no runner |
| [BLOQUEADO] T-093 / E08 | Medir chamada extra e modelo final com custos/latências autorizados | Estimativa não cobrança; relatório local sanitizado sem telemetria |
| [BLOQUEADO] T-094 / E08 | Revisão de suporte/privacidade após integração, separar domínio de evidência final | Lacuna mantém AC aberto; revisão de código+artefato+cenários |
| [BLOQUEADO] T-096 / E09 opcional | Reaplicar patchset versionado existente sobre base fixada e validar candidato | Sem poda ampla; base/hash/preflight/testes e auditoria de superfícies |
| [BLOQUEADO] T-097 / E09 opcional | Produzir candidato service-only real pelo workflow existente e manifesto | Bundle upstream não prova perfil; proveniência e gates do artefato |
| [BLOQUEADO] T-098 / E09 opcional | Provar troca/rollback existentes usando dois artefatos reais, processo parado | Não mutar dados do usuário; rejeição inválida e preservação comprovadas |
| [BLOQUEADO] T-099 / E09 opcional | Fechar suporte do perfil por audit HTTP/superfícies removidas no pacote | `/health` não prova TUI removida; matriz positiva/negativa e limites |
| [PENDENTE] TD1 spdlog | Investigar perda silenciosa em `spdlogLog.ts`; decidir comportamento observável sem inventar logger alternativo | Se exigir fallback novo, perguntar; teste de falha reproduzida e diagnóstico sem segredos |
| [PENDENTE] TD1 build/Azure | Reproduzir 5/7 testes incompatíveis com strip-types usando toolchain fixado e harness existente | Não instalar nem mudar major por conveniência; suíte antes/depois no runner |
| [EM REVISÃO] TD2 DOC-CURSOR-001 | Proposta escrita/revisada; D-038–040 aprovadas, demais seis sugestões não aprovadas em bloco | Distinguir pesquisa pronta de detalhes pendentes; revisão documental não fecha produto |
| [BLOQUEADO] ACs / todos E | Revisar individualmente AC-001–032 em ACCEPTANCE, evidência e perfil correspondente; preservar recortes históricos já verdes | Sem prova exigida não marcar checkbox; AC-007 parcial, AC-013 só núcleo, AC-012 ajustado por D-030 |

Duplicatas E00↔TD1, E05↔TD1 e T-040 E02↔E04 são a mesma dívida com origem
histórica preservada, não duas implementações. Ao fechar, sincronizar ambos os
itens somente se a prova cobrir exatamente os dois nomes.
