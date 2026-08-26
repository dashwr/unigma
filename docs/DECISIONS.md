# unigma — decisões

## estado deste documento

Registro consolidado. As decisões arquiteturais aprovadas não autorizam sua
implementação; cada alteração de código continua exigindo início explícito do
trabalho.

## decisões confirmadas

| ID | Decisão/direção | Estado | Evidência |
| --- | --- | --- | --- |
| D-001 | O projeto se chama `unigma`. | confirmado | S-01 |
| D-002 | A direção é um IDE open-source baseado em Code - OSS com integração profunda ao OpenCode. | confirmado | S-01 |
| D-003 | Browser agent, cloud/agendador e colaboração em tempo real ficam para fase posterior. | confirmado | S-01 |
| D-004 | Não usar credenciais extraídas, interceptação de tráfego ou bypass de entitlement. | confirmado | S-01 |
| D-005 | O código próprio de unigma usa licença MIT. | confirmado | S-06 |
| D-006 | O MVP inclui todas as capacidades de escopo declarado, exceto browser agent, cloud/agendador e colaboração em tempo real. | confirmado | S-01, S-06 |
| D-007 | A identidade usa inglês por padrão, pacote `pt-BR`, paleta roxo/magenta/violeta, sheen metálico controlado, temas sobre os fundos declarados e tagline “There's no secret.”. | confirmado | S-06, S-16 |
| D-008 | A marca será original: lettering geométrico/block-like é apenas referência de princípio para construção própria por blocos verticais roxos, sem cópia de lettering, ícone, proporções, composição ou outros elementos identificáveis. A imagem fornecida pelo responsável é referência visual, não ativo distribuível. | confirmado | S-01, S-06, S-16 |
| D-009 | O MVP atende Windows x64 e Linux x64. | confirmado em 2026-08-22 | S-08 |
| D-010 | `unigma` permanece nome do produto; `unigma-code` é o identificador público proposto. | confirmado em 2026-08-22 | S-08 |
| D-011 | OpenCode é o runtime primário de agente do IDE; desempenho e memória são prioridades de produto. | confirmado em 2026-08-22 | S-09 |
| D-012 | Patches de performance podem ser aplicados sobre Code - OSS quando uma necessidade reproduzível os justificar; não haverá fork preventivo do Electron. | confirmado em 2026-08-22 | S-10 |
| D-013 | A arquitetura desktop local-first documentada em `ARCHITECTURE.md` está aprovada: contribuição nativa `unigmaAgent`, `unigma-agent-runtime` com CLI `opencode serve` por HTTP/SSE, OpenSSH remoto, dados locais mínimos e ausência de backend/banco/RBAC/cloud no MVP. | aprovado em 2026-08-22 | S-11 |
| D-014 | O fork Code - OSS será desmarcado e preservará avisos, licenças e copyrights aplicáveis em toda distribuição. | aprovado em 2026-08-22 | S-02, S-03, S-11 |
| D-015 | O upstream inicial é `microsoft/vscode` na tag `1.134.0`, commit `474a349ad5b745e512ef86b864d1c74f7264dd7a`; a matriz declarada usa Node.js `24.18.0`, Electron `42.8.1`, Windows x64 e Linux x64. Atualizações acompanham releases/patches verificáveis do upstream. | aprovado em 2026-08-22 | S-12 |
| D-016 | O produto adota classificação aproximada por `intelligence index` e roteamento local limitado a modelos configurados/autorizados pelo OpenCode, com `Autopilot!` opt-in, `persistSelectedModel`, fallback seguro e os limites de custo, privacidade e UI descritos abaixo. | direção de produto confirmada; detalhes operacionais e validação pendentes | S-17 |
| D-017 | OpenCode é o único harness/backend local oficial do produto; a distribuição oficial é `unigma+opencode`. | confirmado em 2026-08-26 | S-18 |
| D-018 | O bundle oficial usa um perfil `service-only`: preserva o harness de execução do OpenCode e remove/redireciona TUI, onboarding, prompts interativos, navegação e UI redundante para o unigma. | direção confirmada; patch e validação pendentes | S-18 |
| D-019 | O “decepador” é uma cadeia reproduzível `commit upstream → patch service-only → testes → artefato versionado`; não muta instalações do usuário. | direção confirmada; pipeline pendente | S-18 |
| D-020 | Atualizações autorizadas trocam o bundle atomicamente com o processo parado, mantendo rollback e os dados do usuário fora do artefato. | direção confirmada; implementação e evidência pendentes | S-18 |
| D-021 | A direção do agente inclui `@` para ferramentas, `/` para skills, mensagens entre sessões locais e chips de estado; o protocolo de controle remoto é construído dormente, sem ativação no MVP. | direção confirmada; contratos e implementação pendentes | S-18 |
| D-022 | Codex/Claude Code podem ser extensões externas instaladas pelo usuário, mas não têm suporte oficial nem são harness do unigma; `unigma+pi` é experimental e plugins/MCP/rules/skills oficiais usam os mecanismos nativos do OpenCode. | confirmado em 2026-08-26 | S-18 |

### D-016 — direção confirmada e limites

- Modelos configurados e localmente autorizados pelo OpenCode recebem um
  `intelligence index` aproximado baseado em pesquisa/evidência versionada. O
  índice não é verdade universal e não cria catálogo remoto.
- Quando aplicável, a tarefa recebe uma estimativa de índice necessário. O
  roteador escolhe o modelo elegível de menor custo definido por configuração
  verificável que atinja esse índice e respeite o teto explícito de `maxModel`.
  `maxModel` não é ranking universal. `~49`, ou qualquer outro exemplo
  numérico, é apenas ilustrativo e não normativo.
- `Autopilot!` é opt-in: desligado usa o modelo selecionado sem roteamento;
  ligado permite roteamento antes de cada prompt. `persistSelectedModel` evita o
  roteador antes do prompt e mantém o modelo selecionado.
- O roteador usa `Luna medium` sem contexto, sem pensamento longo e com saída
  estruturada curta somente quando configurado e disponível no OpenCode. Não há
  credenciais nem endpoints ocultos.
- Em erro ou timeout, o fallback é o modelo selecionado. Prompt, raciocínio e
  segredo não são registrados; o custo e a implicação de privacidade da chamada
  adicional devem ser explícitos.
- O toggle desligado é visualmente mais escuro; ligado usa a cor principal do
  tema com movimento sutil quando a preferência de movimento reduzido não o
  impedir, sem animação excessiva.

Este registro confirma direção, não implementação ou suporte funcional.

### D-017 a D-022 — harness, bundle e capacidades do agente

- O OpenCode continua sendo a fonte de verdade do harness: sessões, tool loop,
  permissões, compaction, limites, retries, plugins, MCP, skills, providers,
  streaming e subagentes não devem ser reimplementados no workbench.
- O unigma é dono da apresentação e da coordenação. O patch service-only retira
  superfícies duplicadas, mas não apaga código upstream por varredura cega nem
  transforma o runtime em um segundo harness.
- O bundle contém somente o runtime versionado; configuração, credenciais,
  sessões, histórico e demais dados do usuário permanecem fora dele. Não há
  download automático, servidor central ou telemetria implícitos.
- `@`, `/`, mensagens intersessão e chips pertencem à experiência nativa do
  agente. O controle remoto dormente não reabre colaboração em tempo real,
  cloud ou backend no MVP.
- Extensão externa não é integração oficial. O unigma não cria catálogo,
  carregador ou adaptador para transformar Codex/Claude Code em harness.

### detalhes de D-016 ainda abertos

- fórmula, escala e estimativa do `intelligence index`, com sua comparação ao
  teto `maxModel`;
- pesquisa, fontes, versionamento, evidência e revisão da classificação;
- preços, unidade de custo, configuração verificável, atualização e custos
  ausentes ou ambíguos;
- lista de modelos elegíveis, disponibilidade no OpenCode e mapeamento das
  configurações locais;
- timeout, fallback detalhado e forma de explicitar a chamada adicional, custo e
  privacidade;
- tokens, contraste, estados, foco, teclado e acessibilidade visual do toggle,
  incluindo movimento reduzido.

## decisões que exigem intervenção

Não há nova decisão arquitetural a confirmar. As direções D-016 a D-022 estão
confirmadas; suas definições operacionais, patches, artefatos e validações
permanecem abertas e não autorizam suporte por si só.

## validação de identificadores

| ID | Resultado em 2026-08-22 | Fonte | Consequência |
| --- | --- | --- | --- |
| V-001 | `github.com/unigma` existe e aponta para organização pública “UNIST Enigma”. | GitHub API | não usar como identificador do projeto |
| V-002 | `unigma.com` está registrado até 2027. | Verisign RDAP | não usar sem direito explícito |
| V-003 | npm `unigma` retornou 404; `unigma.dev` retornou 404 no RDAP. | npm Registry, RDAP | disponibilidade não garantida |
| V-004 | GitHub, npm, `unigma-code.com` e `unigma-code.dev` retornaram 404 nas consultas públicas. | GitHub API, npm Registry, RDAP | candidato disponível, sem reserva ou garantia |

## questões técnicas adiadas

As seguintes questões não alteram a arquitetura aprovada e serão determinadas
ao detalhar o MVP: patchset e pipeline do perfil service-only, manifesto e
rollback do bundle, contratos de comportamento da UI, provisionamento SSH,
fontes/suportes concretos de MCP/plugin/provider, baselines numéricos de
performance e os detalhes abertos de D-016. `Cinderblock`
permanece candidata não incorporada e exige verificação de disponibilidade,
licença, pesos e direitos de uso antes de qualquer incorporação.

## regra de atualização

Após cada resposta do responsável, registrar a decisão com data, resposta,
justificativa e documentos afetados; então atualizar os requisitos, fluxos,
modelo de dados, arquitetura e aceitação impactados. Não reabrir decisões sem
evidência ou mudança explícita de escopo.
