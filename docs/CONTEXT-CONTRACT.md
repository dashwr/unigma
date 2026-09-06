# contrato de contexto explícito — DOC-CONTEXT-001

> **D-038 / RQ-029 / AC-030.** Escrito em 2026-09-06 contra o `/doc` do artefato
> fixado `1.18.23` (probe registrado em
> [OPENCODE-COMPATIBILITY](OPENCODE-COMPATIBILITY.md)). Este documento **define
> um contrato**; não implementa, não habilita capacidade e não fecha `AC-030`.
> A implementação depende da revisão do planejador e da decomposição
> RPC → runtime → UI → integração descrita no fim.

## 1. o que este contrato cobre

Anexar contexto **explícito e transitório** a um envio: um arquivo, uma seleção
de editor, um símbolo ou um documento externo. Fora de escopo: índice próprio,
embeddings, cache persistente de workspace e busca automática — `D-038` proíbe
os quatro. Busca continua sob demanda, executada pelo OpenCode.

## 2. superfície real do binário fixado

`POST /session/{id}/prompt_async` aceita `parts` com quatro variantes de input.
Duas importam aqui:

```text
TextPartInput  { type: "text", text, synthetic?, ignored?, time?, metadata? }
FilePartInput  { type: "file", mime, url, filename?, id?, source? }
```

`mime` e `url` são **obrigatórios**; `source` é opcional e é o único lugar onde
origem e range viajam. `FilePartSource` é `anyOf` de três formas:

```text
FileSource     { type: "file",     path, text }
SymbolSource   { type: "symbol",   path, text, range, name, kind }
ResourceSource { type: "resource", clientName, uri, text }
FilePartSourceText { value, start, end }     // todos obrigatórios
```

Consequências que o contrato precisa absorver, e que não são inferência:

- **o binário não tem campo de versão de arquivo.** Não existe `mtime`, `etag`,
  `sha` nem `version` em nenhuma das três origens. Versão é responsabilidade do
  unigma e não pode ser delegada ao anexo.
- **`text` é obrigatório dentro de `source`.** Um anexo com origem carrega
  necessariamente o conteúdo recortado, e `start`/`end` descrevem esse recorte.
  Anexo por referência pura, sem materializar texto, não existe nesta API.
- **`url` é o transporte do conteúdo**, e o `/doc` não restringe seu esquema.
  Ver §4.
- `AgentPartInput` (`@agente`) e `SubtaskPartInput` são partes irmãs no mesmo
  array. Qualquer sintaxe de anexo escolhida pela UI divide espaço com elas.

## 3. modelo de anexo do unigma

Um anexo é um valor imutável resolvido **no momento do envio**, não uma
assinatura viva:

```text
Attachment {
  kind:    "file" | "selection" | "symbol" | "resource"
  uri:     URI do workbench (inclui autoridade remota)
  origin:  "explorer" | "editor" | "selection" | "command" | "drop"
  version: { docVersion?: number, mtimeMs?: number, size: number, sha256: string }
  range?:  { startLine, startColumn, endLine, endColumn }   // 1-based, do editor
  bytes:   number
  text:    string        // recorte materializado
}
```

`version` existe para detectar drift, não para reconstruir conteúdo. `sha256` é
do **recorte materializado**, não do arquivo inteiro, porque é o recorte que
segue no `part`.

### mapeamento para o binário

| anexo do unigma | `FilePartInput` |
| --- | --- |
| arquivo inteiro | `source: FileSource`, `text.start = 0`, `text.end = bytes` |
| seleção de editor | `source: FileSource`, `text.start/end` = offsets do recorte |
| símbolo | `source: SymbolSource` com `range`, `name`, `kind` do provider LSP |
| documento externo | `source: ResourceSource`, `clientName = "unigma"`, `uri` |

`filename` recebe o caminho relativo ao workspace, nunca o caminho absoluto do
host. `mime` vem da detecção do workbench; na dúvida, `text/plain`. Um anexo
cujo mime não seja textual é recusado neste contrato (ver §6).

## 4. `url`, materialização e o que não pode vazar

O `/doc` não restringe o esquema de `url`, e é exatamente por isso que o
contrato precisa restringir:

- **permitido:** `data:` com o recorte já materializado. O conteúdo viaja no
  corpo do `prompt_async` e o servidor não busca nada.
- **proibido:** `file://`, `http(s)://`, `unigma-remote://` ou qualquer esquema
  que faça o servidor OpenCode **ler por conta própria**. Isso moveria a decisão
  de acesso do boundary autorizado para dentro do harness, contornando trust e
  autoridade remota.
- A materialização acontece **no boundary** (runtime), não na UI e não no
  servidor. A UI envia `uri` + `range`; o runtime resolve, lê, mede, recorta,
  calcula `sha256` e só então monta o `FilePartInput`.

## 5. limites

Limites de produto, escolhidos para caber com folga no limite de resposta HTTP
já ajustado em T-011 (16 MiB) e para não transformar um anexo em despejo de
repositório:

| limite | valor | comportamento ao exceder |
| --- | --- | --- |
| tamanho de um anexo | 256 KiB de texto materializado | recusa do anexo, com o motivo na UI |
| soma dos anexos de um envio | 1 MiB | recusa do envio inteiro, sem truncar |
| número de anexos por envio | 16 | recusa do anexo excedente |
| linhas de uma seleção | sem limite próprio | governado pelos 256 KiB |

Truncamento silencioso é proibido: um anexo cortado sem o usuário saber produz
resposta plausível sobre código que não foi enviado. Recusar é o comportamento
seguro. **Estes quatro números são proposta e precisam de aprovação humana**;
o resto do contrato não depende do valor exato deles.

## 6. matriz de falhas

| # | cenário | comportamento exigido |
| --- | --- | --- |
| F-01 | buffer sujo (não salvo) | anexar o **conteúdo do buffer**, não o do disco; marcar `origin: "editor"` e `docVersion`; a UI indica que o anexo é do buffer |
| F-02 | arquivo muda entre resolver e enviar | recomputar `sha256` imediatamente antes do `prompt_async`; divergência recusa o envio com `attachment.drift` |
| F-03 | arquivo apagado entre resolver e enviar | recusa `attachment.gone`; não enviar o recorte antigo |
| F-04 | anexo maior que o limite | recusa `attachment.too-large`; nunca truncar |
| F-05 | mime não textual (binário, imagem) | recusa `attachment.unsupported-mime`; sem base64 de binário neste contrato |
| F-06 | symlink apontando fora do workspace | resolver o link e comparar o **destino real** com o workspace autorizado; fora dele, recusa `attachment.out-of-workspace` |
| F-07 | caminho fora do workspace por `..` | mesma recusa de F-06, verificada após normalização |
| F-08 | workspace não confiável (trust) | anexo recusado antes de ler o arquivo; trust é revalidado imediatamente antes do envio, inclusive para prompt enfileirado |
| F-09 | autoridade remota | o recorte é lido **no host da autoridade da URI**, pelo mesmo extension host que possui a sessão; ler no cliente um arquivo `vscode-remote://` é falha de contrato, não otimização |
| F-10 | URI remota com sessão local (ou o inverso) | recusa `attachment.authority-mismatch`; anexo e sessão compartilham autoridade |
| F-11 | cancelamento durante a materialização | abortar a leitura, não enviar nada, não deixar parte parcial |
| F-12 | falha de leitura (permissão, I/O) | recusa `attachment.unreadable` com categoria fixa; nunca `Error.message` cru |
| F-13 | `directory` de `/path` divergente do workspace | a sessão já está bloqueada por T-011; o anexo não é exceção |
| F-14 | dois anexos do mesmo arquivo com ranges diferentes | permitido; são partes distintas, cada uma com seu `text.start/end` |

## 7. sintaxe na UI

`D-038` proíbe redefinir `@` ou `/` em silêncio, e o `/doc` explica por quê:
`AgentPartInput` já usa `@nome` para selecionar agente, e comandos usam `/`.
Portanto:

- **`@` continua sendo agente.** O contrato não o reutiliza para arquivo.
- Anexo se faz por **ação explícita** — arrastar, comando `unigma: anexar
  arquivo`, ação de contexto sobre a seleção — e aparece como chip removível
  acima do campo de envio, com nome, range e tamanho.
- Um prefixo de digitação para anexo (`#`, por exemplo) fica **em aberto** e é
  decisão de produto; nada neste contrato depende dele.

## 8. o que não vai para log

Conteúdo de anexo, `text.value`, `url` `data:` e caminho absoluto do host nunca
entram em log ou evidência. Log registra: `kind`, `bytes`, `sha256` truncado em
8 caracteres, categoria de erro e contagem. `AC-030` exige explicitamente
conteúdo fora dos logs.

## 9. prova exigida antes de fechar AC-030

Nenhuma das provas abaixo é satisfeita por teste unitário de estrutura:

1. envio real, contra binário fixado, com anexo de arquivo e de seleção,
   verificando no `GET /session/{id}/message` que as partes chegaram com
   `source.text.start/end` corretos;
2. cenário de drift (F-02) e de fora-do-workspace (F-06) recusados no runner;
3. cenário com autoridade remota (F-09) provando leitura no host correto;
4. varredura de log da execução comprovando ausência de conteúdo;
5. revisão confirmando que `@` não mudou de significado.

Itens 1 e 3 dependem de provider/modelo autorizado e, no caso remoto, de
`T-054`/`T-055`. Isso **não bloqueia** este contrato, apenas o aceite.

## 10. decomposição futura

| etapa | escopo | arquivos prováveis |
| --- | --- | --- |
| C-1 | tipos e validação de `Attachment` no contrato interno | `src/vs/workbench/contrib/unigmaAgent/common/` |
| C-2 | RPC: a UI envia `uri`+`range`, nunca conteúdo | contrato de T-010, campo novo versionado |
| C-3 | runtime: resolução, trust, limites, materialização e mapeamento para `FilePartInput` | `extensions/unigma-agent-runtime/` |
| C-4 | UI: chips, recusas e indicação de buffer sujo | view do `unigmaAgent` |
| C-5 | integração e evidência no runner | workflow existente |

C-3 só começa depois de os quatro limites de §5 serem aprovados.
