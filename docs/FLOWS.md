# unigma — fluxos

## estado deste documento

Os fluxos abaixo registram as fronteiras da arquitetura aprovada. Eles não são
contratos detalhados de interface nem comportamento implementado.

## F-001 — iniciar uma interação com OpenCode

```text
usuário no IDE
  -> superfície unigma para agente
  -> runtime interno inicia/reutiliza `opencode serve` validado no extension host
  -> integração HTTP/SSE por loopback
  -> OpenCode executa a sessão
  -> eventos/resultado retornam à superfície do IDE
```

**Base:** S-01 declara a integração de agente; S-04 confirma que OpenCode
expõe servidor com OpenAPI e SSE. A arquitetura aprovada em
[ARCHITECTURE.md](ARCHITECTURE.md) define processo supervisionado, UI nativa do
workbench e comunicação HTTP/SSE. O perfil do processo bundled está em
[OPENCODE-SERVICE-ONLY.md](OPENCODE-SERVICE-ONLY.md).

## F-002 — edição isolada e revisão de integração (D-039)

```text
usuário autoriza tarefa e efeitos conforme permissões do OpenCode
  -> resolve base e checkout isolado conforme contrato Git
  -> agente produz alteração no worktree da tarefa
  -> IDE apresenta diff do worktree, não uma escrita já aplicada no principal
  -> usuário revisa
  -> valida novamente base, buffers e conflitos do principal
  -> integração explicitamente confirmada, ou mantém tarefa sem integrar
```

**Base:** D-039 aprova essa direção; ela ainda não está implementada. Base,
dirty/untracked, mecanismo de integração e retenção precisam de contrato prévio.
Rejeitar uma integração não autoriza apagar o worktree. O diff atual do runtime
é revisão posterior a efeitos: não implica API transacional de aplicar/descartar.
Permissões precedem efeitos e não são substituídas pela revisão. Não garantir
undo compartilhado nem preservação concorrente com apenas comparação de hashes.

## F-003 — trabalho remoto por SSH

```text
usuário configura/alcança um destino SSH autorizado
  -> IDE estabelece sessão remota
  -> terminal, projeto e agente operam no destino conforme configuração
```

**Base:** S-01 declara terminal e SSH obrigatório; S-08 define Windows x64 e
Linux x64 como plataformas iniciais. A arquitetura usa OpenSSH, `known_hosts`,
o agente SSH do usuário e um extension host remoto; provisionamento e matriz de
compatibilidade continuam pendentes de especificação de implementação.

## F-004 — extensão via MCP/plugins

```text
usuário fornece configuração autorizada
  -> OpenCode, por seus mecanismos nativos, descobre ou carrega a integração
  -> integração fica disponível ao fluxo de agente
```

**Base:** S-01 declara MCP e plugins; S-04 confirma interfaces públicas do
OpenCode. A arquitetura limita o MVP a configuração local explícita, sem
catálogo próprio ou instalação silenciosa. Extensões externas de marketplace,
como Codex/Claude Code, não são carregadas nem suportadas oficialmente pelo
unigma.

## F-005 — roteamento Autopilot e Intelligence Index

**Direção aprovada:** este fluxo registra a direção do responsável e orienta uma
implementação futura; não descreve comportamento implementado nem contrato final.

```text
prompt
  -> verifica `autopilotEnabled` e `persistSelectedModel`
  -> se Autopilot estiver desligado ou `persistSelectedModel` estiver ligado:
       -> bypassa o router
       -> usa `selectedModel`
  -> caso contrário:
       -> faz chamada sem contexto adicional ao modelo roteador `Luna medium`
          (`routerModel`)
       -> estima o Intelligence Index
       -> filtra os modelos configurados até `maxModel`
       -> escolhe o modelo elegível de menor custo
  -> envia o prompt ao OpenCode
  -> stream/resposta
```

Se a chamada do router falhar ou exceder o timeout, o fluxo usa
`selectedModel`. Desligar Autopilot (`autopilotEnabled = false`) bypassa o
router; `persistSelectedModel = true` também bypassa o router. A chamada do
router não recebe contexto adicional de sessão, workspace ou histórico. Nenhuma
chamada expõe credencial, token ou segredo, e nenhum raciocínio do router é
registrado ou persistido.

**Base:** [ARCHITECTURE.md](ARCHITECTURE.md) mantém OpenCode como runtime
primário, settings/estado local como persistência e modelos configurados pelo
usuário como fonte externa; RQ-002, RQ-007, RQ-013, RQ-103 e RQ-104 delimitam a
integração, os modelos e o tratamento de credenciais.

## F-006 — construir e atualizar o bundle `unigma+opencode`

```text
commit/tag upstream fixado
  -> checkout limpo
  -> patch service-only reaplicável
  -> testes do harness + contrato OpenCode/unigma + auditoria
  -> artefato versionado com manifesto e hashes
  -> processo parado/reinício explícito
  -> troca atômica do bundle, preservando dados do usuário
```

Falha em qualquer etapa rejeita o artefato e mantém a versão corrente. O fluxo
não muta uma instalação arbitrária do OpenCode, não copia credenciais ou
histórico e não implica download automático, servidor central ou telemetria.

**Base:** [OPENCODE-SERVICE-ONLY.md](OPENCODE-SERVICE-ONLY.md), D-017 a D-020
e RQ-022 a RQ-025.

## F-007 — interação nativa entre agentes locais

```text
usuário usa `@` ou `/`
  -> unigma resolve ferramenta/skill autorizado
  -> OpenCode executa pelo harness oficial
  -> sessão pai e sessões filhas trocam mensagens locais
  -> chips exibem `thinking`, `typing` ou `idle`
```

O protocolo de controle remoto pode compartilhar tipos e contratos com esse
fluxo, mas permanece dormente: não há listener, cloud, sincronização ou
colaboração em tempo real no MVP. O OpenCode continua a fonte de verdade das
sessões e eventos.

**Base:** S-18, D-021, RQ-026 a RQ-028.

## F-010 — responder ou rejeitar uma pergunta do agente (D-047) — 2026-09-06

```text
runtime recebe `question.asked` ou `question.v2.asked`
  -> normaliza para o tipo interno (domain/projections.ts)
  -> RPC: evento `question` com as perguntas do request
  -> painel exibe a pergunta na região de atenção e desabilita a composição
  -> as opções mostradas são: as do agente, seguidas de `digitar` e `cancelar`
  -> usuário escolhe
       -> opção do agente ou texto livre
            -> comando `answerQuestion` { questionRequestId, answers: string[][] }
            -> runtime: POST /question/{requestID}/reply
       -> `cancelar`
            -> comando `rejectQuestion` { questionRequestId }
            -> runtime: POST /question/{requestID}/reject
  -> evento `questionResolved` com `replied` ou `rejected`
  -> composição volta a aceitar entrada
```

`digitar` e `cancelar` são **sempre as duas últimas opções**, nunca as posições
fixas 4 e 5: se o agente mandar seis opções, elas são a sétima e a oitava.
Posição relativa existe para que a barra de espaço não caia sobre `cancelar` por
acidente de contagem — cancelar é o único desfecho que não se desfaz de dentro
da pergunta.

Responder **nunca** concede permissão, nem quando o texto da opção sugere isso;
permissão tem comando, corpo e evento próprios. A saída mora dentro da pergunta,
e é isso que torna a composição desabilitada segura em vez de armadilha. Uma
pergunta chegada pela família `question.v2.*` é aceita na entrada e respondida
pela rota sem `v2`.

**Base:** D-047 e §3 do [contrato de projeções](PROJECTIONS-CONTRACT.md). Os
tipos, a normalização e os dois comandos existem em código (etapas `J-1` e
`J-2`); a rota HTTP no runtime (`J-3`) e o painel (`J-4`) são **contrato ainda
não implementado**.

## F-011 — recuperação depois de queda do SSE — 2026-09-06

```text
conexão /event cai
  -> reconecta /event (sem replay, sem Last-Event-ID)
  -> GET /session/status                    estado das sessões
  -> GET /session/{id}/todo                 lista inteira, substitui a projeção
  -> GET /question                          perguntas pendentes
  -> GET /session/{id}/children             árvore de filhos
  -> GET /session/{id}/message              reconcilia a transcrição
```

Regras que a reconexão não pode violar:

- **reconciliar, não descartar.** Transcrição não é limpa. Uma pergunta que
  sumiu de `/question` entre a queda e a volta foi respondida ou rejeitada por
  outro caminho: a UI a remove e registra, em vez de deixá-la clicável.
- uma pergunta que estava na tela só continua clicável se voltar em
  `GET /question` com o **mesmo `id`**.
- **nunca reenviar prompt.** O SSE cair não é o prompt ter falhado.
- nenhuma dessas respostas é persistida em disco pelo unigma; nenhuma
  autorização antiga é restaurada.

**Base:** §6 do [contrato de projeções](PROJECTIONS-CONTRACT.md), D-040, D-047.
**Contrato ainda não implementado**: a reconciliação é a etapa `J-3` e não
existe no `runtimeTransport` hoje.

## F-012 — prova do provider autorizado (D-043) — 2026-09-06

```text
credencial no ambiente (OPENROUTER_API_KEY), criada pelo responsável
  -> estado isolado estabelecido ANTES de subir o processo
  -> runtime inicia `opencode serve`; o filho herda o env (ProcessManager não sobrescreve)
  -> GET /provider  -> connected / source=env / modelo autorizado presente
  -> POST /session
  -> POST /session/{id}/prompt_async  { model: { providerID, modelID }, parts }
  -> assina /event e classifica o evento terminal
       -> session.error                      -> recusa do provider (inclui quota)
       -> session.idle com progresso anterior -> respondido
       -> session.idle sem nenhum progresso   -> recusa, não sucesso
       -> estouro de orçamento                -> timed-out
```

**Só o prompt respondido prova a credencial.** `connected` em `/provider`
aparece com **qualquer** valor na variável, inclusive um deliberadamente
inválido — um probe com chave inválida devolveu `connected: ["opencode",
"openrouter"]` e `source: "env"`. Ler `/provider` sozinho seria um check verde
que não prova nada sobre a credencial, então o relatório separa os dois fatos.

Recusa do provider é categoria de erro própria, distinta de defeito do produto:
uma quota gratuita esgotada não pode aparecer como falha de contrato. O modelo
autorizado é o id exato, sem alias e sem fallback; se ele sair do catálogo, a
resposta é uma decisão nova, não um segundo candidato no código. A credencial
não é lida para o relatório, não vai a log e não passa por `argv`.

**Base:** D-043 e `build/unigma/smoke-opencode-provider.ts`, que implementa este
fluxo. A execução no runner autolocado é a prova que fecha `AC`; execução local
não fecha.

## questões abertas por fluxo

### F-008 — contexto explícito sem índice próprio (D-038)

Usuário escolhe arquivo, seleção ou documento → boundary valida origem, URI,
versão, trust e limites → materializa somente o contexto necessário para o
contrato comprovado do OpenCode → envio → descarta estado transitório conforme
o ciclo da interação. Busca do workspace é sob demanda, não indexação própria.
Buffer alterado durante preparação exige tratamento explícito, não leitura
silenciosa de outra versão. A sintaxe de anexos não redefine `@`/`/` por inferência.

### F-009 — projeções de execução (D-040)

OpenCode mantém todo, perguntas e sessões filhas → runtime valida estado/evento
do binário suportado → RPC → UI nativa. Após queda, consultar estado atual por
HTTP sem presumir replay SSE. Pergunta pendente não é aprovação pendente.
Subagentes de leitura vêm primeiro; escritores dependem do isolamento de F-002.
Sem duplicar histórico nem criar outro scheduler.

### lacunas operacionais

- F-001: tratamento de falhas, reinício e reconexão.
- F-002: escopo de aprovação, visualização e aplicação de mudanças.
- F-003: provisionamento e matriz de compatibilidade do servidor remoto.
- F-004: fontes permitidas, configuração, isolamento e regras.
- F-005: fórmula do índice, pesquisa/benchmark, preços, elegibilidade e
  atualização das referências.
- F-006: patchset exato, manifesto, assinatura, cadência e mecanismo operacional
  de atualização/rollback do bundle.
- F-007: semântica detalhada de `@`, `/`, mensagens, chips e protocolo remoto
  dormente.
- F-010/F-011: assinatura dos eventos de projeção no runtime, reconciliação
  pós-queda e a UI do painel (etapas `J-3` e `J-4`).

Nenhuma dessas questões é resolvida por este documento.
