# unigma - contrato SSH remoto

> **escopo:** T-013 do épico E-01.
>
> Este documento fixa o contrato operacional mínimo para SSH remoto. Ele é uma
> especificação, não implementa transporte, provisionamento, servidor remoto ou
> suporte de distribuição. Nenhuma linha abaixo deve ser lida como evidência de
> que a integração já funciona.

## 1. Fronteiras e autoridade

| termo | significado neste contrato |
| --- | --- |
| cliente | desktop unigma e a máquina em que o workbench e o cliente OpenSSH são executados |
| host remoto | máquina alcançada pelo `sshd`, onde está o workspace remoto |
| servidor remoto Code-OSS | componente de autoridade remota que permite o extension host remoto; não é o `sshd` |
| autoridade remota | autoridade `vscode-remote://` resolvida pelo Code-OSS; sua forma de referência é `ssh-remote+<alvo>` |
| runtime do agente | `unigma-agent-runtime`, executado no extension host que possui o workspace |

O `unigma-remote-ssh` será a autoridade remota do Code-OSS. No lado do cliente
ela delegará conexão, configuração, autenticação e verificação de host ao
cliente **OpenSSH** já disponível no sistema. Não haverá um transporte SSH
alternativo, um relay unigma, uma API de rede própria ou um servidor unigma.

`<alvo>` é somente um identificador SSH sem material secreto: primeiro o alias
do `ssh_config`; na ausência de alias, um identificador canônico equivalente a
`user@host:port`, com a codificação necessária para a URI. A autoridade não
contém senha, passphrase, caminho de chave privada, token, conteúdo de arquivo ou
workspace. Ela identifica uma conexão; não é um endpoint TCP público.

O `sshd`, a conta remota, o `authorized_keys` e as permissões do host remoto são
pré-condições administradas pelo usuário ou pelo administrador do host. unigma
não instala nem configura o `sshd`.

## 2. Matriz mínima

As linhas locais são alvos de plataforma. As linhas remotas Linux são o menor
alvo remoto contratual, ainda sem suporte implementado. A evidência de suporte
remoto só poderá ser declarada após T-050, T-051 e T-053. Windows x64 continua
sendo um cliente local válido, mas não é declarado como host remoto neste MVP.

| cliente desktop | host do workspace | modo | extension host do runtime | `opencode serve` | decisão de T-013 |
| --- | --- | --- | --- | --- | --- |
| Windows x64 | o mesmo Windows x64 | local | local | local, no mesmo host | alvo local; não implementado por T-013 |
| Linux x64 | o mesmo Linux x64 | local | local | local, no mesmo host | alvo local; não implementado por T-013 |
| Windows x64 | Linux x64 remoto | OpenSSH | remoto, no Linux x64 | remoto, no Linux x64 | alvo remoto mínimo; não é suporte publicado |
| Linux x64 | Linux x64 remoto | OpenSSH | remoto, no Linux x64 | remoto, no Linux x64 | alvo remoto mínimo; não é suporte publicado |
| Windows x64 | Windows x64 remoto | OpenSSH | não aplicável | não aplicável | recusado; suporte de host Windows não declarado |
| Linux x64 | Windows x64 remoto | OpenSSH | não aplicável | não aplicável | recusado; suporte de host Windows não declarado |
| qualquer cliente ou host fora de Windows/Linux x64 | qualquer | qualquer | não aplicável | não aplicável | recusado; fora da matriz |

Esta matriz não promete uma distribuição Linux específica, libc, shell,
topologia de proxy, arquitetura diferente de x64 ou extensão de configuração
não validada. Tais combinações exigem contrato e evidência novos.

### 2.1 Política de pré-conexão T-013

`evaluateRemoteSshConnection` é uma política pura para fixture/teste, não uma
implementação de transporte. A combinação só é aceita quando todos os gates
abaixo são válidos; qualquer estado ausente ou recusado termina na categoria
indicada e não inicia OpenSSH, autenticação, provisionamento ou replay.

| gate | estado aceito | recusa fail-closed |
| --- | --- | --- |
| confiança do workspace | confiável | `ssh.workspace-blocked` |
| plataforma | cliente Windows x64 ou Linux x64 e host Linux x64 | `ssh.remote-platform-unsupported` |
| cliente | OpenSSH disponível | `ssh.client-unavailable` |
| destino | alias ou identificador SSH válido | `ssh.target-unresolved` |
| host key | confiável pelo OpenSSH | `ssh.host-key-untrusted` |
| canal | conexão não interrompida | `ssh.connection-lost` |
| servidor remoto | build/protocolo compatível | `ssh.remote-server-incompatible` |

Os estados `unknown`, `mismatched` e `revoked` de host key são todos recusados
como `ssh.host-key-untrusted`. A política não resolve aliases, executa OpenSSH,
acessa `known_hosts`, solicita credenciais, tenta fallback local nem reconecta.

## 3. Local de execução

| contexto | workbench e autoridade | extension host | runtime e processo OpenCode |
| --- | --- | --- | --- |
| workspace local | cliente local | local | `unigma-agent-runtime` inicia ou reutiliza um `opencode serve` local por extension host; o serviço fica no loopback local |
| workspace remoto | workbench e autoridade OpenSSH locais | remoto, no host do workspace | `unigma-agent-runtime` inicia ou reutiliza um `opencode serve` remoto; o serviço fica no loopback remoto |

Em uma janela remota, não se inicia um segundo OpenCode local para o mesmo
workspace. O loopback remoto não é o loopback do desktop: o acesso ao serviço
ocorre somente pela autoridade remota já estabelecida. A regra de no máximo uma
instância por extension host permanece válida.

O caminho, Git, worktrees, terminal e ferramentas do agente pertencem ao host
que contém o workspace. A UI local não acessa processo, segredo ou filesystem
remoto diretamente; usa as fronteiras do Code-OSS e do runtime.

## 4. OpenSSH, `known_hosts` e autenticação

### 4.1 OpenSSH como fonte de verdade

- O cliente OpenSSH do sistema é obrigatório no lado cliente; ausência,
  incompatibilidade ou falha de execução encerra a conexão.
- A configuração SSH do usuário e a resolução efetiva feita pelo OpenSSH são a
  autoridade para host, porta, usuário, `IdentityAgent`, `IdentityFile`,
  `UserKnownHostsFile` e demais opções que o cliente suportar.
- A extensão deve entregar o alvo ao OpenSSH, não reimplementar o protocolo SSH
  nem interpretar chaves privadas.
- unigma não adiciona opções que enfraqueçam a verificação, como
  `StrictHostKeyChecking=no`, nem usa `ssh-keyscan` para estabelecer confiança.

### 4.2 `known_hosts`

Os arquivos `known_hosts` já administrados pelo usuário, conforme a configuração
resolvida pelo OpenSSH, são a fonte de confiança do host. unigma não cria uma
segunda autoridade de host keys e não escreve, copia, migra ou corrige esses
arquivos.

| resultado da verificação OpenSSH | comportamento contratual |
| --- | --- |
| chave corresponde a uma entrada confiável ou a uma autoridade configurada e validada pelo OpenSSH | pode continuar para autenticação |
| host ou chave desconhecida | recusar; o usuário deve estabelecer confiança por seu fluxo OpenSSH e tentar novamente |
| chave diferente da entrada existente | recusar sem opção de ignorar; tratar como possível impersonação ou rotação que precisa ser corrigida pelo usuário |
| chave revogada | recusar |
| configuração efetiva aceita host desconhecido sem verificação confiável | recusar; unigma não transforma uma política insegura em conexão remota |

A verificação de host acontece antes de expor autenticação ao servidor. Uma
recusa de `known_hosts` não pode cair em prompt de senha, passphrase ou agente.

### 4.3 Agente e chaves do usuário

- A autenticação usa o agente SSH e as chaves já configurados pelo usuário,
  através do OpenSSH.
- O usuário administra previamente o agente, o `authorized_keys`, as chaves,
  seus desbloqueios e qualquer política externa de MFA.
- unigma não solicita, gera, importa, exporta, enumera, copia ou persiste chave
  privada, chave pública como credencial, senha, passphrase, token ou socket do
  agente.
- Se o OpenSSH exigir qualquer credencial ou resposta interativa, a tentativa é
  encerrada como autenticação indisponível. O usuário corrige a configuração fora
  de unigma; a UI não abre um coletor de credenciais.
- unigma usa o agente local para autenticar a conexão. Não ativa encaminhamento
  de agente para o host remoto. Esse caso exigiria uma decisão de segurança
  separada.

## 5. Provisionamento permitido e recusado

Provisionar aqui significa somente preparar o componente remoto Code-OSS
necessário para a autoridade remota. Não significa instalar ou alterar o
OpenSSH do host.

### Permitido pelo contrato

1. Em uma ação explícita de conexão, depois dos gates de workspace confiável e
   confiança SSH, instalar ou reutilizar o servidor remoto Code-OSS compatível
   com o cliente unigma.
2. Manter esse componente em área pertencente ao usuário remoto, sem elevação,
   sem serviço de sistema e sem alteração de arquivos de administração do host.
3. Iniciar, supervisionar e encerrar somente o processo remoto que a própria
   autoridade criou, preservando processos externos ou de outra janela.
4. Transferir, quando T-050 definir o mecanismo, somente o payload do servidor
   remoto necessário à mesma build do cliente. O método de bootstrap ainda não
   é especificado por T-013.

### Identidade do componente remoto

O servidor remoto é o `unigma-server` construído deste fork (`D-028`), não o
servidor Code - OSS upstream: o extension host remoto precisa das extensões
internas do unigma. `product.json` já fixa
`serverApplicationName: "unigma-server"` e `serverDataFolderName: ".unigma-server"`.

O mecanismo de entrega — pré-instalado pelo responsável, enviado pelo cliente
pela própria sessão OpenSSH ou baixado de um endpoint próprio — permanece aberto
como `Q-2` em
[`planos/2026-08-29-cli-ssh-remoto.md`](planos/2026-08-29-cli-ssh-remoto.md).
Enquanto não houver decisão, nenhum download automático é permitido: o fork não
define `updateUrl`, `downloadUrl`, `quality` nem `commit`, e publicar o servidor
é distribuição, sujeita a `E00-A`/`E00-B`.

### Recusado pelo contrato

- instalar, atualizar ou configurar `sshd`, OpenSSH, firewall, serviço,
  gerenciador de pacotes, arquivo de sistema, perfil de shell,
  `authorized_keys`, `known_hosts` ou configuração SSH do usuário;
- usar root, elevação, credencial administrativa ou instalação global;
- provisionar silenciosamente em segundo plano ou por simples abertura de
  workspace não confiável;
- instalar ou baixar automaticamente `opencode`, provider, MCP, plugin, regra
  ou qualquer credencial. A disponibilidade e a versão de OpenCode pertencem ao
  contrato de integração OpenCode, não a T-013;
- copiar workspace, `.git`, worktrees, arquivos de configuração sensíveis,
  diretórios `.ssh`, chaves, tokens, prompts, diffs ou resultados para bootstrap;
- tentar um host Windows remoto, uma arquitetura fora de x64 ou uma versão
  incompatível como fallback;
- matar ou limpar processo remoto que não tenha ownership comprovado pela
  autoridade desta janela.

Se o diretório remoto do usuário não for gravável ou o provisionamento exigir
qualquer operação recusada acima, a conexão falha de modo observável e não muda
a configuração do host.

## 6. Versão e compatibilidade

O desktop e o servidor remoto Code-OSS devem usar a mesma combinação de build
do unigma, ou uma combinação explicitamente declarada compatível por contrato
posterior. O baseline conhecido para esta etapa é:

| item | valor |
| --- | --- |
| Code-OSS | tag `1.134.0` |
| commit do snapshot | `474a349ad5b745e512ef86b864d1c74f7264dd7a` |
| Node.js de desenvolvimento | `24.18.0` |
| Electron do desktop | `42.8.1` |
| host remoto contratual | Linux x64 |

Node.js e Electron acima identificam a base do desktop; não são, sozinhos,
uma promessa de suporte a outro host remoto. O servidor remoto deve ter a
versão/protocolo de autoridade e extension host compatíveis com o commit do
cliente. Compatibilidade de endpoints, eventos e versão do `opencode serve`
fica em T-011 e não é inventada neste documento.

Uma incompatibilidade deve ser detectada antes de iniciar o workspace ou uma
sessão do agente. O resultado é recusa explícita com build esperada, build
observada, sistema e arquitetura, sem downgrade, fallback local, execução
mista ou atualização silenciosa. Uma atualização do servidor remoto só pode
ocorrer como provisionamento explícito e dentro da área do usuário remoto.

## 7. Falhas observáveis

As categorias abaixo são nomes de diagnóstico do contrato, não APIs já
implementadas. Cada falha deve terminar em estado de erro acionável, nunca em
spinner permanente ou exceção ignorada.

| categoria | condição | resultado visível mínimo |
| --- | --- | --- |
| `ssh.client-unavailable` | OpenSSH ausente, inválido ou não executável | conexão SSH indisponível; nenhuma alternativa é tentada |
| `ssh.target-unresolved` | alias, host, porta ou configuração não resolvidos | destino SSH inválido; corrigir configuração do usuário |
| `ssh.host-key-untrusted` | `known_hosts` desconhecido, divergente ou revogado | host não confiável; autenticação e provisionamento não começam |
| `ssh.authentication-unavailable` | agente/chave não disponível ou OpenSSH pede credencial | autenticação indisponível; corrigir agente/chaves fora de unigma |
| `ssh.transport-failed` | DNS, rota, conexão recusada, timeout ou `sshd` indisponível | transporte SSH falhou, com fase e ação de retry explícitas |
| `ssh.remote-platform-unsupported` | host não é Linux x64 da matriz | host remoto recusado antes do provisionamento |
| `ssh.provisioning-denied` | sem aprovação explícita, área gravável ou permissão de usuário | provisionamento recusado; nenhuma alteração administrativa |
| `ssh.remote-server-unavailable` | servidor remoto ausente, não inicia ou extension host não fica pronto | autoridade remota indisponível; distinguir de falha de OpenCode |
| `ssh.remote-server-incompatible` | build ou protocolo remoto não compatível | versão incompatível com esperado/observado; sem fallback |
| `ssh.opencode-unavailable` | `opencode serve` ausente, encerra ou não atende o contrato de T-011 | runtime do agente indisponível; workspace remoto permanece no host |
| `ssh.workspace-blocked` | workspace não confiável, caminho remoto inválido ou inacessível | operação bloqueada por trust/caminho; nenhum efeito de agente |
| `ssh.connection-lost` | canal SSH, extension host ou serviço remoto encerra | estado remoto desconectado; operações pendentes não são reaplicadas |

O canal de diagnóstico local pode registrar categoria, fase, `requestId`,
referência de sessão e código de saída sanitizado. Não registra por padrão
comando completo, ambiente, entrada de prompt, conteúdo de arquivo, workspace,
`known_hosts`, chave, passphrase, senha, token ou resposta de provider. Não há
telemetria nem envio remoto de logs.

## 8. Perda de conexão e reconexão

Ao perder o canal SSH, o servidor remoto ou o `opencode serve` remoto:

1. a UI marca a autoridade remota como desconectada e diferencia a origem
   conhecida: transporte, servidor remoto, extension host ou OpenCode;
2. novos comandos, efeitos, aprovações e escritas são bloqueados até a conexão
   ser validada novamente;
3. nenhum comando, aprovação, prompt, diff ou efeito pendente é repetido
   automaticamente, e não há fallback para OpenCode local;
4. uma aprovação pendente não é presumida válida depois da perda ou de um
   reinício; a UI consulta o OpenCode novamente quando houver conexão;
5. uma reconexão explícita revalida configuração OpenSSH, `known_hosts`,
   autenticação disponível, plataforma e versão antes de reabrir o contexto;
6. a reconexão não copia o workspace e não mata processos cuja ownership não
   possa ser comprovada pela autoridade.

Se o host remoto continuar acessível, a implementação futura poderá oferecer
retry explícito. Isso não autoriza replay de efeitos nem restauração automática
de aprovação. Se o servidor remoto tiver sido substituído, a versão será
verificada novamente e uma incompatibilidade continuará sendo recusa.

## 9. Limite de dados

O workspace, o repositório Git, worktrees, caminhos, arquivos e processos de
agente permanecem no host que os possui. A autoridade remota transporta apenas
as mensagens necessárias à sessão Code-OSS; não cria espelho, zip, upload,
cache indexado ou sincronização do projeto.

Também não há cópia própria de:

- senhas, passphrases, tokens, caches OAuth, chaves SSH ou sockets de agentes;
- conteúdo de `known_hosts`;
- prompts, diffs, mensagens, arquivos ou resultados do OpenCode;
- configuração sensível de provider, MCP, plugin ou regra.

Referências de sessão, estado transitório e diagnóstico seguem as fontes de
verdade e os limites descritos no modelo de dados do produto; este contrato não
cria armazenamento SSH próprio.

## 10. Evidência futura e limites desta tarefa

T-013 deixa os seguintes casos definidos para T-050/T-051/T-053, mas não os
executa:

- conexão aceita de Windows x64 para Linux x64 e de Linux x64 para Linux x64,
  usando agente/chaves e `known_hosts` já administrados;
- host desconhecido, chave divergente e chave revogada recusados sem tentativa
  de autenticação;
- servidor remoto com commit incompatível recusado com diagnóstico observável;
- perda de SSH seguida de reconexão explícita sem replay de comando ou aprovação;
- ausência de `opencode serve` remoto distinguida de falha do transporte;
- verificação de que workspace, chaves, segredos e conteúdo sensível não são
  copiados nem aparecem nos logs;
- host Windows remoto e arquiteturas fora da matriz recusados antes do
  provisionamento.

T-013 implementa somente a política pura e seus testes em
`extensions/unigma-remote-ssh/`. Não fazem parte dela: manifesto, transporte,
bootstrap executável, alteração de `known_hosts`, solicitação de credenciais,
instalação de OpenCode, atualização de documentos compartilhados, build, teste
de integração ou deploy.

## Referências

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [DECISIONS.md](DECISIONS.md)
- [FLOWS.md](FLOWS.md)
- [DATA-MODEL.md](DATA-MODEL.md)
- [ACCEPTANCE.md](ACCEPTANCE.md)
- [BACKLOG.md](BACKLOG.md)
- [UPSTREAM.md](UPSTREAM.md)
