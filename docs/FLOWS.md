# unigma — fluxos

## estado deste documento

Os fluxos abaixo registram as fronteiras da arquitetura aprovada. Eles não são
contratos detalhados de interface nem comportamento implementado.

## F-001 — iniciar uma interação com OpenCode

```text
usuário no IDE
  -> superfície unigma para agente
  -> runtime interno inicia/reutiliza `opencode serve` no extension host
  -> integração HTTP/SSE por loopback
  -> OpenCode executa a sessão
  -> eventos/resultado retornam à superfície do IDE
```

**Base:** S-01 declara a integração de agente; S-04 confirma que OpenCode
expõe servidor com OpenAPI e SSE. A arquitetura aprovada em
[ARCHITECTURE.md](ARCHITECTURE.md) define processo supervisionado, UI nativa do
workbench e comunicação HTTP/SSE.

## F-002 — revisão de alteração proposta pelo agente

```text
agente produz alteração
  -> IDE apresenta diff
  -> usuário revisa
  -> usuário aprova ou rejeita
  -> ação correspondente é aplicada ou descartada
```

**Base:** S-01 declara sessões, diffs e aprovações. A arquitetura aprovada
exige aprovação explícita e não restaura aprovação pendente; granularidade e
rollback continuam como especificação de implementação posterior.

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
  -> unigma/OpenCode descobre ou carrega a integração
  -> integração fica disponível ao fluxo de agente
```

**Base:** S-01 declara MCP e plugins; S-04 confirma interfaces públicas do
OpenCode. A arquitetura limita o MVP a configuração local explícita, sem
catálogo nem marketplace Microsoft; a política detalhada continua pendente.

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

## questões abertas por fluxo

- F-001: tratamento de falhas, reinício e reconexão.
- F-002: escopo de aprovação, visualização e aplicação de mudanças.
- F-003: provisionamento e matriz de compatibilidade do servidor remoto.
- F-004: fontes permitidas, configuração, isolamento e regras.
- F-005: fórmula do índice, pesquisa/benchmark, preços, elegibilidade e
  atualização das referências.

Nenhuma dessas questões é resolvida por este documento.
