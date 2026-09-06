# proposta de identidade visual — leitura das referências

**Estado: `[EM REVISÃO]`, com as respostas de `D-046` incorporadas.** Não
autoriza incorporar fonte, ícone ou ativo, e não fecha `T-003`/`T-034`.

Cinco referências entregues pelo responsável em 2026-09-06. Elas **não são
ativos distribuíveis** e nada aqui autoriza cópia de lettering, ícone,
proporção ou composição identificável — a restrição já registrada em
[`PRODUCT.md`](PRODUCT.md) continua valendo integralmente, e duas das
referências são trabalho assinado de estúdio.

## 1. o que as cinco têm em comum

Lidas juntas, elas concordam em cinco coisas:

| traço | onde aparece |
| --- | --- |
| **grade modular de fio de cabelo**, visível como estrutura, com marcas de canto e cruzetas nas interseções | pôster técnico, landing brutalista |
| **micro-tipografia monoespaçada**, caixa alta, minúscula, numerada com barras (`/01`, `SCN: 0007`) | pôster técnico, landing brutalista |
| **imagem por dithering/ASCII**, nunca fotografia | pôster técnico, tela de login |
| **geometria de cápsula** — cantos totalmente arredondados, forma de estádio | vidro violeta, portfólio escuro |
| **campo neutro com um único acento saturado** | vermelho no pôster, roxo/ácido na landing |

E uma sexta, que é a que mais importa para este produto: **nenhuma delas é uma
ferramenta.** São pôster, landing e tela de entrada — superfícies que se olha
por segundos. Um editor de código se olha por oito horas.

## 2. a tensão real, e como resolvê-la

Duas das referências são **grade e bloco** (retas, cantos vivos, estrutura
exposta). Duas são **cápsula e brilho** (cantos totalmente arredondados,
reflexo especular). Isso não é indecisão do responsável; são dois registros que
podem conviver se cada um tiver um trabalho.

**Proposta:** grade e fio para **estrutura**; cápsula para **objeto
interativo**.

- fio de cabelo, cruzeta e rótulo monoespaçado desenham onde as coisas ficam;
- forma de estádio marca o que se pode tocar — chip, tag, botão, seletor de
  modelo, e os **chips de anexo** do painel do agente.

Assim a cápsula deixa de ser enfeite e passa a ser sinal: se é arredondado,
responde ao clique. Um usuário aprende isso em minutos e nunca mais erra.

## 3. onde a identidade pode aparecer, e onde não pode

Esta é a proposta mais importante do documento, porque é a que protege o
produto de si mesmo.

**Superfícies de marca** — expressão completa: grade, micro-tipografia,
dithering, lettering em bloco, brilho controlado.
Splash, Welcome/walkthrough, About, instalador, ícone, site e documentação.

**Superfícies de trabalho** — **paleta e geometria apenas.** Sem grade
decorativa, sem rótulo monoespaçado ornamental, sem textura.
Editor, painéis, barra lateral, e o painel do agente.

O motivo é medível, não estético: alto contraste e ruído estrutural são o que
tornam um pôster legível de longe e o que tornam um editor cansativo de perto.
A referência brutalista põe barras de status decorativas na página inteira; num
editor isso disputa atenção com o código, que é a única coisa que precisa dela.

## 4. ideias concretas

### 4.1 "There's no secret." como princípio, não como frase

A referência brutalista usa `SYS.TIME`, `CPU_USAGE`, `CONNECTION SECURE`,
`SCN: 0007` como **decoração** — são números que não medem nada.

Neste projeto esses números **existem de verdade**: commit, versão do OpenCode
fixada, run id da prova, estado da conexão remota, qual modelo respondeu. A
disciplina de evidência do projeto já produz exatamente o material que aquela
estética finge ter.

**Proposta:** o registro monoespaçado de micro-rótulo carrega **fato
verificável, nunca enfeite**. No About, no rodapé do Welcome, na barra de
status do remoto. Se um número não for medido, não aparece.

Isso faz a tagline deixar de ser slogan. O produto mostra o próprio estado
porque não tem o que esconder — e é a única maneira honesta de o fork usar essa
estética em vez de emprestá-la.

### 4.2 roxo como acento estrutural, não como banho

As duas referências mais fortes usam **campo neutro com um acento**. A direção
já registrada diz "roxo predominante", e vale distinguir o que isso significa:
predominante **na identidade**, não em área de tela.

**Proposta:** dos quatro fundos já nomeados — branco, lilás, preto, roxo-escuro
— o roxo entra sobretudo como **fio, marcador, foco e estado ativo**. O
roxo-escuro segue como um tema entre os quatro, não como o padrão. Um editor
inteiro roxo cansa e piora contraste de sintaxe; roxo na estrutura fica
distintivo sem custar legibilidade.

### 4.3 dithering como linguagem de ilustração

Duas referências resolvem imagem sem fotografia: retícula e ASCII.

**Proposta:** adotar isso para as ilustrações do walkthrough e do Welcome.
É monocromático (tinge com a cor do tema), escala sem borrar, pesa quase nada,
e — o que decide — **não depende de licenciar fotografia nem ilustração de
terceiro**, que é exatamente o tipo de dívida que `T-002` está tentando fechar.

### 4.4 o brilho controlado tem um lugar só

A referência de vidro violeta é literalmente o "sheen metálico controlado" já
registrado. Ela também mostra o risco: aquilo é lindo em tela cheia e vira
sujeira em 16 px.

**Proposta:** brilho especular **só** em ícone, splash e arte de Welcome. Nunca
em texto, nunca em controle, nunca em ícone de barra de atividade. Um degradê
em elemento de UI é o primeiro lugar onde um tema envelhece.

### 4.5 lettering

A construção por blocos verticais em roxo já está na direção aprovada, e a
referência do pôster mostra o princípio: **desenho geométrico com terminais de
canto arredondado**, que é a ponte entre os dois registros da §2 — bloco na
construção, cápsula no acabamento.

**Nada disso autoriza reproduzir a face da referência.** E `Cinderblock`
continua **pendente**: disponibilidade, licença, pesos e direitos de uso não
foram verificados, e ela não entra antes disso.

## 5. o que `D-046` decidiu

1. **Fundo neutro; roxo e magenta em realce.** Preto, cinza e os demais fundos
   já nomeados carregam a área. Roxo e magenta são realce — fio, marcador, foco,
   estado ativo — nunca banho de tela. "Roxo predominante" é predominância na
   identidade, não em área.
2. **Magenta é cor de estado**: erro, atenção, permissão pendente. Recusadas as
   alternativas de segundo acento de marca e de acento único. Quando magenta
   aparece, ele significa alguma coisa.
3. **Separar, com uma exceção.** Expressão completa nas superfícies de marca; só
   paleta e geometria nas de trabalho — **exceto a barra de status e o painel do
   agente**, que podem carregar o registro de micro-rótulo desde que ele traga
   fato verificável. Número não medido não aparece.
4. **Lettering por construção própria**, em blocos com terminais de canto
   arredondado. `Cinderblock` sai do caminho: sem licença a verificar, sem
   dependência, sem risco de cópia. Só o logotipo; a UI usa a fonte do sistema.

## 6. o que ainda falta você responder

1. **Dithering como linguagem de ilustração** (§4.3) entra para Welcome e
   walkthrough? Não foi perguntado ainda e é a única das ideias da §4 sem
   resposta.
2. Os quatro fundos já nomeados eram branco, lilás, preto e roxo-escuro.
   `D-046` diz "preto, cinza e os demais": **branco e lilás continuam na
   matriz de temas**, ou o produto passa a ser só escuro?
3. O logotipo por blocos: quantas letras? `unigma` inteiro, ou uma marca curta
   que funcione em 16 px na barra de tarefas?
