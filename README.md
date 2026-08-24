# unigma

unigma é um IDE desktop open-source, local-first e derivado de Code - OSS. O
MVP tem como alvo Windows x64 e Linux x64 e integra o OpenCode como runtime
primário de agente.

## estado do projeto

O snapshot de fundação foi fixado em Code - OSS `1.134.0`. A arquitetura está
aprovada, mas as features próprias do agente ainda estão em implementação.
Consulte o [backlog](docs/BACKLOG.md) para o trabalho planejado e o
[guia operacional](AGENTS.md) antes de alterar o código.

## direção técnica

- contribuição nativa do workbench em `src/vs/workbench/contrib/unigmaAgent/`;
- runtime interno em `extensions/unigma-agent-runtime/`;
- `opencode serve` iniciado como processo filho reutilizável e acessado por
  HTTP/SSE no loopback;
- OpenSSH para workspaces remotos;
- sem backend, conta, banco, cloud ou sincronização no MVP.

## desenvolvimento

Versões, pré-requisitos, comandos e limites estão em [AGENTS.md](AGENTS.md).
Arquitetura, requisitos, fluxos, modelo de dados e critérios de aceite estão em
[`docs/`](docs/).

## proveniência e licença

Este repositório incorpora um snapshot de Code - OSS. A proveniência exata, as
limitações de compatibilidade e o método de importação estão em
[`docs/UPSTREAM.md`](docs/UPSTREAM.md). Os avisos e licenças aplicáveis ficam
em [`LICENSE.txt`](LICENSE.txt) e [`ThirdPartyNotices.txt`](ThirdPartyNotices.txt).

unigma não é a distribuição comercial do upstream nem um produto da
Microsoft. A identidade, os ativos e a configuração de distribuição próprios
devem permanecer separados da marca do upstream; a revisão inicial está em
[`docs/THIRD-PARTY-REVIEW.md`](docs/THIRD-PARTY-REVIEW.md).

## identidade

- nome: `unigma`;
- identificador público proposto: `unigma-code`;
- tagline: “There's no secret.”;
- paleta: roxo predominante, com realces magenta/violeta;
- a fonte Cinderblock não foi incorporada.
