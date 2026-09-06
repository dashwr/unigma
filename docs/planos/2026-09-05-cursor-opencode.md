# unigma: experiência nativa de agente sobre OpenCode

> `DOC-CURSOR-001` · 2026-09-05 · proposta para revisão, não autorização de
> implementação. Base unigma: `b3e4ca5f`; fonte OpenCode: `c2eacd72`.
> Pesquisa documental e estática; nenhum build, provider ou host foi acionado.

## 1. conclusão

**Não precisamos reproduzir o motor do Cursor. Precisamos integrar o harness
OpenCode ao editor, com contexto explícito, revisão segura e recuperação real.**

OpenCode executa sessão, modelo, ferramentas, permissões, tarefas e compaction.
Code - OSS fornece documentos, símbolos, diff, terminal e SCM. O unigma coordena
essas autoridades por RPC; não cria outro tool loop, banco, indexador
persistente ou serviço cloud.

A parte difícil não é renderizar tokens: é impedir que agente, buffer e disco
destruam alterações uns dos outros. Essa garantia precede edição concorrente,
undo global e agentes paralelos com escrita.

## 2. correções no levantamento do Cursor

Fonte recebida: `cursor-specs.md`, na raiz externa do workspace
(`/home/dasher/projects/unigma/`), preservada sem edição. Não contém referências
primárias. As experiências são requisitos candidatos; as alegações internas
sobre Cursor/concorrentes não foram verificadas independentemente.

| alegação | leitura técnica |
| --- | --- |
| Fast/Standard exigem dois backends | não comprovado. Podemos oferecer perfis de modelo, variante, contexto e execução sem dois backends nossos. |
| `@Codebase` exige embeddings locais contínuos | não comprovado nem necessário. Começar com busca, símbolos e leitura sob demanda; índice próprio contraria a arquitetura atual. |
| streaming modifica vários buffers simultaneamente | separar streaming textual, atualização de diff e escrita efetiva; nenhum deles garante concorrência segura. |
| timeline restaura qualquer estado sem afetar Git | não assumir preservação de alterações manuais. Precisamos de baseline, detecção de drift e testes tracked/untracked. |
| OpenCode é CLI vendor-locked com configuração básica | incorreto: documentação oficial descreve HTTP/SSE, múltiplos providers, agentes, regras, MCP e skills. |
| contexto fixo de 200k ou multimilhões de tokens | limite depende de modelo/provider/configuração; não é contrato do unigma. |

Também não importar convenções de exemplo como `try/catch` em toda mutação:
regras devem nascer do projeto, não de uma receita universal.

## 3. maiores embates e o que eles impõem

| embate observado | consequência |
| --- | --- |
| build verde distribuía extensões sem código (`5c9cc32f`, `a24012f6`) | testar a feature no pacote publicado; auditar existência do entrypoint declarado. |
| `/version` verde com seis addons remotos quebrados (`33784052687`) | smoke precisa tocar terminal, watcher, estado e fluxo real; manter baseline ELF e carga no host. |
| smoke sintético confirmava o próprio commit | fixture prova contrato, não suporte; separar unidade, integração e E2E de artefato real. |
| lock/handshake viravam “servidor ausente” | erros distintos e sanitizados; não mandar repetir staging por falha de transporte. |
| janela abriu, recuperação ainda não foi provada (`33949936848`) | concluir `T-053`; reconexão SSH e retomada de conteúdo SSE são problemas diferentes. |
| `ControlMaster` ausente no OpenSSH Windows | resolver `T-056` com host real. Segunda sessão `ssh -N -L` é candidata, não suporte comprovado. |
| root expôs remoção/extração inseguras | preservar `safe_rm`, pós-condições, flags de extração e escrita limitada à área autorizada; não provisionar infraestrutura automaticamente. |
| trust expirava enquanto prompt aguardava na fila | revalidar antes do efeito, inclusive contexto, edição, merge e permissão; aprovação antiga não é autorização nova. |
| poda do Agent Host ameaçava levar o Code Server | preservar servidor/extension host remoto; não ressuscitar AHP/Copilot para ganhar UI. Reusar serviços neutros do editor. |
| headless confundido com service-only | manter patch mínimo reproduzível; não cortar tools/todo/permissões ao retirar TUI. `D-026` mantém a poda fora do caminho crítico. |
| baseline ainda sem números | corrigir medição no runner antes de otimizar; hipótese sandbox/GPU não autoriza desligar segurança no produto. |
| docs/board confundiam implementação com aceite | registrar entrega e limite da evidência; teste de função não encerra experiência. |

Há divergências a reconciliar: `AGENTS.md` ainda diz que nenhum smoke toca o
resolver; o workbench já registra a janela real. `DECISIONS.md` possui duas
entradas `D-032`; citar também o título. Alguns estados de service-only e
auditoria antecedem os últimos commits. Não desfazer entregas com base nisso.

## 4. arquitetura de implementação

```text
workbench nativo: composer / anexos / diff / timeline / tarefas / perguntas
       ↕ RPC privado versionado, validado e associado à autoridade
unigma-agent-runtime no host do workspace
  casos de uso + adapters OpenCode, Git e APIs de documentos do editor
       ↕ HTTP/SSE no loopback daquele host
um opencode serve por extension host
  sessões / tool loop / modelos / permissões / MCP / skills / snapshots
```

- **Workbench:** apresentação/comandos, sem filesystem, HTTP, processo ou segredo
  direto. Sem Webview ou TUI embutida.
- **Runtime:** autoridade, preflight, contexto e lifecycle; ampliar o cliente HTTP
  existente, sem introduzir SDK em paralelo.
- **OpenCode:** fonte de mensagens, diffs, todo, filhos e permissões; UI mantém
  projeções descartáveis, não um segundo histórico.
- **Editor/Git:** autoridade sobre buffers e worktrees. Conteúdo não salvo não
  existe no disco e não pode ser inferido pelo servidor.
- **SSH:** mesmos contratos com execução no destino. `vscode-remote:` não é
  caminho local nem URL que o OpenCode entende automaticamente.

## 5. capacidades e implementação proposta

### 5.1 rápido/profundo e Autopilot

**Upstream:** agentes configuráveis, modelo por agente, variantes e limite de
passos. **Local:** domínio do router implementado; falta comprovar a costura
com classificação e modelo efetivo no envio real.

- Separar perfil de interação da identidade do modelo. `quick` pode limitar
  escopo/contexto/passos; `deep` pode planejar antes de executar. São propostas,
  não configurações a instalar nesta rodada.
- Usar somente modelos/variantes expostos pelo OpenCode fixado;
  `reasoningEffort` não é parâmetro universal.
- Autopilot desligado ou `persistSelectedModel` ligado: escolha explícita sem
  router. Ligado: menor custo elegível sob `maxModel`, sem escalada silenciosa.
- `Luna medium` continua condicionado a disponibilidade/configuração autorizada.
  Custo e privacidade da classificação são explícitos; não inventar endpoint.
- Para renomeação semântica, oferecer Rename Provider do Code - OSS quando
  disponível; não substituir símbolos globalmente por texto nem gastar LLM à toa.

**Aceite:** modelo efetivo visível, bypass sem chamada extra, timeout observável,
custo ausente recusado e nenhuma ultrapassagem do teto.

### 5.2 arquivos, pastas, codebase e documentação

**Upstream:** leitura/busca, referências de arquivos, webfetch e LSP condicionado.
**Lacuna local:** `SendInput` recebe texto; catálogo `@`/`/` não é anexo/buffer.

1. Ampliar RPC com descritores: tipo, URI, autoridade, intervalo opcional e
   versão do documento. Runtime resolve e converte para `parts` aceitas pelo
   `/doc` do binário; não presumir que referência implica conteúdo materializado.
2. Arquivo: seleção explícita, limite de tamanho e exclusão de segredos. Buffer
   sujo exige salvar ou anexar explicitamente a seleção; nunca salvar sozinho.
   Primeiro incremento pode oferecer apenas salvar/cancelar.
3. Pasta: delimita busca, não concatenação recursiva. Respeitar exclusões,
   symlinks, autoridade e limites de quantidade/bytes.
4. Codebase: nomes/texto/símbolos → trechos candidatos → expansão sob demanda.
   Usar providers de linguagem existentes; não prometer grafo semântico completo
   em linguagem sem provider. Não criar embeddings persistentes.
5. Docs: URL explícita, origem visível, webfetch pelo harness autorizado.
   Conteúdo externo é dado não confiável, nunca instrução privilegiada. Destinos
   privados e redirecionamentos dependem da política de rede. Sem crawler/cache.
6. Mostrar fontes anexadas, omitidas e truncadas. Não afirmar que o repositório
   inteiro entrou no contexto. Compaction permanece responsabilidade OpenCode.

**Decisão:** `RQ-026` reserva `@` para ferramentas e `/` para skills. Recomendo
botão de anexos com categorias inicialmente; adotar `@Files/@Codebase/@Docs`
exige gramática explícita, não colisão silenciosa com o contrato atual.

**Aceite:** arquivo local/remoto correto, caminho externo recusado, buffer sujo
explicado, exclusões/limites exercitados e nenhuma indexação própria.

### 5.3 diff multi-arquivo e concorrência

**Disponível:** `session.diff`, consulta HTTP e modelos de arquivos.
**Falta:** integração com versões de documentos, conflito e revisão parcial.

- Primeiro incremento: lista nativa e editores de diff com atualizações
  incrementais agrupadas. Token não vira escrita no buffer; diff consultado não
  é comando de aplicação e não deve ser reaplicado sobre arquivo já alterado.
- Separar **permissão antes da ferramenta** de **revisão depois da escrita**.
  `once/always/reject` não são aceitar/rejeitar hunk. OpenCode pode já ter
  escrito no disco quando o diff aparece.
- Escrita direta inicial: um executor mutante por workspace e tratamento de
  buffers sujos/drift. Isso reduz colisões; não impede escritor externo.
- Para revisar antes de incorporar e editar manualmente em paralelo: tarefa em
  worktree Git isolada, integração explícita depois. Worktree de HEAD não inclui
  dirty/untracked atuais; não copiá-los ou commitá-los automaticamente.
- Aplicação futura compara base, resultado do agente e documento atual, valida
  versão do buffer e abre conflito quando divergir. Reusar diff/merge/bulk-edit
  do editor; não anunciar transação multi-arquivo sem tratar falha parcial.
- Permissão não é sandbox. Shell/plugins/MCP também escrevem: interceptar só
  `edit` não garante proteção do workspace.

**Aceite:** dois arquivos, buffer sujo, edição humana intermediária, rename/delete
e falha parcial sem sobrescrita silenciosa ou reaplicação dupla.

### 5.4 timeline e undo

**Documentado:** revert/unrevert/fork e mensagens; undo da TUI exige Git.
**Fonte inspecionada:** snapshots usam Git auxiliar do OpenCode; restauração
pode substituir caminhos modificados depois. Não é merge seguro.

- Timeline consulta OpenCode; unigma guarda só IDs/estado visual. `/fork`
  bifurca conversa, não cria worktree.
- Não expor rollback irrestrito de vários prompts no workspace compartilhado.
  Exigir sessão parada, preview de impacto e verificação de drift.
- Preferência: undo inicial apenas na worktree dedicada, sem edições externas,
  após validar snapshots do bundle real.
- Comparar e depois restaurar ainda tem corrida com escritores externos. Sem
  exclusão garantida, recusar restauração automática no workspace compartilhado
  e oferecer revisão/conflito; não chamar isso de operação segura.
- Testar tracked/untracked/ignored, criação/remoção e alteração manual posterior.
  Sem Git/snapshots: função indisponível, não fallback destrutivo.
- Sem banco de snapshots do unigma; nunca implementar undo com
  `git reset --hard` na árvore do usuário.

### 5.5 regras, MCP e skills

- Reusar `AGENTS.md`, instructions, skills e MCP do OpenCode. Não importar
  `.cursor/rules/*.mdc` silenciosamente: precedência/globs/ativação podem diferir.
  Eventual importador seria migração revisada à parte.
- Regra em prompt orienta; **não impõe segurança**. Enforcement pertence às
  permissões e gates do runtime. Defaults permissivos upstream não são nossa
  política de produto.
- Reusar inventário/preflight existente: origem, trust e efeitos de configuração
  precedem start. MCP/plugin local pode executar processo; remoto pode enviar
  dados. Sem instalação, autenticação ou habilitação automática.
- Expor só ferramentas relevantes: schemas MCP consomem contexto. Medir antes
  de criar otimização/cache.
- LSP não é embeddings. Tools documenta a ferramenta LSP como experimental;
  servidores podem exigir instalação. Esta proposta não habilita downloads.

### 5.6 checklist, subagentes, perguntas e testes

- Checklist deriva de consulta de todo/eventos, sem segunda lista persistente.
  Árvore de agentes deriva de `parentID`/`children`.
- Pergunta não é permissão: precisa de listar/responder/rejeitar próprio para
  não deixar o harness bloqueado esperando uma UI inexistente.
- Começar com pesquisadores read-only e um escritor. `Task` cria sessão filha,
  **não** worktree ou isolamento automático de filesystem.
- Escritores paralelos exigem worktrees distintas, diretório validado e merge
  explícito. Não presumir que filho muda de workspace: provar roteamento por
  diretório antes de habilitar isso.
- OpenCode conduz editar → testar → interpretar → corrigir. Unigma apresenta
  estado, cancelamento e resultado; não cria segundo scheduler/tool loop.
- Teste vem do projeto, com aprovação aplicável. Mostrar comando, destino,
  saída sanitizada e exit code. “Passou” escrito pelo modelo não é evidência.
  Limitar passos/tempo e pedir intervenção ao esgotar.
- Queda SSE: retry limitado e recarga HTTP de estado/mensagens/diff/todo;
  nunca reenviar prompt para recuperar stream. HTTP 204 confirma submissão,
  não conclusão; resposta perdida deixa entrega incerta e exige reconciliação.

## 6. ampliar contrato por capacidade

O site oficial é móvel. `/doc` do **artefato executado** é a autoridade de paths,
schemas e eventos. SDK v2, checkout `dev` e mesma string de versão não provam
equivalência ao bundle. Não atualizar versão suportada por conveniência.

| capacidade | contrato a validar | implementação local |
| --- | --- | --- |
| contexto/modelo/agente | `parts/model/agent` de `prompt_async`; variante só se presente no schema | ampliar `SendInput` e validação |
| revisão | `/session/{id}/diff`, `session.diff`, partes de ferramenta | projeção nativa sem reaplicação |
| checklist | `/session/{id}/todo` e evento observado | consulta e projeção transitória |
| subagentes | `/agent`, `/children`, `parentID` | árvore/correlação/cancelamento testados |
| pergunta | rotas e eventos presentes no bundle | RPC separado de permissão |
| timeline | `/revert`, `/unrevert`, `/fork` | comando condicional, confirmação/drift |
| busca UI | `/find*`/`/file*` apenas se escolhidos; tools são outra interface | adapter sem índice duplicado |

Todo/revert/fork/find/file estão fora do perfil mínimo atual em
`OPENCODE-COMPATIBILITY.md`; perguntas também exigem extensão contratual.
A fonte inspecionada tem `question.v2.*`, mas isso não autoriza hard-code:
capturar `/doc`, fixture e probe do pacote. Ausência desabilita com motivo,
sem endpoint alternativo silencioso.

Concentrar mudanças nos módulos existentes:

- `src/vs/workbench/contrib/unigmaAgent/common/agentProtocol.ts`: RPC versionado.
- `src/vs/workbench/contrib/unigmaAgent/browser/`: apresentação/comandos.
- `extensions/unigma-agent-runtime/src/application/`: casos de uso/gates.
- `extensions/unigma-agent-runtime/src/infrastructure/openCodeHttpClient.ts`:
  endpoints, parsing, SSE e recarga; sem segundo cliente.
- `extensions/unigma-agent-runtime/src/domain/router/`: preservar domínio puro
  e ligar decisão ao envio real após validar contrato de modelo.

## 7. sequência proposta

| ordem | entrega | gate de saída |
| --- | --- | --- |
| 0 | reconciliar contratos/status e decidir propostas abaixo | escopo aprovado sem alterar decisões implicitamente |
| 1 | concluir Linux de `T-053`; decidir/exercitar `T-056` | sessão → queda → mesma janela recuperada; Windows provado ou matriz limitada explicitamente |
| 2 | fluxo local com modelo autorizado, pergunta, permissão e cancelamento (`T-024`, E-02/E-03) | prompt → ferramenta → efeito → revisão → teste usando pacote |
| 3 | anexos e revisão multi-arquivo (`T-031`…`T-034`) | contexto correto, buffer sujo tratado, diff sem reaplicação |
| 4 | checklist e subagentes read-only (`T-040`…`T-042`) | pai/filho/todo consistentes após queda SSE |
| 5 | worktree por tarefa e timeline condicionada | isolamento/conflito/undo sem perder trabalho alheio |
| 6 | runtime/agente remoto (`T-054`/`T-055`) | mesmo fluxo no destino, sem processo/workspace local indevido |
| 7 | perfis quick/deep e Autopilot operacional (E-08) | teto, escolha explícita, custo, privacidade e fallback provados |
| contínuo | bundle/auditoria/baseline (E-07/E-09) | pacote real, sem instalação indevida e números reproduzíveis |

O fluxo local pode avançar independentemente do transporte, sem anunciar
suporte remoto. A ordem não autoriza nova onda nem substitui dependências do
backlog. Não bloquear experiência básica esperando poda service-only opcional.

## 8. decisões antes de implementar

1. **Atalhos/contexto:** aprovar anexos explícitos e resolver colisão com `@`
   ferramentas / `/` skills; sem reinterpretar prompts antigos.
2. **Escrita:** aceitar revisão pós-efeito inicialmente ou exigir worktree desde
   o início. Recomendo worktree para tarefas amplas/autônomas, com integração
   explícita; sem promessa de sandbox.
3. **Undo:** aprovar restrição inicial à worktree controlada; restauração segura
   de workspace compartilhado não é garantia OpenCode.
4. **API:** ampliar perfil para todo/perguntas e, depois, revert/fork;
   fixture/probe precedem exposição de cada comando.
5. **Execução:** autorizar provider/modelo e custo; configuração de credenciais
   permanece fora do unigma, nunca recebida no chat.
6. **Windows:** resolver `T-056`; mudar `ControlMaster` também exige revisar
   `D-034`, que documenta a razão do desenho atual.

Não proponho embeddings, banco de checkpoints, cloud, colaboração em tempo real
ou segundo harness. Se busca sob demanda falhar em benchmark real, indexação
vira decisão separada de arquitetura, custo, retenção e privacidade.

## 9. validação mínima

- **Unidade:** contexto, autoridade, versões, redução de eventos, limites,
  seleção e falhas.
- **Contrato:** `/doc` fixado, eventos desconhecidos, erros HTTP, respostas
  tardias/duplicadas e reconexão sem replay de prompt.
- **Editor:** dirty buffer, edição concorrente, múltiplos arquivos, rename/delete,
  cancelamento e recusa de restore com drift.
- **Harness real:** ferramenta com aprovação, pergunta bloqueante, teste falho
  e correção limitada. Provider autorizado; mock não substitui esse gate.
- **Pacote/runner:** fluxo pelos módulos distribuídos, local e remoto. Nenhum
  build/smoke amplo nesta máquina.
- **Evidência:** registrar ref do workflow e proveniência do artefato quando
  diferirem, cenário, resultado e limite. Não marcar AC pela existência do botão.

## 10. fontes

Documentação oficial consultada em 2026-09-05, não fixada a release:

- [Server](https://opencode.ai/docs/server/): HTTP/SSE, `/doc`, sessões e diff.
- [Agents](https://opencode.ai/docs/agents/): agentes/modelos/passos/subagentes.
- [Tools](https://opencode.ai/docs/tools/): edição, busca, todo, perguntas, LSP.
- [Models](https://opencode.ai/docs/models/): providers e variantes.
- [Rules](https://opencode.ai/docs/rules/): `AGENTS.md` e instructions.
- [Permissions](https://opencode.ai/docs/permissions/): `allow/ask/deny`.
- [MCP](https://opencode.ai/docs/mcp-servers/): ferramentas e custo de contexto.
- [TUI](https://opencode.ai/docs/tui/): referências e undo/redo com Git;
  experiência upstream, não contrato HTTP do unigma.
- [LSP](https://opencode.ai/docs/lsp/): servidores/requisitos/downloads.
- [Skills](https://opencode.ai/docs/skills/): carregamento nativo.

Fonte OpenCode em `c2eacd72`, sob `packages/opencode/src/`:
`session/revert.ts`, `snapshot/index.ts`, `tool/task.ts`, `session/todo.ts`,
`server/routes/instance/httpapi/`; schemas em `packages/schema/src/`.
Inspeção de fonte orienta riscos; não substitui probe do binário.

Fontes internas: [arquitetura](../ARCHITECTURE.md),
[requisitos](../REQUIREMENTS.md), [decisões](../DECISIONS.md),
[dados](../DATA-MODEL.md), [compatibilidade](../OPENCODE-COMPATIBILITY.md),
[workbench](../status/WORKBENCH.md), [evidência](../status/EVIDENCE.md),
[backlog](../BACKLOG.md), [board da proposta](https://trello.com/c/qgsY104f).
