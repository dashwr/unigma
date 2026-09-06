# rascunho legal — titularidade, notices e cabeçalho

**Estado: `[EM REVISÃO]`.** Autorizado por [D-044](DECISIONS.md). Este documento
é **proposta**, não clearance. Nada aqui afirma que o direito foi verificado por
alguém habilitado; o responsável decide, e só então `T-002`/`T-004` avançam.

Cobre `T-004` (titularidade e notices) e a parte de `T-002` que depende de
decisão em vez de artefato.

## 1. o que já é fato no repositório

Verificado em 2026-09-06, não inferido:

- `LICENSE.txt` (21 linhas) é o texto MIT com uma única linha de copyright:
  `Copyright (c) 2015 - present Microsoft Corporation`.
- `remote/LICENSE` é **byte a byte o mesmo arquivo**, incluindo a mesma linha de
  copyright.
- `ThirdPartyNotices.txt` tem 3439 linhas, herdadas do upstream.
- **7230 arquivos** sob `src/` carregam o cabeçalho
  `Copyright (c) Microsoft Corporation. All rights reserved.`
- `product.json` declara `licenseName: "MIT"` e aponta `licenseUrl` para
  `LICENSE.txt` no repositório `dashwr/unigma`.

O produto se chama unigma e não usa marca da Microsoft, mas **todo o registro de
titularidade continua sendo o do upstream**. É essa lacuna que `T-004` fecha.

## 2. o que a licença MIT obriga, e o que ela não obriga

Obriga: o aviso de copyright do upstream e o texto da permissão **têm de
permanecer** em cópias e partes substanciais. Remover a linha da Microsoft de
`LICENSE.txt` seria violação, não rebranding. Isto não é opção.

Não obriga: que o unigma **não tenha** copyright próprio. Trabalho derivado tem
titular próprio sobre a parte nova. As duas linhas convivem.

Conclusão do rascunho: **acrescentar, nunca substituir.**

## 3. proposta — `LICENSE.txt`

Manter o arquivo como está e inserir uma segunda linha de copyright acima da
existente, preservando ordem cronológica invertida (mais recente primeiro):

```
MIT License

Copyright (c) 2026 - present <TITULAR>
Copyright (c) 2015 - present Microsoft Corporation

Permission is hereby granted, ...
```

**Pendente do responsável:** o valor de `<TITULAR>`. As formas possíveis são
pessoa física nomeada, pessoa jurídica, ou um nome de projeto
(`the unigma contributors`). A escolha tem consequência prática — só um titular
identificável pode licenciar, ceder ou fazer valer o direito depois — e por isso
não é um detalhe de redação que eu possa escolher.

`remote/LICENSE` recebe exatamente a mesma alteração, pelo mesmo motivo pelo qual
hoje é idêntico: é o texto que acompanha o pacote do servidor.

### achado sobre `remote/LICENSE`

O arquivo declara MIT/Microsoft, mas o diretório `remote/` distribui também
`node_modules` de terceiros com licenças próprias. O arquivo **não é falso** — ele
licencia o código do servidor, não as dependências — mas ele também **não cobre**
o que viaja junto. O rascunho recomenda que a revisão de `T-002` trate
`remote/LICENSE` e o notice de terceiros do pacote remoto como duas obrigações
distintas, e não considere a presença do primeiro como prova do segundo.

## 4. proposta — `NOTICE`

O repositório **não tem** um arquivo `NOTICE`. A proposta é criar um curto, com
função declaratória e nenhuma afirmação jurídica:

```
unigma

Este produto é um trabalho derivado de Code - OSS
(https://github.com/microsoft/vscode), licenciado sob MIT.
Copyright (c) 2015 - present Microsoft Corporation.

unigma não é produzido, endossado ou afiliado à Microsoft, e não distribui
marcas, ícones ou serviços da Microsoft. Ver LICENSE.txt para a licença e
ThirdPartyNotices.txt para avisos de terceiros.
```

Motivo de existir separado do `LICENSE.txt`: a negativa de afiliação é o que
protege o rebranding, e ela não pertence ao texto da licença, que não deve ser
editado.

## 5. proposta — política de cabeçalho

Três caminhos, com custo real. O rascunho **recomenda o (b)**.

- **(a) reescrever os 7230 cabeçalhos** para o titular do unigma. Recusado: a
  maior parte desses arquivos é código da Microsoft não modificado, e trocar o
  cabeçalho afirmaria autoria que não existe. É o caminho que cria risco em vez
  de resolver.
- **(b) preservar o cabeçalho existente e adicionar linha própria apenas em
  arquivo novo ou substancialmente reescrito.** O cabeçalho novo cita as duas
  titularidades quando o arquivo é derivado. Custo: o critério de
  "substancialmente" precisa ser escrito, e o `eslint` de cabeçalho precisa
  aceitar as duas formas — não relaxando a regra, mas reconhecendo um segundo
  padrão exato.
- **(c) não mexer em cabeçalho nenhum.** Barato e seguro, mas deixa código novo
  do unigma marcado como da Microsoft, que é falso na direção oposta.

Cabeçalho proposto para arquivo novo do unigma:

```
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) <TITULAR>. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
```

## 6. o que continua bloqueado depois deste rascunho

Este documento **não** destrava:

- os 695 root manifest-only do inventário de `T-002` — isso depende do artefato
  de component governance, que é dado, não decisão;
- a regeneração do `ThirdPartyNotices.txt` — depende do mesmo artefato;
- `BRANDING-CLEARANCE` e `THIRD-PARTY-REVIEW` — dependem de revisão humana
  registrada, que o executor não substitui.

`T-004` sai de `[BLOQUEADO]` para `[EM REVISÃO]`: existe o que revisar. `T-002`
permanece `[BLOQUEADO]` pelo artefato ausente.

## 7. o que falta o responsável responder

1. O valor de `<TITULAR>` (§3), na forma exata que deve aparecer.
2. Se a política de cabeçalho é (a), (b) ou (c) (§5).
3. Se o `NOTICE` proposto (§4) entra como está ou com outra redação.
