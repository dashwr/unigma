# unigma - politica de integracoes locais

> **status:** politica documental de T-012 da E-01 com camada de preflight e
> bridge serializavel de startup implementadas. Ela ainda nao prova carregamento
> ou recusa contra um processo OpenCode real.
> Ela define o comportamento minimo para MCP, plugins e regras que venham a
> ser encaminhados ao OpenCode. Nao cria catalogo, instalador, servico,
> armazenamento ou mecanismo de autorizacao proprio.

## 1. Escopo e principios

Esta politica se aplica antes de uma integracao ser carregada, iniciada,
conectada ou incluida no contexto de uma sessao OpenCode. Ela vale para o
ambiente local e para o host remoto quando o OpenCode estiver sendo executado
por um extension host remoto.

Os principios sao:

1. OpenCode, os arquivos de configuracao do usuario e o filesystem sao as
   fontes de verdade. unigma somente apresenta, valida na fronteira e
   encaminha referencias ou configuracao conforme uma interface documentada.
2. Um formato somente e aceito quando a documentacao oficial do OpenCode o
   define para a versao/protocolo em uso. Campo, extensao, endpoint ou
   comportamento nao documentado e recusado, nao inferido.
3. Uma fonte local nao e automaticamente confiavel. Localizacao explicita,
   workspace confiavel e aprovacao do usuario sao gates independentes.
4. A politica do OpenCode continua sendo a autoridade para permissoes de
   ferramentas. unigma nao autoaprova, nao usa modo automatico para contornar
   uma pergunta e nao transforma uma regra em permissao.
5. O limite de isolamento e a fronteira do processo e do modulo: a UI nativa
   nao executa processo, rede ou arquivo. Nao ha promessa de sandbox adicional;
   plugin local e MCP local podem executar com os privilegios do usuario e do
   processo OpenCode.
6. Nenhuma configuracao, credencial, prompt, diff, conteudo de arquivo ou
   aprovacao e duplicado para um catalogo ou banco unigma.

O carregador e as fontes nativas do OpenCode sao a superficie oficial para
plugins, MCP, rules e skills. O unigma nao cria um Marketplace ou um segundo
carregador. Uma extensao externa de Code - OSS, inclusive Codex ou Claude Code,
pode ser instalada diretamente pelo usuario, mas permanece fora do suporte
oficial e nao altera o harness `unigma+opencode`.

Esta politica nao amplia o escopo para backend, cloud, conta, RBAC, telemetria,
Marketplace proprio ou distribuicao de integracoes. Uma extensao externa obtida
por iniciativa do usuario continua fora do suporte do unigma.

## 2. Fontes explicitas

### 2.1 Definicao

Fonte explicita e aquela que o usuario consegue identificar e autorizar antes
do carregamento: um arquivo local de configuracao, um diretorio local
documentado ou uma entrada de configuracao do projeto. A mera existencia de um
arquivo, pacote, URL ou variavel de ambiente nao e consentimento.

O conjunto de fontes locais documentadas pelo OpenCode que pode ser avaliado e:

- configuracao global local `~/.config/opencode/opencode.json` ou
  `opencode.jsonc`;
- configuracao do projeto `opencode.json` ou `opencode.jsonc` na raiz do
  workspace confiavel;
- um caminho de configuracao local escolhido explicitamente pelo usuario por
  `OPENCODE_CONFIG`;
- um diretorio de configuracao local escolhido explicitamente pelo usuario por
  `OPENCODE_CONFIG_DIR`;
- diretorios `.opencode/` do projeto e `~/.config/opencode/` para os tipos de
  arquivo que o OpenCode documenta, incluindo `plugins/`;
- arquivos locais apontados por `instructions` em uma configuracao OpenCode
  explicitamente autorizada.

O mecanismo de precedencia e merge pertence ao OpenCode. Antes de aceitar o
resultado, a implementacao deve conseguir identificar a origem efetiva de cada
integracao. Uma fonte de maior precedencia nao pode ocultar silenciosamente
uma fonte recusada.

Nao fazem parte do conjunto atual de fontes aprovadas:

- configuracao remota automatica, como `.well-known/opencode`;
- URLs remotas em `instructions`;
- configuracao inline ou variaveis de ambiente herdadas sem selecao explicita
  e apresentacao ao usuario;
- descoberta por catalogo, registry, Marketplace ou recomendacao de pacote;
- qualquer fonte que dependa de baixar ou instalar algo durante o startup.

Essa restricao trata de fontes de configuracao ocultas, nao de referencias
documentadas como `{env:VAR}` ou `{file:path}` dentro de uma configuracao ja
aprovada. Nesses casos, o OpenCode resolve a referencia; unigma nao le, copia,
persiste ou registra o valor resolvido.

Um MCP remoto nao e uma excecao a esta regra: o endpoint pode ser remoto, mas a
entrada que o referencia precisa estar em uma configuracao local explicita e a
conexao exige aprovacao separada.

### 2.2 Formatos aceitos

Os formatos abaixo sao os unicos cobertos por esta politica. A lista descreve
os formatos documentados pelo OpenCode, nao uma API nova de unigma.

| Tipo | Fonte e formato documentado | Condicoes adicionais |
| --- | --- | --- |
| MCP local | Entrada `mcp.<nome>` em JSON/JSONC com `type: "local"`, `command` como array e, quando aplicavel, `cwd`, `environment`, `enabled` e `timeout`. | O executavel precisa ser fornecido pelo usuario e estar disponivel antes do carregamento. O comando nao pode instalar, baixar ou atualizar dependencias. `cwd` deve permanecer no workspace ou em um caminho local explicitamente aprovado. |
| MCP remoto | Entrada `mcp.<nome>` em JSON/JSONC com `type: "remote"`, `url` e, quando aplicavel, `enabled`, `headers`, `oauth` e `timeout`. | O URL deve ser apresentado e aprovado antes da conexao. Para rede nao local, exige HTTPS. OAuth, headers e tokens permanecem sob responsabilidade do OpenCode; unigma nao os le, resolve, copia ou registra. |
| Plugin local | Modulo JavaScript ou TypeScript em `.opencode/plugins/` do projeto ou em `~/.config/opencode/plugins/`, conforme documentacao do OpenCode. | O modulo e tratado como codigo executavel. Carregamento automatico pelo OpenCode nao substitui aprovacao. Dependencias que acionem instalacao no startup sao recusadas. |
| Regra de projeto | `AGENTS.md` local ou arquivo local referenciado por `instructions`; `CLAUDE.md` somente quando a compatibilidade documentada estiver explicitamente habilitada. | O caminho deve resolver dentro do workspace confiavel. O texto e contexto nao confiavel, nao autoridade de seguranca, e nao pode conceder permissao. |
| Regra global | `~/.config/opencode/AGENTS.md`, ou outro arquivo local explicitamente referenciado por `instructions`. | Exige opt-in explicito. Nao e aplicada automaticamente a um workspace nao confiavel. |

O documento de configuracao deve ser JSON ou JSONC conforme a documentacao do
OpenCode e sua estrutura deve ser validavel pelo schema oficial correspondente.
Chaves, tipos, extensoes e campos adicionais que nao estejam documentados para
a versao em uso nao sao aceitos.

## 3. Trust e carregamento

### 3.0 Preflight implementado

`src/vs/workbench/contrib/unigmaAgent/common/localIntegrationPolicy.ts` recebe
somente classificacoes sanitizadas de tipo, origem, escopo de caminho, schema,
comando, dependencia, URL, OAuth, precedencia e aprovacao. Nao recebe nem
retorna configuracao bruta, caminho, argumento de comando, URL, regra, header,
ambiente ou credencial. A decisao retorna apenas tipo, classificacao de origem,
classificacao de caminho e estado de aprovacao, mais um codigo de recusa quando
aplicavel.

O preflight recusa deterministicamente workspace nao confiavel, origem remota
ou desconhecida, precedencia ambigua, escape de caminho, symlink externo,
caminho indisponivel, schema invalido, comando instalador (inclusive
classificacoes para `npx -y` e `bun x`), plugin npm, dependencia que instale no
startup, URL inseguro ou desconhecido, OAuth silencioso e aprovacao ausente.

O runtime exige uma decisao sanitizada em
`RuntimePorts.localIntegrationPreflight` imediatamente antes de
`ProcessManager.ensureStarted()`. Uma recusa registra somente o codigo estatico
`runtime.integration.refused.*`, nao inicia o processo e nao executa teardown de
processo que ainda nao existe. A ausencia da decisao recusa a rota com
`unknownOrigin`; nunca existe allow implicito. O extension host revalida a
decisao recebida antes de iniciar o processo; como ainda nao possui um
classificador proprio de plugin/regra, a composicao de producao recusa com
`unknownOrigin` em vez de confiar cegamente no `{ accepted: true }` recebido.

O workbench agora classifica MCPs instalados e permitidos, alem de aceitar fontes
explicitamente classificadas de plugin e regra, usando somente categorias
sanitizadas. O contrato de transporte aceita apenas `{ accepted }` ou
`{ accepted, code }`. A bridge valida a decisao novamente antes do startup e as
rotas sem decisao recusam. Plugin e regra ainda nao possuem descoberta conectada
neste ciclo; portanto uma decisao aceita nao constitui clearance para esses tipos,
e T-012 continua parcial ate que sejam enumerados ou explicitamente desabilitados.
Enquanto esse inventario nao existe, a view marca a precondicao como incompleta e
recusa o startup com `unknownOrigin`, inclusive quando a lista de MCP esta vazia.

A ponte de producao entre `IUnigmaAgentRpcTransport` no workbench e
`RuntimeTransportBridge` no extension host usa os comandos internos
`unigma.agent.runtime.transport.send` e
`unigma.agent.runtime.transport.event`. O primeiro recebe somente um envelope
serializavel e retorna `void`; o segundo encaminha eventos validados para a UI.
Nao existe retorno de objeto com metodos/eventos por `executeCommand`.

### 3.1 Gates

Nenhuma integracao ou regra e encaminhada ao OpenCode quando o workspace esta
nao confiavel. Nesse estado, unigma nao inicia o agente para esse workspace,
nao inicia MCP local, nao conecta MCP remoto, nao carrega plugin e nao inclui
regras do workspace ou globais no contexto do agente.

Workspace Trust e uma decisao local do usuario no Code - OSS. Nao e conta,
identidade, RBAC, classificacao de organizacao ou prova de que o codigo e
seguro. Tambem nao concede privilegios fora dos que o usuario e o sistema
operacional ja possuem.

Mesmo em workspace confiavel, o carregamento exige todos os passos:

1. localizar somente as fontes documentadas e explicitamente selecionadas;
2. resolver o caminho e verificar que ele nao escapa do escopo aprovado;
3. validar formato, campos obrigatorios, tipos, precedencia e configuracao;
4. mostrar ao usuario o tipo, a origem e o efeito esperado, com dados sensiveis
   redigidos;
5. obter aprovacao explicita para carregar o plugin, iniciar/conectar o MCP ou
   incluir a regra no contexto;
6. encaminhar a configuracao ou referencia ao OpenCode pela interface
   documentada, sem executar a integracao na UI de unigma.

Se a confianca for removida, uma integracao ativa deve ser interrompida ou
suspensa antes de novos efeitos e precisa passar pelos gates novamente. Uma
aprovacao anterior nao e restaurada automaticamente depois de reinicio,
reconexao ou mudanca de workspace.

### 3.2 Plugin e carregamento automatico

O OpenCode documenta que plugins locais em seus diretorios convencionais podem
ser carregados no startup. Esse comportamento nao constitui autorizacao para o
unigma. O runtime deve iniciar o OpenCode somente quando puder garantir que
nenhum plugin nao aprovado sera carregado; se a fronteira documentada do
OpenCode nao permitir esse gate, a sessao e recusada em vez de iniciar de forma
ambigua.

O mesmo principio vale para regras descobertas automaticamente: descoberta nao
e consentimento. A regra deve vir de uma fonte aprovada, ser visivel como
origem do contexto e continuar sujeita a todas as aprovacoes de efeitos.

## 4. Recusa e configuracao invalida

Uma entrada e recusada sem correcao, reescrita, fallback permissivo ou tentativa
de instalacao quando ocorrer qualquer uma destas situacoes:

- JSON/JSONC ilegivel, schema invalido, campo obrigatorio ausente, tipo
  incorreto ou chave nao documentada;
- nome duplicado, caminho inexistente, caminho fora do escopo aprovado,
  traversal, link ou redirecionamento para fora do escopo;
- workspace nao confiavel ou aprovacao ausente;
- plugin npm ou qualquer plugin que exija `bun install` ou outra instalacao no
  startup;
- comando MCP que use instalador, download, `npx -y`, `bun x`, pipeline de
  download ou equivalente para obter codigo durante a execucao;
- regra remota, configuracao remota automatica ou origem nao identificavel;
- MCP remoto sem URL explicito, com URL nao seguro para o contexto ou com
  tentativa de ignorar validacao TLS;
- configuracao efetiva cuja precedencia ou origem nao possa ser explicada ao
  usuario.

O formato `plugin` com nomes de pacotes npm e documentado pelo OpenCode, mas e
explicitamente excluido desta politica porque o OpenCode pode instalar esses
pacotes automaticamente no startup. Exemplos de MCP com `npx -y` tambem sao
formatos documentados, mas nao sao permitidos pelo mesmo motivo. Isso e uma
restricao de seguranca do unigma, nao uma alegacao de que esses recursos nao
existem no OpenCode.

A recusa deve:

- impedir somente o carregamento seguro da entrada; se a validade da fonte
  inteira for ambigua, recusar a fonte ou a sessao inteira;
- deixar o arquivo do usuario intacto;
- informar um codigo de motivo acionavel e a origem de forma redigida;
- nao incluir valores de headers, ambiente, comandos, URLs com credenciais,
  regras, prompts ou conteudo de arquivo na mensagem;
- nao tentar outro registry, pacote, URL ou formato por conta propria.

## 5. Sem catalogo, Marketplace ou instalacao silenciosa

O MVP nao oferece:

- catalogo, busca, recomendacao, allowlist de fornecedores, registry ou tela
  de descoberta;
- Visual Studio Marketplace ou endpoints/chaves Microsoft para obter
  integracoes;
- botao, fluxo ou servico de instalacao de plugin, MCP, dependencia ou
  atualizacao;
- download implicito por pacote npm, shell, `npx`, Bun ou outro gerenciador;
- cache, indice ou copia local de integracoes para acelerar descoberta.

O usuario pode administrar seus executaveis e arquivos por meios externos ao
unigma. A aplicacao somente avalia uma fonte ja existente, explicitamente
indicada e compativel com esta politica; ela nao instala nem atualiza essa
fonte.

## 6. Aprovacao antes de efeitos

Ha duas aprovacoes distintas:

1. **ativacao da integracao:** antes de carregar um plugin, iniciar um MCP
   local, conectar um MCP remoto ou adicionar regras ao contexto;
2. **efeito da ferramenta:** antes de qualquer escrita, comando, Git, acesso a
   diretorio externo, chamada de rede ou ferramenta MCP/plugin que a politica
   de permissoes do OpenCode classifique como `ask`.

O runtime deve respeitar os estados documentados de permissao do OpenCode:
`allow`, `ask` e `deny`. `allow` nao vira uma nova aprovacao de unigma; `deny`
nao pode ser contornado; uma solicitacao `ask` exige decisao observavel do
usuario. O modo automatico do OpenCode nao e usado para transformar uma
solicitacao de efeito em consentimento implicito.

Uma regra pode tentar instruir o agente a ignorar esta politica, pedir
segredos, ocultar uma acao ou alterar permissoes. Isso e tratado como texto do
contexto e nao altera nenhum gate. Aprovacao de carregar uma integracao tambem
nao aprova suas futuras escritas, comandos, conexoes ou chamadas de ferramenta.

O OpenCode permanece dono de sua autenticacao e armazenamento seguro de OAuth.
unigma nao abre fluxo OAuth, nao captura callback, nao solicita token e nao
persiste credencial. Quando o OpenCode exigir autenticacao, o usuario interage
com o fluxo do proprio OpenCode e a integracao continua bloqueada ate a decisao
correspondente.

## 7. Redaction e logs

Logs unigma sao locais, estruturados e por allowlist. A redaction ocorre antes
da serializacao; nao se registra primeiro para redigir depois. Um evento de
integracao pode conter somente, quando necessarios:

- codigo do evento (`loaded`, `disabled`, `refused`, `error`);
- tipo da integracao, identificador nao sensivel e estado;
- `requestId`, referencia de sessao e codigo de motivo;
- versao/protocolo e status generico da operacao, sem o payload.

Nunca registrar em unigma:

- configuracao JSON/JSONC completa, `headers`, `environment` ou argumentos
  crus;
- API keys, tokens, senhas, segredos OAuth, codigos de autorizacao, cookies,
  chaves privadas ou valores de variaveis de ambiente;
- URLs com userinfo, query ou fragmento sensivel; caminhos absolutos que
  exponham dados pessoais quando uma referencia relativa bastar;
- prompt, regra, codigo de plugin, conteudo de arquivo, diff, resultado de
  ferramenta ou resposta MCP;
- stdout/stderr bruto de plugin, MCP, OpenCode ou processo filho.

Campos sensiveis conhecidos sao substituidos por `[REDACTED]`; objetos ou
payloads cujo formato nao possa ser redigido com seguranca sao descartados do
log. Logs do proprio OpenCode permanecem na ferramenta dele e nao sao copiados
indiscriminadamente por unigma. Nao ha telemetria nem envio de logs para um
servico remoto.

## 8. Fonte de verdade e dados

| Dado | Fonte de verdade | Tratamento de unigma |
| --- | --- | --- |
| Configuracao MCP/plugin/regra | Arquivo do usuario e OpenCode | consulta ou encaminha referencia/configuracao sem duplicar o conteudo |
| Credencial, OAuth, header secreto e ambiente | OpenCode, sistema operacional ou fonte administrada pelo usuario | nao ler para uso proprio, nao copiar, nao persistir e nao registrar |
| Sessao, estado, ferramenta e permissao | OpenCode/SSE | apresenta referencia e estado validado; nao cria copia duravel |
| Aprovacao de ativacao e de efeito | usuario + OpenCode, enquanto a sessao esta ativa | memoria transitória; nao restaurar automaticamente |
| Diagnostico | logs locais do Code - OSS | allowlist e redaction; sem telemetria |

Nao criar estado proprio para catalogo, reputacao, trust global, permissao,
credencial, historico de regra, snapshot de configuracao ou cache de pacote.
Trust do workspace e aprovacao sao gates operacionais locais, nao um modelo de
identidade ou RBAC.

## 9. Evidencia esperada

Esta politica define a especificacao de T-012, mas nao aprova AC-005 por si
so. A implementacao futura deve fornecer evidencia reproduzivel de, no minimo:

- carregamento aprovado de MCP local sem instalacao, MCP remoto explicitamente
  configurado, plugin local e regra local;
- recusa de plugin npm, comando instalador, fonte remota de regra, path escape,
  configuracao invalida e workspace nao confiavel;
- ausencia de autoaprovacao e bloqueio de efeitos quando a aprovacao e negada;
- logs de sucesso e recusa sem segredo, prompt, diff, regra ou conteudo de
  arquivo;
- nenhuma alteracao ou persistencia fora das fontes de verdade previstas.

## Referencias

- [Arquitetura](ARCHITECTURE.md), especialmente as secoes de autorizacao,
  dados e observabilidade.
- [Perfil OpenCode service-only](OPENCODE-SERVICE-ONLY.md), para a fronteira do
  harness bundled e das extensoes externas.
- [Fluxos](FLOWS.md), especialmente F-004.
- [Modelo de dados](DATA-MODEL.md), especialmente fontes de verdade e dados
  deliberadamente ausentes.
- [Requisitos](REQUIREMENTS.md): RQ-004, RQ-103 e RQ-104.
- [Aceitacao](ACCEPTANCE.md#estado-deste-documento): AC-005 e AC-009.
- Documentacao oficial do OpenCode consultada em 2026-08-23: Config, MCP
  servers, Plugins, Rules e Permissions; a interface de servidor registrada
  pelo projeto esta em [OpenCode server](https://opencode.ai/docs/server).
