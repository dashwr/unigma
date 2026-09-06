# unigma — produto

## estado deste documento

Documentação consolidada. Os itens marcados **confirmado** são limitados ao
briefing, às decisões e às fontes listadas abaixo. **Pendente** exige definição
operacional, medição ou validação futura; não representa uma direção de produto
em aberto quando a arquitetura já a definiu.

## fontes de referência

| ID | Fonte analisada | Uso nesta documentação |
| --- | --- | --- |
| S-01 | briefing consolidado do projeto | intenção, escopo e restrições declarados |
| S-02 | [Code - OSS LICENSE.txt](https://github.com/microsoft/vscode/blob/main/LICENSE.txt) | licença do código-fonte Code - OSS |
| S-03 | [Differences between the repository and Visual Studio Code](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code) | separação entre o repositório e o produto Microsoft |
| S-04 | [OpenCode server](https://opencode.ai/docs/server) | interface HTTP, OpenAPI, SSE e SDK do OpenCode |
| S-05 | [OpenCode ACP](https://opencode.ai/docs/acp) | integração ACP do OpenCode |
| S-06 | direções do responsável registradas em 2026-08-22 | licença, MVP e identidade de produto |
| S-07 | consultas públicas em 2026-08-22: GitHub API, npm Registry e RDAP | disponibilidade de identificadores públicos |
| S-08 | direções e consultas públicas em 2026-08-22 | plataformas e identificador público `unigma-code` |
| S-09 | direção do responsável registrada em 2026-08-22 | performance do desktop e papel nativo do OpenCode |
| S-10 | direção do responsável registrada em 2026-08-22 | patches de performance sobre Code - OSS quando necessários |
| S-11 | aprovação do responsável registrada em 2026-08-22 | arquitetura desktop local-first documentada |
| S-12 | metadados públicos do upstream Code - OSS consultados em 2026-08-22 | release, commit, Node.js, Electron e comandos declarados |
| S-13 | validação local da fundação executada em 2026-08-22 | snapshot importado, identidade e harness parcial |
| S-14 | consolidação da execução da E-00 em 2026-08-23 | checks aprovados, bloqueios de build e pendências de proveniência |
| S-15 | validação no checkout local `E:\unigma` em 2026-08-23 | instalação e checks reproduzidos fora do Google Drive; dependências nested e compile-client ainda bloqueados; sem artefato ou smoke |
| S-16 | direção visual e imagem de referência fornecidas pelo responsável em 2026-08-23 | lettering geométrico/block-like como princípio, paleta, sheen metálico controlado e limites de incorporação |
| S-17 | direção do responsável registrada em 2026-08-23 | roteamento local de modelos por `intelligence index`, `Autopilot!` opt-in e comportamento visual do toggle |
| S-18 | direção do responsável registrada em 2026-08-26, recuperada da sessão de desenho do runtime | OpenCode como único harness oficial, perfil `service-only`, decepador, bundle atômico e capacidades intersessão do agente |
| S-19 | direções do responsável registradas em 2026-09-06 (`D-043`–`D-048`) | provider e modelo autorizados, rascunho legal, transporte Windows, identidade visual, interação do painel do agente e matriz de temas |

`docs/fontes/` contém a fonte local `MODELO-DE-TAREFAS.pdf`, preservada durante a
reorganização documental de 2026-08-27. Nenhuma fonte externa foi modificada.

## visão

**Confirmado (S-01):** unigma pretende ser um IDE open-source baseado em
Code - OSS, com integração profunda ao OpenCode. A direção de produto inclui
SSH, agentes, plugins/MCP, providers abertos, modelos locais ou APIs e uma
experiência integrada para trabalho assistido por agente.

**Confirmado (S-02, S-03):** Code - OSS e o produto Visual Studio Code não são
o mesmo artefato. Um derivado não deve assumir direitos sobre marca, ícones,
serviços ou distribuição da Microsoft.

## problema abordado

**Confirmado (S-01):** o projeto busca uma alternativa open-source para IDEs
com assistência por agentes, com integração de execução, contexto do projeto,
aprovações e trabalho remoto.

Não foram fornecidos pesquisa de usuários, métricas de mercado, personas ou
hipóteses de adoção. Não se deve inferi-los nesta etapa.

## proposta de valor

Oferecer o ambiente familiar de um editor derivado de Code - OSS e tornar as
capacidades do OpenCode acessíveis dentro do IDE, sem acoplar a aplicação a um
provider proprietário de IA. Não constitui promessa de versão, SLA ou paridade
com qualquer produto.

## identidade de produto

**Confirmado (S-06, S-16):** a interface usa inglês como idioma padrão e oferece
um pacote de idioma `pt-BR`.

**Confirmado (S-06):** a tagline continua “There's no secret.”.

### paleta e uso da cor

**Confirmado (S-19, D-046):** o **fundo neutro carrega a área**; **roxo e
magenta são realce, nunca banho de tela**. “Roxo predominante”, registrado em
S-06/S-16, é predominância **na identidade**, não em área de tela. A distinção
fica escrita porque as duas leituras produzem produtos diferentes.

**Confirmado (S-19, D-046, D-048):** as cores têm papel semântico fixo:

| cor | papel |
| --- | --- |
| violeta `#8b5cf6` | ativo e foco |
| magenta | **estado**: erro, atenção, permissão pendente |
| âmbar | aviso |

Magenta como segundo acento de marca ou acento decorativo foi recusado: quando
magenta aparecer, ele significa alguma coisa. O sheen metálico controlado
(S-06, S-16) permanece acabamento de superfície de marca, não de superfície de
trabalho.

**Confirmado (S-19, D-048):** são **cinco arquivos de tema**: quatro temas de
paleta — branco, lilás, preto (padrão) e roxo-escuro — mais o de **alto
contraste**, que fica à parte porque é acessibilidade e não gosto. A
especificação proposta está em [`THEME-PALETTE-DRAFT.md`](THEME-PALETTE-DRAFT.md);
`D-048` autoriza implementação **somente** do recorte “arquivos de tema e
auditor de contraste”, com prova exigida sobre o pacote no runner.

### onde a identidade aparece

**Confirmado (S-19, D-046):** **expressão nas superfícies de marca** — splash,
Welcome, About, instalador, ícone, site e documentação recebem grade,
micro-tipografia, dithering e brilho controlado. **Nas superfícies de trabalho,
só paleta e geometria** — editor, painéis e barra lateral não recebem grade
decorativa, rótulo ornamental nem textura.

**Exceção confirmada (S-19, D-046):** a **barra de status** e o **painel do
agente** podem carregar micro-rótulo, desde que ele traga **fato verificável**:
commit, versão fixada, run id, modelo que respondeu. **Número não medido não
aparece.**

**Confirmado (S-19, D-046, D-047):** geometria — **quadrado e grade são
estrutura e estado; arredondado é o que se clica**. O marcador de todo é
quadrado com um quadrado menor dentro para feito, e por ser quadrado já diz que
não é botão.

### logotipo e wordmark

**Confirmado (S-19, D-046):** o logotipo e o wordmark **já existem no
repositório**, em [`resources/unigma/`](../resources/unigma/README.md), e já
estão integrados ao empacotamento Linux e Windows. A marca é o **`U` em bloco
com uma célula ativa violeta**; off-white `#efeff4` e violeta `#8b5cf6`, PNG
RGBA **sem fonte embutida**. O conjunto final é `unigma-lockup-dark.png`
(logo + wordmark) e `unigma-icon-256/512.png`, com as derivações de plataforma
registradas por SHA-256 em
[`BRANDING-PROVENANCE.md`](../resources/unigma/BRANDING-PROVENANCE.md). Os
arquivos `unigma-cipher*` e `unigma-wordmark.png` são exploratórios e não entram
em pacote.

**Correção de registro (S-19, D-046):** `Cinderblock` **saiu do caminho**. O
texto anterior a tratava como fonte candidata a verificar licença, pesos e
direitos; não há o que licenciar, porque o lettering do lockup não depende de
face nenhuma. A construção original por blocos, direção de S-01/S-06/S-16, já
está feita — a restrição de cópia continua integral: nenhuma referência recebida
é ativo distribuível, e nada autoriza cópia de lettering, ícone, proporções,
composição ou outro elemento identificável de qualquer marca.

**`AC-012` continua bloqueado, e nada desta seção o move.** Proveniência por
hash registra derivação raster; ela **não** é concessão de licença, atribuição
de autoria, afirmação de originalidade, clearance de marca nem avaliação de
colisão. Os ativos seguem **impedidos de release público** até essa revisão
fechar. `D-046` decide **como a identidade se usa**, não que ela esteja
liberada; decisão de desenho não é liberação. As lacunas formais estão em
[`status/BRANDING-CLEARANCE.md`](status/BRANDING-CLEARANCE.md).

## distribuição e identificadores

**Confirmado (S-08):** o primeiro MVP atende Windows x64 e Linux x64.

**Confirmado (S-08):** `unigma` permanece o nome do produto. `unigma-code` é
o identificador público proposto para contas, pacotes e domínios que precisem
evitar as colisões conhecidas de `unigma`.

**Validação não vinculante (S-08):** em 2026-08-22, consultas públicas não
encontraram `unigma-code` em GitHub, npm, RDAP de `unigma-code.com` ou RDAP de
`unigma-code.dev`. Isso não reserva os identificadores, não confirma marca e
não autoriza publicação.

## capacidades em escopo declarado

| Capacidade | Estado | Referência |
| --- | --- | --- |
| base derivada de Code - OSS e sem marca Microsoft | confirmado | S-01, S-03 |
| interação com agente OpenCode | confirmado | S-01, S-04 |
| sessões, diffs e aprovações | arquitetura aprovada; comportamento detalhado pendente | S-01, S-11 |
| MCP, plugins e regras | configuração local explícita via OpenCode; política concreta pendente | S-01, S-11 |
| subagentes e worktrees | arquitetura aprovada; comportamento detalhado pendente | S-01, S-11 |
| terminal e SSH obrigatório | OpenSSH e extension host remoto definidos; compatibilidade detalhada pendente | S-01, S-11 |
| providers abertos, modelos locais e APIs | integração delegada ao OpenCode; **um par autorizado e provado** (`openrouter` / `nvidia/nemotron-3.5-lightning:free`, run `34052368433`). Um par provado não é suporte a provider; nenhum outro nome é anunciado como integrado | S-01, S-11, S-17, S-19 |
| roteamento por `intelligence index` e `Autopilot!` | direção confirmada; contrato operacional e validação pendentes | S-17 |
| bundle `unigma+opencode`; perfil `service-only` opcional (D-026) | direção confirmada; patchset, workflow e auditoria implementados para o perfil opcional; artefato aceito e suporte oficial pendentes | S-18 |
| atalhos `@` para ferramentas e `/` para skills | direção confirmada; contrato da UI nativa pendente | S-18 |
| mensagens intersessão e chips de estado de agentes | direção confirmada; ciclo de vida e renderização pendentes | S-18 |
| protocolo de controle remoto dormente | direção confirmada; protocolo e testes pendentes, sem ativação no MVP | S-18 |
| extensões externas Codex/Claude Code | fora do suporte oficial; não são harness do produto | S-18 |
| browser agent, cloud/agendador e colaboração em tempo real | posterior | S-01 |

**Confirmado (S-06, S-18):** o primeiro MVP inclui as capacidades do escopo
declarado acima, exceto as capacidades explicitamente posteriores e as linhas
marcadas como fora do suporte ou dormentes. O perfil opcional `service-only` não
é pré-requisito para a trilha básica do MVP. Direção confirmada não equivale a
implementação aceita.

**Confirmado (S-09):** OpenCode é o runtime primário de agente do unigma,
integrado à experiência do IDE; não é uma ferramenta externa periférica. O
produto deve priorizar uso eficiente de memória e responsividade do desktop.

## harness oficial e distribuição

**Confirmado (S-18, D-026):** OpenCode é o único harness/backend local oficial do
produto. A distribuição oficial é `unigma+opencode`; a trilha básica pode usar o
release upstream fixado, enquanto o perfil opcional `service-only` mantém o
harness de execução e redireciona TUI, onboarding, prompts interativos,
navegação e UI redundante para a contribuição nativa do unigma. O detalhe do
pipeline opcional está em
[`OPENCODE-SERVICE-ONLY.md`](OPENCODE-SERVICE-ONLY.md).

**Confirmado (S-18, D-026):** quando o perfil opcional `service-only` é
selecionado, o decepador é uma cadeia de build, não um mutador da instalação do
usuário: `commit upstream → patch service-only → testes → artefato versionado`.
Atualizações autorizadas do bundle selecionado substituem-no atomicamente quando
o processo está parado e preservam os dados do usuário fora do artefato.

**Confirmado (S-18):** extensões externas de Codex ou Claude Code podem existir
por decisão do usuário, inclusive baixadas de um marketplace, mas não têm
suporte oficial, adaptação no core ou status de harness. `unigma+pi` permanece
experimental. Plugins, MCP, rules e skills oficiais seguem os mecanismos nativos
e as políticas do OpenCode.

**Confirmado (S-18):** a direção de interação do agente inclui `@` para
ferramentas, `/` para skills, mensagens entre sessões locais e chips de agentes
ou subagentes com estados `thinking`, `typing` e `idle`. Um protocolo de controle
remoto pode ser construído de forma dormente, sem listener ativo, cloud,
colaboração em tempo real ou backend no MVP.

## provider e modelo autorizados

**Confirmado (S-19, D-043):** existe **um** par autorizado para as provas:
`openrouter` com `nvidia/nemotron-3.5-lightning:free`, pelo ID exato, sem alias
e sem fallback. Os critérios são verificáveis, não reputacionais: é gratuito, é
`toolcall: true` e estava presente na resposta `/provider` do binário fixado no
momento da escolha. A credencial é secret do repositório criado pelo
responsável, entregue ao ambiente do runner e atravessando para o WSL por
`WSLENV`; o produto não a lê nem a escreve, e ela nunca aparece em `argv`.

**Prova citada:** o run `34052368433` (`smoke=pass`, `check.prompt-answered=pass`,
`answer=answered`) contra o binário fixado `1.18.23`. **Isso é suporte a um par,
não suporte a provider.** `openrouter` não é anunciado como suportado e nenhum
outro provider ou modelo é anunciado como integrado; `AC-008` permanece
bloqueado. `connected` em `/provider` não prova credencial válida — só o prompt
respondido prova.

Modelo gratuito implica limite de taxa e disponibilidade variável: recusa do
provider, inclusive quota, é categoria de erro própria e nunca falha de contrato
silenciosa.

## roteamento de modelos e Autopilot!

### direção confirmada

**Confirmado (S-17):** modelos configurados e localmente autorizados pelo
OpenCode são classificados por um `intelligence index` aproximado, apoiado por
pesquisa e evidência versionada. O índice é uma heurística contextual, não uma
verdade universal, e não deve criar ou depender de catálogo remoto.

**Confirmado (S-17):** quando o roteamento se aplica, cada tarefa recebe uma
estimativa do índice necessário. O roteador escolhe, entre os modelos elegíveis,
o modelo de menor custo definido por configuração verificável que atinja o índice
estimado e respeite o teto explícito de `maxModel`. `maxModel` é um teto de
seleção local, não um ranking universal. Qualquer exemplo numérico, inclusive
`~49`, é apenas ilustrativo e não é valor normativo.

**Confirmado (S-17):** `Autopilot!` é um toggle opt-in. Desligado, o prompt usa
o modelo selecionado e não passa por roteamento. Ligado, o produto permite
roteamento antes de cada prompt. Quando `persistSelectedModel` está ativado, o
roteador não é executado antes do prompt e o modelo selecionado é mantido.

**Confirmado (S-17):** a chamada do roteador usa `Luna medium` sem contexto,
sem pensamento longo e somente com saída estruturada curta, mas apenas quando
esse modelo está configurado e disponível no OpenCode. A integração não usa
credenciais nem endpoints ocultos.

**Confirmado (S-17):** em erro ou timeout, o fallback seguro é o modelo
selecionado. Prompts, raciocínio e segredos não são registrados. A chamada
adicional e suas implicações de custo e privacidade devem ser explícitas.

**Confirmado (S-17):** o toggle desligado usa um tratamento visual mais escuro;
ligado usa a cor principal do tema com movimento sutil quando a preferência de
movimento reduzido não o impedir. O movimento deve respeitar essa preferência e
não pode resultar em animação excessiva.

Este registro documenta direção de produto; não afirma implementação, catálogo,
classificação validada ou suporte funcional.

### detalhes ainda abertos

Permanecem sem definição operacional suficiente:

- fórmula do `intelligence index`, escala, estimativa por tarefa e regra de
  comparação com `maxModel`;
- pesquisa, fontes, versionamento, evidência e processo de revisão da
  classificação;
- preços, unidade de custo, configuração verificável, atualização e tratamento
  de custo ausente ou ambíguo;
- lista de modelos elegíveis, disponibilidade no OpenCode e mapeamento das
  configurações locais;
- timeout, divulgação da chamada adicional e contrato de fallback;
- tokens, contraste, estados, foco, teclado e demais critérios de acessibilidade
  visual do toggle, incluindo a validação de movimento reduzido.

## fora de escopo nesta etapa

**Registro histórico (2026-08-22, S-11, S-13):** a arquitetura está aprovada e o snapshot inicial
de Code - OSS já foi importado. As features próprias do agente e a integração
funcional com OpenCode ainda não foram implementadas.

**Registro histórico (2026-08-23, S-14):** a fundação teve identidade, notices,
proveniência e comandos revisados; typecheck, lint, stylelint e parte do harness
passaram em clone de validação. O build executável e a compatibilidade
multiplataforma continuam sem validação por bloqueios de dependências/toolchain
do upstream. Isso não altera a arquitetura nem autoriza distribuição.

**Registro histórico (2026-08-23, S-15):** a instalação root/build e os checks mínimos
foram reproduzidos no checkout local fora do Google Drive. O upstream orquestra
dependências nested pelo `npm install` no root, com os scripts
`preinstall`/`postinstall` de `package.json` e os módulos
`build/npm/dirs.ts`/`build/npm/postinstall.ts`; `--ignore-scripts` deixa a árvore
incompleta.

`compile-client` é o menor compile sem Copilot. Ele avançou em ciclos
controlados, mas a tentativa oficial não foi feita por exigir toolchain nativo e
estar bloqueada por `MSB8040`/bibliotecas Spectre. A tentativa controlada mais
recente, com dependências parciais, parou em `extensions/github-authentication`
por tipos `mocha`/`node` ausentes; houve muitos ciclos limitados de dependência
nested e a caça incremental foi encerrada. Nenhum artefato ou smoke
multiplataforma foi produzido.

**Estado atual (evidência registrada em 2026-09-04/05):** existe uma primeira
build Linux x64 utilizável com OpenCode `1.18.23` embarcado; o smoke de pacote
subiu `opencode serve`, conferiu saúde e listagem de sessões pelo cliente do
produto e encerrou o processo com a porta fechada (`33721970575`). No recorte
`service-only`, T-096 tem patchset versionado e aplicador, T-097 tem input
`service_only` no workflow, T-098 tem troca atômica/rollback implementados e
T-099 tem auditoria das superfícies removidas. Essas implementações e seus
gates não equivalem a um artefato service-only aceito: E09 permanece `partial`
e ainda faltam a matriz de artefato e os gates de suporte correspondentes. A
poda service-only é opcional e está fora do caminho crítico por D-026.

**Registro de contratos (S-15):** T-010 tem contrato implementado e validado.
T-012 tem preflight sanitizado e bridge serializável parciais, sem suporte
funcional anunciado; T-011 e T-013 permanecem especificações/matrizes
condicionais.

**Restrição confirmada (S-01):** não usar nem extrair tokens, caches OAuth,
tráfego interceptado ou meios de contornar entitlement. Integrações devem usar
APIs autorizadas, modelos locais ou interfaces documentadas.

## documentos de desenho em revisão

Autorizados pelas decisões de 2026-09-06 e marcados `[EM REVISÃO]`. Definem
desenho ou registram opções; **não autorizam implementação** (a exceção é o
recorte de temas/auditor liberado por `D-048`) e não fecham aceite:

| documento | cobre | decisão |
| --- | --- | --- |
| [`AGENT-UX-DRAFT.md`](AGENT-UX-DRAFT.md) | regiões fixas do painel do agente, pergunta pendente, permissão e marcador de todo | D-047 |
| [`VISUAL-IDENTITY-DRAFT.md`](VISUAL-IDENTITY-DRAFT.md) | leitura das referências, separação marca/trabalho e geometria | D-046 |
| [`THEME-PALETTE-DRAFT.md`](THEME-PALETTE-DRAFT.md) | paleta dos quatro temas, semânticas de cor e divergências dos temas atuais | D-046, D-048 |
| [`LEGAL-DRAFT.md`](LEGAL-DRAFT.md) | proposta de `NOTICE`, `LICENSE` e política de cabeçalho — **não afirma clearance** | D-044 |
| [`WINDOWS-TRANSPORT.md`](WINDOWS-TRANSPORT.md) | opções de transporte do cliente Windows sem `ControlMaster`, com custo e prova de cada uma | D-045 |

`T-002` e `T-004` não fecham com o rascunho legal; `T-056` continua sem
implementação autorizada.

## questões abertas

Ver [DECISIONS.md](DECISIONS.md) para o registro e
[REQUIREMENTS.md](REQUIREMENTS.md#questões-abertas) para pendências que
afetam requisitos.
