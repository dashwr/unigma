# unigma — critérios de aceitação

## estado deste documento

Os critérios abaixo são objetivos, mas só podem ser executados quando houver
um artefato de implementação. Eles verificam os requisitos declarados; não
criam comportamento adicional.

RQ-015 a RQ-021 e D-016 registram direção de produto para Intelligence Index e
Autopilot, não suporte implementado. As linhas AC-016 a AC-024 permanecem
bloqueadas até haver implementação, testes e evidência reproduzível; nenhum
exemplo numérico, inclusive `~49`, é um valor fixo ou normativo.

RQ-022 a RQ-028, RQ-105 e D-017 a D-022 registram a direção de harness, bundle e
capacidades do agente. As linhas AC-025 a AC-028 permanecem bloqueadas até haver
artefato, implementação, testes e evidência reproduzível; o probe de OpenCode
`1.18.23` não prova o bundle service-only. AC-029 registra uma fronteira de
suporte, não uma capacidade adicional do runtime.

| ID | Relacionado a | Critério objetivo e testável | Estado de execução |
| --- | --- | --- | --- |
| AC-001 | RQ-001, RQ-102 | Para toda distribuição que incorpore código de Code - OSS, a revisão de entrega confirma a presença dos avisos, licenças e copyrights aplicáveis. | bloqueado: o auditor encontrou 1.321 entradas `manifest-only` e sete notices sem licença declarada; os artefatos finais preservam os notices conhecidos, mas a classificação completa ainda está pendente |
| AC-002 | RQ-001, RQ-101 | A revisão de identidade e artefatos de distribuição não encontra marca, ícones, binários oficiais, endpoints/chaves Microsoft ou uso do Visual Studio Marketplace sem direito documentado. | parcial/bloqueado: os dois pacotes finais têm metadados próprios, gallery nula e não contêm as quatro extensões externas nem caminhos de Copilot/MSAL; a revisão ampla de referências upstream e direitos ainda não terminou |
| AC-003 | RQ-002 | Em um ambiente de teste, o IDE inicia uma interação com o CLI `opencode serve` por HTTP/SSE documentados e apresenta um resultado ou erro observável ao usuário. | bloqueado: há supervisor/cliente e fixture local provisórios, mas não há sessão integrada à UI nem binário OpenCode fixado |
| AC-004 | RQ-003 | A especificação de implementação define e o teste demonstra: criação/retomada de sessão, apresentação de diff e uma ação explícita de aprovação ou rejeição. | bloqueado: contrato T-010 implementado e validado; UI/runtime e teste integrado ausentes |
| AC-005 | RQ-004 | A especificação de implementação identifica as integrações MCP/plugin/regra aceitas e o teste demonstra carregamento ou recusa conforme essa política. | parcial/bloqueado: workbench classifica MCP instalado/permitido, a bridge de produção workbench↔extension host é serializável e os smokes confirmam gate obrigatório antes de `ProcessManager.ensureStarted()`; plugin/regra ainda não têm fonte conectada, não há evidência contra OpenCode real e a suíte compilada continua bloqueada |
| AC-006 | RQ-005 | A especificação de implementação define e o teste demonstra o ciclo de vida de um subagente ou worktree suportado. | bloqueado: contrato T-010 cobre a mensagem; ciclo de vida e teste integrado ausentes |
| AC-007 | RQ-006 | A especificação de implementação define o fluxo SSH suportado e um teste estabelece ou recusa a conexão conforme a política definida. | parcial/bloqueado: transporte, staging e ativação têm smoke no runner com payload real e confirmação fail-closed, o resolver devolve `ResolvedAuthority` e o smoke/workflow da primeira janela foram implementados; falta colher a matriz oficial no runner, porque nenhuma evidência atual abre uma janela remota num workbench real |
| AC-008 | RQ-007 | A especificação de implementação enumera providers/modelos suportados e testes demonstram a seleção de ao menos uma integração aprovada. | bloqueado: T-011 não anuncia provider/modelo suportado; não há suporte funcional, seleção ou teste |
| AC-009 | RQ-103, RQ-104 | Revisão de código, configuração e documentação não encontra coleta/extração de tokens ou caches OAuth, interceptação de tráfego nem bypass de entitlement; integrações apontam apenas a meios autorizados/documentados. | bloqueado: o slice possui fronteiras/redaction estruturais, mas a revisão integrada e a evidência reproduzível ainda não foram executadas |
| AC-010 | RQ-009 | Em uma distribuição de teste, a interface inicia em inglês e o pacote `pt-BR` pode ser instalado ou ativado pelo mecanismo documentado. | bloqueado: mecanismo pendente |
| AC-011 | RQ-010 | A especificação de tokens define valores verificáveis para roxo, magenta, violeta e cada fundo declarado; a revisão visual de cada tema confirma o uso exclusivo desses tokens para a identidade. | parcial: `unigma Dark`/`unigma Light` existem, são padrão e têm contraste verificado por `build/unigma/verify-theme-contrast.ts` no `test-build-scripts`, com matriz Linux verde em `33713474988`; falta a revisão visual humana e o tema de alto contraste |
| AC-012 | RQ-011 | A identidade distribuída não deve copiar deliberadamente elementos identificáveis do OpenCode. | escopo ajustado por D-030: não é gate formal de entrega; preservar direitos, copyright, licenças e notices aplicáveis |
| AC-013 | RQ-012 | A entrega do MVP fornece artefatos de teste ou distribuição para Windows x64 e Linux x64; a mesma suíte mínima de inicialização é executada com sucesso em ambas as plataformas. | passou no recorte de núcleo: os runs finais `32930950550` (Windows x64) e `32929454545` (Linux x64), head `838ca94e`, publicaram artefatos e executaram a mesma suíte de smoke; o smoke exclui `Terminal Profiles`, `Chat` e `Agents Window` por escopo declarado |
| AC-014 | RQ-013 | Em ambiente de teste, o painel de agente é contribuição nativa do workbench e inicia/controla uma sessão OpenCode sem exigir que o usuário opere uma ferramenta de agente separada. | bloqueado: a contribuição nativa (recorte T-030) compila e o teste browser focado passou localmente, mas sessão/controle integrado, matriz oficial e runner ainda não estão comprovados |
| AC-015 | RQ-014 | O pipeline mede tempo de inicialização e RSS por processo em perfil limpo, idle e sessão ativa; cada regressão é comparada ao baseline versionado da mesma plataforma. | bloqueado: baseline e implementação ausentes |
| AC-016 | RQ-015, RQ-016, RQ-017, RQ-018, RQ-020 | **Direção documental:** o contrato/configuração versionado do router separa Autopilot, modelo selecionado, `persistSelectedModel`, `routerModel`, `maxModel`, referências de índice/custo, bypass, timeout, fallback e privacidade. **Implementação real:** o runtime valida versão e campos, produz decisão/evento observável, respeita trust e política do OpenCode e não registra prompt, raciocínio ou segredo. | bloqueado: T-086 é frente futura; não há schema implementado, runtime ou teste executado |
| AC-017 | RQ-015, RQ-016 | **Direção documental:** o `intelligence index` e o custo têm fonte, versão, proveniência, unidade, revisão e tratamento de ausência/ambiguidade; o índice é aproximado, não é ranking universal e não cria catálogo remoto. `~49` permanece ilustrativo. **Implementação real:** somente referência local explícita e compatível é carregada; dados insuficientes são recusados sem inventar ranking, sincronizar catálogo ou registrar prompt, raciocínio ou segredo. | bloqueado: T-087 é frente futura; não há índice/custo carregado nem evidência |
| AC-018 | RQ-019 | **Direção documental:** quando configurado e disponível, `Luna medium` é chamado sem contexto adicional de sessão, workspace ou histórico, sem pensamento longo e com schema curto, sem endpoint ou credencial oculta. **Implementação real:** fixture/integração controlada comprova payload mínimo e saída validada, com falha observável e nenhum log de prompt, raciocínio ou segredo. | bloqueado: T-088 é frente futura; disponibilidade, chamada e contrato não foram testados |
| AC-019 | RQ-016 | **Direção documental:** a seleção compara somente modelos configurados/autorizados, exige índice suficiente, aplica o teto explícito de `maxModel` e usa custo comparável; `maxModel` não é ranking universal nem valor numérico fixo. **Implementação real:** teste determinístico escolhe o modelo elegível de menor custo e recusa dados ausentes/ambíguos, sem autoescalada e sem log de prompt, raciocínio ou segredo. | bloqueado: T-089 é frente futura; não há seletor, fixture ou evidência |
| AC-020 | RQ-017, RQ-018, RQ-020 | **Direção documental:** Autopilot desligado e `persistSelectedModel` fazem bypass; erro, indisponibilidade, privacidade restritiva, ausência de candidato e timeout retornam ao `selectedModel` validado, com chamada adicional, custo e implicação de privacidade explícitos, sem contornar trust, aprovação, política ou entitlement. **Implementação real:** testes demonstram timeout limitado, fallback seguro/observável ou erro bloqueante quando o modelo selecionado não é válido, sem retry ilimitado e sem log de prompt, raciocínio ou segredo. | bloqueado: T-090 é frente futura; matriz de falhas e implementação ausentes |
| AC-021 | RQ-017, RQ-021 | **Direção documental:** a UI nativa especifica toggle opt-in, estados desligado/pronto/roteando/selecionado/bypass/fallback/timeout/erro/bloqueado, foco, teclado, nome acessível, contraste, estado desligado mais escuro, ligado na cor principal e `prefers-reduced-motion`. **Implementação real:** a contribuição do workbench renderiza os estados sem Webview ou acesso direto a rede/processo, respeita movimento reduzido e fornece evidência renderizada do build/teste real quando a UI existir. | bloqueado: T-091 é frente futura; não há UI, teste de acessibilidade ou evidência renderizada |
| AC-022 | RQ-015, RQ-016, RQ-018, RQ-019, RQ-020 | **Direção documental:** a matriz separa testes unitários, de contrato, recusas, redaction e limites de privacidade. **Implementação real:** o harness existente executa testes determinísticos para schema/versão, índice/custo, payload curto Luna, seleção, bypass, fallback e timeout, sem segundo runner e sem log de prompt, raciocínio ou segredo. | bloqueado: T-092 é frente futura; suíte e fixtures não foram executadas |
| AC-023 | RQ-015, RQ-016, RQ-017, RQ-018, RQ-019, RQ-020, RQ-021 | **Direção documental:** a integração define cenários controlados e métrica versionada para custo/latência da chamada adicional e do modelo final, distinguindo estimativa local de cobrança e proibindo telemetria. **Implementação real:** IDE/runtime/OpenCode controlados demonstram bypass, roteamento, fallback e timeout, com métricas e referências permitidas, nenhum prompt/raciocínio/segredo em artefatos e evidência renderizada quando a UI existir. | bloqueado: T-093 é frente futura; não há integração, métricas ou evidência renderizada |
| AC-024 | RQ-015, RQ-016, RQ-017, RQ-018, RQ-019, RQ-020, RQ-021, RQ-103, RQ-104 | **Direção documental:** a revisão final separa direção, implementação, suporte testado e lacunas. **Implementação real:** a revisão de código, configuração, logs, testes e artefatos confirma fallback seguro, privacidade explícita, nenhum bypass de autorização e nenhum log de prompt, raciocínio ou segredo; qualquer lacuna bloqueia a aceitação e exige evidência renderizada real quando houver UI. | bloqueado: T-094 é frente futura; nenhuma revisão ou evidência final foi executada |
| AC-025 | RQ-022, RQ-023 | **Direção documental:** a matriz identifica `unigma+opencode` como único harness oficial, preserva o harness de execução do OpenCode e redireciona as superfícies service-only para o unigma. **Implementação real:** o artefato empacotado inicia o perfil service-only, sem TUI/onboarding/UI redundante no caminho oficial, e mantém o fluxo HTTP/SSE exigido. | bloqueado: o perfil bundled e sua validação ainda não existem |
| AC-026 | RQ-024, RQ-025 | **Direção documental:** o decepador registra upstream, patchset, hashes, testes, auditoria e manifesto; a atualização troca o bundle atomicamente, permite rollback e não toca os dados do usuário. **Implementação real:** dois artefatos versionados demonstram build reproduzível, rejeição de candidato inválido, troca com processo parado, rollback e preservação de configuração/credenciais/sessões. | bloqueado: T-096 a T-099 são frentes futuras; não há pipeline de bundle aceito |
| AC-027 | RQ-026, RQ-027 | **Direção documental:** o contrato nativo define `@` para ferramentas, `/` para skills, mensagens entre sessões locais e chips `thinking`/`typing`/`idle`, com OpenCode como fonte de verdade. **Implementação real:** testes de UI/runtime demonstram resolução, troca de mensagens, ciclo de vida e acessibilidade sem Webview, rede ou processo na UI. | bloqueado: T-043 e T-044 são frentes futuras |
| AC-028 | RQ-028 | **Direção documental:** o protocolo remoto é versionado e explicitamente dormente. **Implementação real:** testes demonstram serialização/validação dos tipos e inspeção do artefato confirma ausência de listener, cloud, sincronização, colaboração ativa e backend próprio. | bloqueado: T-045 é frente futura |
| AC-029 | RQ-105 | A revisão do core e do artefato confirma ausência de adaptador, catálogo ou carregador oficial para Codex/Claude Code; extensões externas instaladas pelo usuário são identificadas como fora do suporte, e `unigma+pi` como experimental. | direção confirmada; revisão de artefato ainda não executada |

## regra de aprovação

Um critério só passa com evidência reproduzível (teste automatizado, passo de
reprodução registrado ou revisão de artefato). A documentação isolada não prova
um critério; o estado aprovado de AC-013 depende dos runs e artefatos registrados
abaixo.

Para AC-016 a AC-029, direção documental é somente a especificação das tarefas
correspondentes e nunca substitui execução. A evidência deve demonstrar fallback seguro,
ausência de log de prompt, raciocínio e segredo e, quando houver UI, o estado
renderizado no build/teste real; captura de uma especificação ou mock isolado não
aprova a integração.

## plano de fechamento de E-00/E-01

O gate técnico de E-00 já passou nos runs Linux/Windows registrados abaixo. A
próxima rodada não deve repetir smoke sem causa: deve fechar os bloqueios
restantes com evidência específica.

### E-00

- `AC-001`: executar o auditor completo de notices e publicar inventário de
  terceiros sem lacunas não decididas;
- `AC-002`: classificar referências upstream residuais, metadados e superfícies
  excluídas nos artefatos finais;
- `AC-012`: registrar titularidade/autorização e revisão de originalidade e não
  colisão dos ativos finais;
- `AC-013`: manter a aprovação técnica já registrada após o último commit de
  código.

### E-01

- `T-010`: produzir `DuplicateRequestId`/`SessionNotFound` no handler RPC real e
  executar a suíte compilada;
- `T-011`: fixar uma release OpenCode, verificar binários por SHA-256 e testar
  health, `/doc`, `/path`, SSE, sessão, incompatibilidade e provider sem
  credencial;
- `T-012`: integrar preflight de trust/origem/configuração/aprovação para MCP,
  plugin e regra, com decisão sanitizada obrigatória nas duas rotas de startup,
  bridge serializável e recusas de instalação automática, path escape e segredo;
  MCP está conectado no workbench; plugin/regra, suíte compilada e evidência real
  permanecem pendentes;
- `T-013`: executar a matriz SSH contratual e manter transporte remoto em E-05,
  salvo ambiente remoto autorizado para o gate funcional.

O fechamento contratual de E-01 libera o avanço de E-02/E-03 sem converter
fixture em suporte publicado. O plano completo está em
[`planos/2026-08-26-e00-e01.md`](planos/2026-08-26-e00-e01.md).

### barreiras rígidas da rodada 2026-08-26

O plano operacional em [`planos/2026-08-26-e00-e01.md`](planos/2026-08-26-e00-e01.md) substitui
paralelismo implícito por barreiras explícitas:

1. E00-A, E01-A/T-010, E01-B/T-011 e E01-D/T-013;
2. E00-B e E01-C/T-012, somente após a conclusão da onda 1;
3. E01-E, com a consolidação da evidência e builds Linux/Windows sequenciais.

Nenhum critério passa por causa do plano; cada aceite continua exigindo evidência
reproduzível.

## evidência pré-aceite da E-00

Esta evidência registra trabalho executado; só converte um critério quando a
saída reproduzível correspondente está registrada:

- o snapshot Code - OSS, a tag, o SHA, Node/Electron e os alvos foram registrados;
- `LICENSE.txt`, `ThirdPartyNotices.txt`, `product.json`, README e revisão inicial
  de terceiros foram inspecionados;
- parsing de JSON, identidade de distribuição, configuração vazia de
  Copilot/entitlement/voz/CDN, onboarding externo e padrões óbvios de segredo
  passaram na revisão estática do checkout; essa verificação não prova ausência
  de extensões upstream no artefato;
- `npm ci` root/build, `typecheck-client`, `eslint`, `stylelint` e
  `test-build-scripts` passaram no checkout local `E:\unigma`; essa instalação
  com `--ignore-scripts` não completa a árvore nested;
- o upstream orquestra dependências nested pelo `npm install` no root, por meio
  de `preinstall`/`postinstall` em `package.json`, `build/npm/dirs.ts` e
  `build/npm/postinstall.ts`;
- em um ciclo controlado anterior, `compile-client` foi executado no checkout
  local e bloqueou em dependência nested `esbuild` de extensão upstream;
- `compile-client` é o menor compile sem Copilot. A tentativa oficial não foi
  feita porque requer toolchain nativo e ficou bloqueada por
  `MSB8040`/bibliotecas Spectre;
- a tentativa controlada mais recente, com dependências parciais, parou em
  `extensions/github-authentication` por tipos `mocha`/`node` ausentes;
- houve muitos ciclos limitados de dependência nested; a caça incremental foi
  encerrada;
- `test-node` emitiu erro de módulo ausente em `out/` e, portanto, não fornece
  evidência válida de aprovação;
- a execução `32896363977`, no commit `061fc48a`, executou no runner
  `WIREDNEOMKII` o `npm ci`, compile da extensão própria, checks focados,
  empacotamento Windows x64 e smoke do núcleo; todos passaram e o artefato foi
  publicado como `unigma-windows-x64-32896363977`.
- a evidência do artefato registra `platform=windows-x64`,
  `smoke=passed` e `runtime-tests=passed`; o JUnit registra 93 testes, zero
  falhas e 30 ignorados.
- a execução `32916035363`, no commit `24464056`, executou no runner
  `WIREDNEOMKII` o workflow `.github/workflows/unigma-linux-wsl-validation.yml`
  dentro do Ubuntu WSL2; `npm ci`, compile da extensão própria, empacotamento
  `vscode-linux-x64`, smoke e escrita/upload da evidência passaram, publicando
  `unigma-linux-x64-32916035363`.
- a evidência Linux registra `target=linux-x64`, `build-environment=Ubuntu WSL2`,
  `smoke=passed` e `runtime-tests=passed`; o artefato tar.xz foi criado a partir
  do diretório de pacote validado pelo workflow.
- o smoke dessa execução excluiu explicitamente `Terminal Profiles`, `Chat` e
  `Agents Window`; isso é escopo declarado de núcleo, não evidência dessas
  capacidades nem prova de que todas as extensões upstream estejam ausentes do
  pacote.
- a API do GitHub confirmou o artefato `unigma-linux-x64-32916035363`, id
  `9588657070`, com `186066342` bytes. O download foi repetido com timeout de
  300 segundos e terminou com exit code `0`; o wrapper continha o tar, a
  evidência e logs de smoke, e o tar tinha `185507784` bytes.
- a evidência baixada registra o commit
  `2446405698011bef1fd1947f5459b1a64e79781e`, alvo `linux-x64`, runner
  `WIREDNEOMKII`, Ubuntu WSL2, `smoke=passed` e `runtime-tests=passed`.
- dentro do tar Linux, `./resources/app/LICENSE.txt` e o notice raiz estão
  presentes. Seus SHA-256 coincidem com os arquivos do checkout:
  `LICENSE.txt` =
  `cce33203a80863c22499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236` e
  `ThirdPartyNotices.txt` =
  `51b3fd6b279f33c324ba7d32ed9f8849bb51cc2d7c61eaf13c2e8eba5efdd523`.
  Há também três notices de extensões no tar.
- o `product.json` empacotado mantém `unigma` como identidade, MIT, sem
  `extensionsGallery`, feeds, report URL ou voz; porém o `package.json`
  empacotado ainda declara `author.name=Microsoft Corporation` e o repositório
  `https://github.com/microsoft/vscode.git`. O pacote registra versão `1.135.0`,
  compatível com a ressalva de versão interna em `docs/UPSTREAM.md`, mas os
  metadados de autoria/proveniência precisam ser corrigidos ou justificados.
- fora dos logs, o inventário de caminhos do tar encontrou zero caminho de
  Copilot, mas 27 caminhos GitHub, 13 de `microsoft-authentication` e dois
  binários MSAL. Isso não prova ativação, mas prova que as superfícies de
  autenticação foram empacotadas e exigem decisão explícita para o MVP
  local-first.
- o wrapper contém logs de smoke, inclusive arquivos nomeados para autenticação;
  uma varredura local de 427 arquivos/1177 linhas JSON não encontrou chaves de
  autorização, literais Bearer ou valores de access/refresh token. O wrapper de
  CI não deve ser tratado como pacote de distribuição.
- os PNGs de `resources/unigma/` são transparentes e têm dimensões documentadas
  no README, mas a revisão de direitos/originalidade dos ativos ainda não está
  evidenciada; essas mudanças do usuário continuam fora do stage.
- `audit-notices.ts` não produziu relatório neste checkout: o import gerado
  `./parse-notices.js` não existe, só há `parse-notices.ts`, e não há `tsx`
  instalado. O bloqueio foi registrado sem instalar ferramenta ou baixar
  licenças.
- foi tentado um cross-build Linux x64 no runner Windows `WIREDNEOMKII` pela
  workflow `unigma-linux-cross-validation.yml`: no run `32901756829`, os
  probes confirmaram WSL e Docker indisponíveis, enquanto `npm ci` e o compile
  do runtime passaram; o bundle esbuild Linux terminou com `The service was
  stopped`, sem artefato. O rerun do job foi cancelado durante `npm ci` e
  também não produziu artefato. Cross-build em host Windows não é evidência de
  build ou smoke Linux reproduzível.
- a workflow manual `.github/workflows/unigma-self-hosted-validation.yml` foi publicada
  com `runs-on: self-hosted`; a execução `32841175404` não passou do bootstrap do
  Visual Studio (`setup.exe` retornou `-1`) e a execução diagnóstica
  `32841731686` confirmou que o processo do runner não é elevado para instalar as
  bibliotecas Spectre. Nenhum `npm ci`, build, artefato ou smoke foi executado;
  o bloqueio foi mantido por decisão explícita.

### atualização final desta rodada

- o commit `5efc250d` adicionou o auditor `build/unigma/audit-distribution.ts`,
  sem dependências que valida layout, identidade, MIT, URL, metadados próprios,
  gallery nula, hashes de licença/notices, notices de extensão e extensões
  proibidas; o commit `838ca94e` corrigiu o último erro de tipo encontrado no
  compile completo da view nativa;
- o run Linux `32929454545`, head `838ca94e`, passou `npm ci`, compile do
  runtime, testes do runtime, `vscode-linux-x64`, auditoria, smoke e upload.
  O artefato `unigma-linux-x64-32929454545` (id `9593106630`) tem
  `183856993` bytes;
- o tar Linux final tem `2598` membros, nenhuma das quatro extensões proibidas,
  zero caminhos de Copilot/MSAL/Azure/`microsoft-authentication`, e hashes
  iguais ao checkout: `LICENSE.txt` =
  `cce33203a80863c22499035b1cfb6aba5df5f02e4ea2669cf5bc5730c1864236` e
  `ThirdPartyNotices.txt` =
  `51b3fd6b279f33c324ba7d32ed9f8849bb51cc2d7c61eaf13c2e8eba5efdd523`;
- o run Windows `32930950550`, head `838ca94e`, passou pré-requisitos,
  `npm ci`, testes do runtime, `typecheck-client`, `test-build-scripts`,
  `vscode-win32-x64`, auditoria, smoke e upload. O artefato
  `unigma-windows-x64-32930950550` (id `9593599662`) tem `255329029` bytes;
- o ZIP Windows final tem `2171` membros, nenhuma das quatro extensões
  proibidas, hashes de licença/notices iguais ao checkout e os ativos
  `code.ico`, `code_70x70.png` e `code_150x150.png` idênticos às fontes
  versionadas;
- os dois artefatos finais têm `product.json` com identidade `unigma`, MIT,
  URL pública, `extensionsGallery=null`, e `package.json` com autor,
  repositório e bugs próprios. Os logs publicados pelo wrapper não são pacote
  de distribuição.

Portanto, a E-00 tem o gate técnico de build, pacote, auditoria e smoke
reproduzido nos dois alvos, mas permanece parcialmente concluída: AC-001 ainda
exige inventário completo de terceiros/licenças e AC-012 exige revisão
independente de autoria, direitos e não colisão da marca. AC-003 a AC-008 têm
contratos operacionais documentados pela E-01, mas continuam bloqueados por
implementação e evidência integrada; AC-009 a AC-012 e AC-014/AC-015 continuam
bloqueados conforme cada linha acima; AC-013 está atendido apenas no recorte de
núcleo explicitado nesta evidência.

## evidência pré-aceite da E-01

Esta evidência registra a revisão dos contratos, mas não converte critérios em
aceitos:

- T-010 tem contrato implementado e validado estruturalmente: define versão,
  comandos, eventos, estados, erros e `requestId`; a validação de fronteira
  rejeita payloads incompatíveis e campos fora do contrato, sem manter estado de
  sessão ou unicidade de IDs;
- os testes de T-010 cobrem os formatos de comando/evento, payloads incompatíveis
  e campos fora do contrato; `DuplicateRequestId` e `SessionNotFound` são
  verificados somente como códigos presentes em eventos de erro estruturalmente
  válidos, não como erros produzidos pelo runtime;
- a produção semântica de `DuplicateRequestId` e `SessionNotFound`, com os testes
  correspondentes da camada de aplicação, permanece pendente em E-02, em
  especial T-024;
- T-011 tem evidência de probe real contra `/usr/bin/opencode` `1.18.23`
  (SHA-256 `f80650dcfc1308afaecc2d343c9a0a52fdc2dacd49150b7256a000acf068799f`):
  health, OpenAPI 3.1, `/path`, SSE, sessão, prompt e abort passaram;
  `OpenCodeHttpClient.connect()` real também passou; nenhum provider/modelo é
  anunciado como suportado; a suíte-fonte ainda está
  bloqueada pela ausência de `mocha`;
- T-021/T-022/T-023 têm adapters e fixtures locais provisórios no checkout, com
  testes fonte para processo, HTTP/SSE, persistência mínima, redaction e
  composição; o compile da extensão e o `npm --prefix
  extensions/unigma-agent-runtime test` passaram nos dois runs finais. A fixture
  não é evidência contra um binário OpenCode real e não altera o estado
  condicional de T-011;
- T-012 define fontes explícitas, gates de trust/aprovação, recusa e redaction,
  sem catálogo, instalação ou persistência própria; o workbench classifica MCP e
  as rotas de runtime exigem decisão sanitizada antes de `ProcessManager.ensureStarted()`;
  plugin/regra ainda não têm fontes conectadas;
- T-013 é especificação documental condicional: define a matriz contratual,
  OpenSSH/`known_hosts`, limites de provisionamento, falhas e reconexão, sem
  executar conexão ou bootstrap remoto.
- com Node portátil `24.18.0`, o typecheck equivalente a `typecheck-client`, o
  ESLint focado nos dois arquivos TypeScript e um smoke direto do protocolo
  passaram; o harness Mocha não foi executado porque os módulos compilados em
  `out/` não existem.
- no runner self-hosted, o head `838ca94e` passou `typecheck-client`,
  `test-build-scripts` e os testes compilados da extensão própria; isso valida o
  harness do runtime, não integração com OpenCode, provider, MCP/plugin ou SSH
  reais.

Os contratos e documentos da E-01 continuam especificações condicionais; T-010
tem validação estrutural e código de aplicação compilado, mas a suíte dedicada
da camada de workbench ainda não foi executada. Teste contra OpenCode real,
integração, produção dos erros na camada de aplicação, SSH e evidência de
segurança permanecem obrigatórios nas tarefas posteriores.

## pendências

Os critérios AC-003 a AC-008 têm arquitetura e contratos operacionais aprovados,
mas requerem implementação e evidência reproduzível; AC-008 também requer uma
combinação provider/modelo efetivamente testada.

AC-016 a AC-024 correspondem à direção confirmada de RQ-015 a RQ-021, e AC-025 a
AC-029 à direção de RQ-022 a RQ-028/RQ-105. Todos continuam bloqueados pelas
respectivas tarefas, implementação, testes e evidência. A direção não fixa a
fórmula ou os valores do índice/custo, não transforma `~49` em limite, não cria
catálogo remoto, não autoriza telemetria ou persistência de prompt/raciocínio/
segredo e não transforma o probe OpenCode em suporte do bundle.
