---
paths:
  - "build/unigma/**"
  - "extensions/unigma-remote-ssh/**"
  - ".github/workflows/**"
---

# scripts remotos, smokes e workflows

Esta é a superfície onde os incidentes reais aconteceram. Leia o script gerado,
não só o diff.

## execução remota

- Nada de `sudo`, instalação global, serviço de sistema ou escrita fora do
  diretório do próprio usuário no host.
- Prefira operação limitada por natureza: `rm -f` em arquivo único, `rmdir` que
  falha em diretório não vazio, `mkdir` como lock atômico, `mv -T` para ativar.
  Sentinela vazia e `safe_rm` existem porque um `rm` com variável vazia já
  apontou para o lugar errado.
- Extração de tar usa `--no-same-owner --no-same-permissions`: extrair como root
  reproduziu titularidade dentro de `/root` e o git recusou o repositório.
- Confirme a pós-condição. Já houve limpeza verde que não executou nada por causa
  de aspas erradas no shell.

## provas que não provam

- `/version` responder não prova módulo nativo carregado.
- `/health` não prova superfície removida.
- Um smoke que pré-popula o servidor não exercita o push do payload.
- Caminho de artefato da máquina de desenvolvimento não existe dentro do WSL do
  runner; um smoke que dependa dele está testando outra coisa em silêncio.
- Cliente e servidor precisam ser o mesmo commit (`D-028`). Par divergente é
  falha de gate, não detalhe.

## workflows

- Só workflows do branch default são dispatcháveis por nome; modo novo em branch
  entra como input de um workflow já existente, via `workflow_call`.
- Ao adicionar um modo, escreva as guardas de todos os jobs de forma explícita.
  Um modo novo com guarda implícita já selecionou o job legado, que provisiona e
  limpa o host.
- Staging, ativação e limpeza remota exigem autorização específica, sempre.

## evidência

Publique só evidência sanitizada: nunca args de `ssh`, ambiente, PID, host,
usuário ou saída crua do transporte. Categoria de erro fixa, não `Error.message`.
