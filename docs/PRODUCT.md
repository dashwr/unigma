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

`docs/fontes/` não existe na cópia atual do repositório. Nenhuma fonte local
foi modificada.

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
um pacote de idioma `pt-BR`. A identidade visual usa uma paleta
roxo/magenta/violeta, com roxo como cor predominante. A direção inclui sheen
metálico controlado como acabamento. Os temas são aplicações dessa paleta em
fundos branco, lilás, preto e roxo-escuro, entre outros que ainda precisem ser
especificados.

**Confirmado (S-06):** a tagline inicial é “There's no secret.”.

**Direção confirmada com restrição (S-01, S-06, S-16):** lettering
geométrico/block-like é referência de princípio, não cópia, para uma construção
original por blocos verticais em roxo. A referência visual não autoriza cópia de
lettering, ícone, proporções, composição ou outro elemento identificável de
qualquer marca. Os ativos de unigma precisam ser distintivos. A imagem fornecida
pelo responsável é apenas referência visual e não é um ativo distribuível.

**Pendente:** `Cinderblock` é candidata para título colorido em peso forte e
tagline branca em peso leve. A disponibilidade, licença, pesos e direitos de uso
da fonte não foram verificados; ela não deve ser incorporada antes de todos
esses pontos serem verificados.

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
| providers abertos, modelos locais e APIs | integração delegada ao OpenCode; direção de classificação e roteamento confirmada, suporte concreto pendente | S-01, S-11, S-17 |
| roteamento por `intelligence index` e `Autopilot!` | direção confirmada; contrato operacional e validação pendentes | S-17 |
| perfil `service-only` e bundle `unigma+opencode` | direção confirmada; decepador, artefato e atualização atômica pendentes | S-18 |
| atalhos `@` para ferramentas e `/` para skills | direção confirmada; contrato da UI nativa pendente | S-18 |
| mensagens intersessão e chips de estado de agentes | direção confirmada; ciclo de vida e renderização pendentes | S-18 |
| protocolo de controle remoto dormente | direção confirmada; protocolo e testes pendentes, sem ativação no MVP | S-18 |
| extensões externas Codex/Claude Code | fora do suporte oficial; não são harness do produto | S-18 |
| browser agent, cloud/agendador e colaboração em tempo real | posterior | S-01 |

**Confirmado (S-06, S-18):** o primeiro MVP inclui as capacidades do escopo
declarado acima, exceto as capacidades explicitamente posteriores e as linhas
marcadas como fora do suporte ou dormentes. Direção confirmada não equivale a
implementação aceita.

**Confirmado (S-09):** OpenCode é o runtime primário de agente do unigma,
integrado à experiência do IDE; não é uma ferramenta externa periférica. O
produto deve priorizar uso eficiente de memória e responsividade do desktop.

## harness oficial e distribuição

**Confirmado (S-18):** OpenCode é o único harness/backend local oficial do
produto. A distribuição oficial é `unigma+opencode`, com um perfil
`service-only` que mantém o harness de execução e redireciona TUI, onboarding,
prompts interativos, navegação e UI redundante para a contribuição nativa do
unigma. O detalhe do pipeline está em
[`OPENCODE-SERVICE-ONLY.md`](OPENCODE-SERVICE-ONLY.md).

**Confirmado (S-18):** o decepador é uma cadeia de build, não um mutador da
instalação do usuário: `commit upstream → patch service-only → testes → artefato
versionado`. Atualizações autorizadas substituem o bundle atomicamente quando o
processo está parado e preservam os dados do usuário fora do artefato.

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

**Confirmado (S-11, S-13):** a arquitetura está aprovada e o snapshot inicial
de Code - OSS já foi importado. As features próprias do agente e a integração
funcional com OpenCode ainda não foram implementadas.

**Registro de execução (S-14):** a fundação teve identidade, notices,
proveniência e comandos revisados; typecheck, lint, stylelint e parte do harness
passaram em clone de validação. O build executável e a compatibilidade
multiplataforma continuam sem validação por bloqueios de dependências/toolchain
do upstream. Isso não altera a arquitetura nem autoriza distribuição.

**Registro de execução (S-15):** a instalação root/build e os checks mínimos
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

**Registro de contratos (S-15):** T-010 tem contrato implementado e validado.
T-011, T-012 e T-013 permanecem especificações documentais condicionais, sem
suporte funcional.

**Restrição confirmada (S-01):** não usar nem extrair tokens, caches OAuth,
tráfego interceptado ou meios de contornar entitlement. Integrações devem usar
APIs autorizadas, modelos locais ou interfaces documentadas.

## questões abertas

Ver [DECISIONS.md](DECISIONS.md) para o registro e
[REQUIREMENTS.md](REQUIREMENTS.md#questões-abertas) para pendências que
afetam requisitos.
