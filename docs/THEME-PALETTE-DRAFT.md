# paleta dos quatro temas — especificação proposta

**Estado: `[EM REVISÃO]`.** Este documento especifica desenho. Ele **não
autoriza implementação**: nenhum arquivo de tema (`.json` de color theme) foi
escrito nem alterado por ele, e `D-046` decide como a identidade se usa, não que
ela esteja liberada. Fecha o item "paleta completa dos quatro temas" da §6 de
[`VISUAL-IDENTITY-DRAFT.md`](VISUAL-IDENTITY-DRAFT.md) apenas como **proposta a
revisar**; não fecha `AC-012` nem qualquer `T`.

**Os números de contraste deste documento não foram auditados pelo auditor do
produto.** Eles vêm de um script temporário fora do repositório, escrito para
esta rodada, que implementa a fórmula WCAG 2.1 relativa de luminância — a mesma
que [`build/unigma/verify-theme-contrast.ts`](../build/unigma/verify-theme-contrast.ts)
implementa. Rodar esse auditor é **prova separada**, e ela só existe depois que
houver arquivo de tema para ele ler. Enquanto não houver, nada aqui é evidência
de aceite.

## 1. o que já estava fixado

De `D-046`, `D-047` e de [`resources/unigma/README.md`](../resources/unigma/README.md),
sem reabrir:

- âncoras dos ativos de marca: off-white `#efeff4` e violeta `#8b5cf6`;
- fundo neutro carrega a área; roxo e magenta são realce, nunca banho de tela;
- `#8b5cf6` é a cor de **ativo e foco**;
- **magenta é cor de estado**: erro, atenção, permissão pendente;
- quatro temas — branco, lilás, preto e roxo-escuro — sendo **preto o padrão**;
- geometria: quadrado/grade é estrutura e estado; arredondado é o que se clica.

## 2. divergência verificada entre esta proposta e os temas que existem hoje

`extensions/theme-unigma/themes/` contém **três** temas (`unigma-dark.json`,
`unigma-light.json`, `unigma-high-contrast.json`), não quatro, e o auditor de
contraste é escrito sobre exatamente esses três nomes de arquivo. Lendo os
valores atuais:

- `unigma-dark.json` usa `"focusBorder": "#e879f9"` e
  `"editor.selectionBackground": "#a21caf"` — ambos magenta. Isso **contraria
  `D-046`**, que dá o foco ao roxo e reserva magenta para estado. A decisão é
  posterior aos arquivos; eles não foram atualizados.
- `unigma-high-contrast.json` usa `"focusBorder": "#f0abfc"`, mesma divergência.
- `unigma-light.json` já usa `"focusBorder": "#6d28d9"`, coerente com `D-046`.

Não corrigi nenhum desses arquivos: alterá-los é implementação. O registro fica
aqui para que a divergência não seja descoberta de novo mais tarde.

## 3. rampa neutra por tema

Seis degraus por tema. `superfície elevada` é painel, lista, menu e caixa de
entrada sobre o fundo; `separador` é fio decorativo; `borda de componente` é a
borda de campo, botão e caixa — a que carrega significado e por isso tem meta de
3:1.

### 3.1 preto (padrão)

| papel | hex |
| --- | --- |
| fundo | `#0d0d12` |
| superfície elevada | `#16161d` |
| separador decorativo | `#2f2f3c` |
| borda de componente | `#6b6b85` |
| texto primário | `#efeff4` (âncora de marca) |
| texto secundário | `#a9a9bb` |
| texto desabilitado | `#7e7e96` |

### 3.2 roxo-escuro

| papel | hex |
| --- | --- |
| fundo | `#14101f` |
| superfície elevada | `#1e182e` |
| separador decorativo | `#3a3050` |
| borda de componente | `#776a94` |
| texto primário | `#efeff4` |
| texto secundário | `#b2a8c6` |
| texto desabilitado | `#8b819f` |

O viés roxo mora no **neutro**, não em área saturada: `#14101f` é quase-preto com
matiz violeta. É assim que o tema é "roxo-escuro" sem virar banho de tela.

### 3.3 branco

| papel | hex |
| --- | --- |
| fundo | `#ffffff` |
| superfície elevada | `#f4f4f8` |
| separador decorativo | `#c9c9d4` |
| borda de componente | `#8e8e9c` |
| texto primário | `#17171f` |
| texto secundário | `#585866` |
| texto desabilitado | `#6f6f7d` |

### 3.4 lilás

| papel | hex |
| --- | --- |
| fundo | `#f3f1fa` |
| superfície elevada | `#e9e5f4` |
| separador decorativo | `#c3bcd9` |
| borda de componente | `#8880a0` |
| texto primário | `#1b1729` |
| texto secundário | `#544d68` |
| texto desabilitado | `#6f6788` |

## 4. os realces

### 4.1 roxo — ativo e foco

| tema | roxo | fundo de seleção (lista/menu) |
| --- | --- | --- |
| preto | `#8b5cf6` (âncora, sem alteração) | `#2b2350` |
| roxo-escuro | `#a78bfa` | `#372a5c` |
| branco | `#6d28d9` | `#ede6fd` |
| lilás | `#6d28d9` | `#e0d6f8` |

Por que a âncora `#8b5cf6` não vale nos quatro temas: sobre `#ffffff` ela dá
3,10:1, abaixo dos 4,5:1 de texto. Nos temas claros o roxo **escurece** para
`#6d28d9`; no roxo-escuro **clareia** para `#a78bfa`, porque `#8b5cf6` sobre
`#14101f` fica visualmente mais fraco que sobre preto puro. A âncora permanece
intocada no tema padrão, que é onde a marca e a interface se encontram.

**Seleção usa fundo tingido, não o roxo cheio.** Texto primário sobre `#8b5cf6`
dá 3,69:1 — reprova. Ou o texto sobre roxo é o **fundo do tema** (`#0d0d12`
sobre `#8b5cf6` = 4,58:1), ou o fundo de seleção é uma versão dessaturada, que é
o que esta proposta escolhe: mais calma para oito horas de leitura.

### 4.2 magenta — estado

| tema | magenta (borda/ícone de estado) | fundo de estado | texto sobre fundo de estado |
| --- | --- | --- | --- |
| preto | `#f472b6` | `#3a1226` | `#f9a8d4` |
| roxo-escuro | `#f472b6` | `#3e1430` | `#f9a8d4` |
| branco | `#be1a67` | `#fdeaf2` | `#9d1150` |
| lilás | `#be1a67` | `#fbe8f1` | `#9d1150` |

Magenta cobre os três usos de `D-046` — erro, atenção, permissão pendente — e a
diferença entre eles é **forma e posição**, não cor: erro tem borda de campo,
atenção tem faixa na região de atenção do painel do agente (`D-047`), permissão
pendente tem o bloco de decisão. Cor sozinha nunca distingue estado; isso também
é 1.4.1 do WCAG.

## 5. as cores semânticas restantes

`D-046` não nomeia sucesso, aviso e informação. Proposta, com justificativa:

| tema | sucesso | aviso | informação |
| --- | --- | --- | --- |
| preto | `#4ade80` | `#fbbf24` | `#60a5fa` |
| roxo-escuro | `#4ade80` | `#fbbf24` | `#7dd3fc` |
| branco | `#137a45` | `#8a5a00` | `#1d4ed8` |
| lilás | `#137a45` | `#8a5a00` | `#1d4ed8` |

- **Sucesso é verde** porque é a única convenção que não colide com nada da
  identidade: não há verde em lugar nenhum da marca, então quando ele aparece
  não é confundido com realce.
- **Informação é azul** pelo mesmo motivo, e porque ela precisa ser a cor mais
  discreta das três — informação aparece com frequência e não deve competir com
  o roxo de foco. No roxo-escuro o azul sobe para `#7dd3fc`: `#60a5fa` sobre um
  fundo com matiz violeta lê como "quase roxo".
- **Aviso é âmbar, e aqui há uma tensão real com `D-046`.** A decisão dá
  "atenção" ao magenta. Esta proposta separa: **magenta é atenção que exige
  ação** — erro, permissão pendente, algo parado esperando o usuário; **âmbar é
  degradação que não bloqueia** — quota do provider baixa, versão do OpenCode
  divergente, reconexão em curso. Se essa separação não for aceita, o âmbar sai
  da paleta e esses casos passam a ser texto secundário sem cor própria. Está na
  §8 como pergunta.
- Nos temas claros as três escurecem bastante (`#137a45`, `#8a5a00`) porque
  verde e âmbar saturados sobre branco reprovam 4,5:1 por larga margem.

## 6. contraste calculado

Fórmula WCAG 2.1 (`(L1+0,05)/(L2+0,05)`, luminância relativa com a rampa sRGB),
calculada por script, não estimada. Metas aplicadas: **4,5:1** para texto normal
(1.4.3) e **3:1** para texto grande e componentes/objetos gráficos (1.4.11).

### 6.1 preto

| par | cores | razão | meta | resultado |
| --- | --- | --- | --- | --- |
| texto primário / fundo | `#efeff4` sobre `#0d0d12` | 16,91:1 | 4,5 | passa |
| texto primário / superfície | `#efeff4` sobre `#16161d` | 15,71:1 | 4,5 | passa |
| texto secundário / fundo | `#a9a9bb` sobre `#0d0d12` | 8,38:1 | 4,5 | passa |
| texto secundário / superfície | `#a9a9bb` sobre `#16161d` | 7,78:1 | 4,5 | passa |
| texto desabilitado / fundo | `#7e7e96` sobre `#0d0d12` | 4,90:1 | 4,5 | passa |
| separador decorativo / fundo | `#2f2f3c` sobre `#0d0d12` | 1,47:1 | 3,0 | **falha** |
| borda de componente / fundo | `#6b6b85` sobre `#0d0d12` | 3,75:1 | 3,0 | passa |
| roxo (foco) / fundo | `#8b5cf6` sobre `#0d0d12` | 4,58:1 | 3,0 | passa |
| roxo (foco) / superfície | `#8b5cf6` sobre `#16161d` | 4,25:1 | 3,0 | passa |
| roxo como texto / fundo | `#8b5cf6` sobre `#0d0d12` | 4,58:1 | 4,5 | passa |
| texto primário / fundo de seleção | `#efeff4` sobre `#2b2350` | 12,56:1 | 4,5 | passa |
| fundo de seleção / fundo | `#2b2350` sobre `#0d0d12` | 1,35:1 | 3,0 | **falha** |
| roxo (foco) / fundo de seleção | `#8b5cf6` sobre `#2b2350` | 3,40:1 | 3,0 | passa |
| magenta / fundo | `#f472b6` sobre `#0d0d12` | 7,32:1 | 3,0 | passa |
| magenta como texto / fundo | `#f472b6` sobre `#0d0d12` | 7,32:1 | 4,5 | passa |
| texto de erro / fundo de erro | `#f9a8d4` sobre `#3a1226` | 8,95:1 | 4,5 | passa |
| fundo de erro / fundo | `#3a1226` sobre `#0d0d12` | 1,19:1 | 3,0 | **falha** |
| sucesso / fundo | `#4ade80` sobre `#0d0d12` | 11,12:1 | 4,5 | passa |
| aviso / fundo | `#fbbf24` sobre `#0d0d12` | 11,61:1 | 4,5 | passa |
| informação / fundo | `#60a5fa` sobre `#0d0d12` | 7,62:1 | 4,5 | passa |

### 6.2 roxo-escuro

| par | cores | razão | meta | resultado |
| --- | --- | --- | --- | --- |
| texto primário / fundo | `#efeff4` sobre `#14101f` | 16,31:1 | 4,5 | passa |
| texto primário / superfície | `#efeff4` sobre `#1e182e` | 14,95:1 | 4,5 | passa |
| texto secundário / fundo | `#b2a8c6` sobre `#14101f` | 8,29:1 | 4,5 | passa |
| texto secundário / superfície | `#b2a8c6` sobre `#1e182e` | 7,60:1 | 4,5 | passa |
| texto desabilitado / fundo | `#8b819f` sobre `#14101f` | 5,11:1 | 4,5 | passa |
| separador decorativo / fundo | `#3a3050` sobre `#14101f` | 1,53:1 | 3,0 | **falha** |
| borda de componente / fundo | `#776a94` sobre `#14101f` | 3,80:1 | 3,0 | passa |
| roxo (foco) / fundo | `#a78bfa` sobre `#14101f` | 6,87:1 | 3,0 | passa |
| roxo (foco) / superfície | `#a78bfa` sobre `#1e182e` | 6,30:1 | 3,0 | passa |
| roxo como texto / fundo | `#a78bfa` sobre `#14101f` | 6,87:1 | 4,5 | passa |
| texto primário / fundo de seleção | `#efeff4` sobre `#372a5c` | 11,12:1 | 4,5 | passa |
| fundo de seleção / fundo | `#372a5c` sobre `#14101f` | 1,47:1 | 3,0 | **falha** |
| roxo (foco) / fundo de seleção | `#a78bfa` sobre `#372a5c` | 4,68:1 | 3,0 | passa |
| magenta / fundo | `#f472b6` sobre `#14101f` | 7,06:1 | 3,0 | passa |
| magenta como texto / fundo | `#f472b6` sobre `#14101f` | 7,06:1 | 4,5 | passa |
| texto de erro / fundo de erro | `#f9a8d4` sobre `#3e1430` | 8,59:1 | 4,5 | passa |
| fundo de erro / fundo | `#3e1430` sobre `#14101f` | 1,20:1 | 3,0 | **falha** |
| sucesso / fundo | `#4ade80` sobre `#14101f` | 10,73:1 | 4,5 | passa |
| aviso / fundo | `#fbbf24` sobre `#14101f` | 11,20:1 | 4,5 | passa |
| informação / fundo | `#7dd3fc` sobre `#14101f` | 11,21:1 | 4,5 | passa |

### 6.3 branco

| par | cores | razão | meta | resultado |
| --- | --- | --- | --- | --- |
| texto primário / fundo | `#17171f` sobre `#ffffff` | 17,82:1 | 4,5 | passa |
| texto primário / superfície | `#17171f` sobre `#f4f4f8` | 16,24:1 | 4,5 | passa |
| texto secundário / fundo | `#585866` sobre `#ffffff` | 6,99:1 | 4,5 | passa |
| texto secundário / superfície | `#585866` sobre `#f4f4f8` | 6,38:1 | 4,5 | passa |
| texto desabilitado / fundo | `#6f6f7d` sobre `#ffffff` | 4,95:1 | 4,5 | passa |
| separador decorativo / fundo | `#c9c9d4` sobre `#ffffff` | 1,64:1 | 3,0 | **falha** |
| borda de componente / fundo | `#8e8e9c` sobre `#ffffff` | 3,23:1 | 3,0 | passa |
| roxo (foco) / fundo | `#6d28d9` sobre `#ffffff` | 7,10:1 | 3,0 | passa |
| roxo (foco) / superfície | `#6d28d9` sobre `#f4f4f8` | 6,48:1 | 3,0 | passa |
| roxo como texto / fundo | `#6d28d9` sobre `#ffffff` | 7,10:1 | 4,5 | passa |
| texto primário / fundo de seleção | `#17171f` sobre `#ede6fd` | 14,71:1 | 4,5 | passa |
| fundo de seleção / fundo | `#ede6fd` sobre `#ffffff` | 1,21:1 | 3,0 | **falha** |
| roxo (foco) / fundo de seleção | `#6d28d9` sobre `#ede6fd` | 5,87:1 | 3,0 | passa |
| magenta / fundo | `#be1a67` sobre `#ffffff` | 5,94:1 | 3,0 | passa |
| magenta como texto / fundo | `#be1a67` sobre `#ffffff` | 5,94:1 | 4,5 | passa |
| texto de erro / fundo de erro | `#9d1150` sobre `#fdeaf2` | 6,93:1 | 4,5 | passa |
| fundo de erro / fundo | `#fdeaf2` sobre `#ffffff` | 1,15:1 | 3,0 | **falha** |
| sucesso / fundo | `#137a45` sobre `#ffffff` | 5,39:1 | 4,5 | passa |
| aviso / fundo | `#8a5a00` sobre `#ffffff` | 5,93:1 | 4,5 | passa |
| informação / fundo | `#1d4ed8` sobre `#ffffff` | 6,70:1 | 4,5 | passa |

### 6.4 lilás

| par | cores | razão | meta | resultado |
| --- | --- | --- | --- | --- |
| texto primário / fundo | `#1b1729` sobre `#f3f1fa` | 15,63:1 | 4,5 | passa |
| texto primário / superfície | `#1b1729` sobre `#e9e5f4` | 14,14:1 | 4,5 | passa |
| texto secundário / fundo | `#544d68` sobre `#f3f1fa` | 7,12:1 | 4,5 | passa |
| texto secundário / superfície | `#544d68` sobre `#e9e5f4` | 6,44:1 | 4,5 | passa |
| texto desabilitado / fundo | `#6f6788` sobre `#f3f1fa` | 4,73:1 | 4,5 | passa |
| separador decorativo / fundo | `#c3bcd9` sobre `#f3f1fa` | 1,63:1 | 3,0 | **falha** |
| borda de componente / fundo | `#8880a0` sobre `#f3f1fa` | 3,33:1 | 3,0 | passa |
| roxo (foco) / fundo | `#6d28d9` sobre `#f3f1fa` | 6,35:1 | 3,0 | passa |
| roxo (foco) / superfície | `#6d28d9` sobre `#e9e5f4` | 5,74:1 | 3,0 | passa |
| roxo como texto / fundo | `#6d28d9` sobre `#f3f1fa` | 6,35:1 | 4,5 | passa |
| texto primário / fundo de seleção | `#1b1729` sobre `#e0d6f8` | 12,61:1 | 4,5 | passa |
| fundo de seleção / fundo | `#e0d6f8` sobre `#f3f1fa` | 1,24:1 | 3,0 | **falha** |
| roxo (foco) / fundo de seleção | `#6d28d9` sobre `#e0d6f8` | 5,12:1 | 3,0 | passa |
| magenta / fundo | `#be1a67` sobre `#f3f1fa` | 5,31:1 | 3,0 | passa |
| magenta como texto / fundo | `#be1a67` sobre `#f3f1fa` | 5,31:1 | 4,5 | passa |
| texto de erro / fundo de erro | `#9d1150` sobre `#fbe8f1` | 6,81:1 | 4,5 | passa |
| fundo de erro / fundo | `#fbe8f1` sobre `#f3f1fa` | 1,05:1 | 3,0 | **falha** |
| sucesso / fundo | `#137a45` sobre `#f3f1fa` | 4,82:1 | 4,5 | passa |
| aviso / fundo | `#8a5a00` sobre `#f3f1fa` | 5,30:1 | 4,5 | passa |
| informação / fundo | `#1d4ed8` sobre `#f3f1fa` | 5,99:1 | 4,5 | passa |

### 6.5 o que falha, e o que fazer

**12 pares dos 80 calculados ficam abaixo da meta que apliquei.** Eles são de
três tipos, três por tema, e nenhum é par de texto:

1. **separador decorativo / fundo** (1,47 a 1,64:1). É fio de divisão, sem
   significado próprio; 1.4.11 alcança objeto gráfico **necessário para
   entender** o conteúdo, o que um separador não é. Ainda assim o número é baixo,
   e a proposta é conviver com ele **desde que** nenhuma informação dependa só do
   separador: onde a divisão precisar ser percebida — borda de campo, limite de
   caixa de decisão do painel do agente — usa-se a **borda de componente**, que
   passa 3:1 nos quatro temas. Se o responsável quiser o separador acima de 3:1,
   ele vira `#6b6b85` no preto e `#8e8e9c` no branco, e a interface fica
   visivelmente mais "riscada".
2. **fundo de seleção / fundo** (1,21 a 1,47:1). É preenchimento de área, não
   objeto gráfico. O que precisa passar é o texto sobre ele, e passa
   (11,12 a 14,71:1). Mitigação proposta: seleção com foco recebe **também** a
   borda de foco em roxo, que passa 3:1 sobre o fundo de seleção nos quatro
   temas (3,40 a 5,87:1) — ou seja, o estado não depende do preenchimento.
3. **fundo de estado (erro) / fundo** (1,05 a 1,20:1). Mesmo raciocínio: o
   estado é carregado pela **borda magenta**, que passa (5,31 a 7,32:1), e pelo
   texto, que passa (6,81 a 8,95:1). O tingimento de fundo é reforço.

Nenhum desses é maquiado escolhendo o critério mais frouxo: eu apliquei 3:1 a
todos e reprovei os três tipos. O que proponho é que **eles não estejam sob
1.4.11** por não serem portadores únicos de informação, e que a regra dura seja
"toda informação que o preenchimento sugere tem uma borda ou um texto que passa".
Isso é verificável e é o que peço para o responsável aceitar ou recusar (§8).

**Uma falha diferente, e essa é do critério do auditor, não da paleta.**
`verify-theme-contrast.ts` exige `|luminância(editor.selectionBackground) −
luminância(editor.background)| ≥ 0,1`. Nos temas escuros essa é uma barra dura,
porque o fundo tem luminância ~0,004: a seleção precisa passar de 0,104, o que
significa um roxo bem claro. Calculado: `#2b2350` dá diferença de **0,019** —
reprovaria. `#6b57b8` dá **0,130**, passaria, e o texto primário sobre ele dá
4,98:1. O `unigma-dark.json` de hoje passa esse teste porque usa magenta
`#a21caf` (diferença 0,111) — exatamente a cor que `D-046` retirou do papel de
seleção. Ou seja: **satisfazer `D-046` e o critério atual do auditor ao mesmo
tempo obriga uma seleção de editor bem mais clara que a de lista.** Proposta:
`editor.selectionBackground` = `#6b57b8` (preto) e `#7059c4` (roxo-escuro),
separados de `list.activeSelectionBackground`, que continua `#2b2350`/`#372a5c`.
Nos temas claros a diferença já passa (0,183 e 0,182).

## 7. mapeamento para os tokens do VS Code

Núcleo, não exaustivo. As chaves marcadas com † são as que o auditor de
contraste já lê; elas precisam existir e ser hexadecimais opacas, senão ele
lança erro antes de calcular.

| token | preto | roxo-escuro | branco | lilás |
| --- | --- | --- | --- | --- |
| `editor.background` † | `#0d0d12` | `#14101f` | `#ffffff` | `#f3f1fa` |
| `editor.foreground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `editor.selectionBackground` † | `#6b57b8` | `#7059c4` | `#ede6fd` | `#e0d6f8` |
| `focusBorder` † | `#8b5cf6` | `#a78bfa` | `#6d28d9` | `#6d28d9` |
| `sideBar.background` † | `#0d0d12` | `#14101f` | `#f4f4f8` | `#e9e5f4` |
| `sideBar.foreground` † | `#a9a9bb` | `#b2a8c6` | `#585866` | `#544d68` |
| `sideBar.border` | `#2f2f3c` | `#3a3050` | `#c9c9d4` | `#c3bcd9` |
| `statusBar.background` † | `#16161d` | `#1e182e` | `#f4f4f8` | `#e9e5f4` |
| `statusBar.foreground` † | `#a9a9bb` | `#b2a8c6` | `#585866` | `#544d68` |
| `list.activeSelectionBackground` † | `#2b2350` | `#372a5c` | `#ede6fd` | `#e0d6f8` |
| `list.activeSelectionForeground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `list.inactiveSelectionBackground` † | `#1c1c26` | `#26203a` | `#f0eefa` | `#e4dff1` |
| `list.inactiveSelectionForeground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `list.hoverBackground` | `#16161d` | `#1e182e` | `#f4f4f8` | `#e9e5f4` |
| `panel.background` † | `#0d0d12` | `#14101f` | `#ffffff` | `#f3f1fa` |
| `panelTitle.activeForeground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `panelTitle.inactiveForeground` † | `#a9a9bb` | `#b2a8c6` | `#585866` | `#544d68` |
| `tab.activeBackground` † | `#16161d` | `#1e182e` | `#ffffff` | `#f3f1fa` |
| `tab.activeForeground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `tab.inactiveBackground` † | `#0d0d12` | `#14101f` | `#f4f4f8` | `#e9e5f4` |
| `tab.inactiveForeground` † | `#a9a9bb` | `#b2a8c6` | `#585866` | `#544d68` |
| `tab.activeBorderTop` | `#8b5cf6` | `#a78bfa` | `#6d28d9` | `#6d28d9` |
| `menu.background` † | `#16161d` | `#1e182e` | `#ffffff` | `#f3f1fa` |
| `menu.foreground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `menu.selectionBackground` | `#2b2350` | `#372a5c` | `#ede6fd` | `#e0d6f8` |
| `notifications.background` † | `#16161d` | `#1e182e` | `#ffffff` | `#f3f1fa` |
| `notifications.foreground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `terminal.background` † | `#0d0d12` | `#14101f` | `#ffffff` | `#f3f1fa` |
| `terminal.foreground` † | `#efeff4` | `#efeff4` | `#17171f` | `#1b1729` |
| `button.background` † | `#8b5cf6` | `#a78bfa` | `#6d28d9` | `#6d28d9` |
| `button.foreground` † | `#0d0d12` | `#14101f` | `#ffffff` | `#ffffff` |
| `input.background` | `#16161d` | `#1e182e` | `#ffffff` | `#ffffff` |
| `input.border` | `#6b6b85` | `#776a94` | `#8e8e9c` | `#8880a0` |
| `errorForeground` | `#f472b6` | `#f472b6` | `#be1a67` | `#be1a67` |
| `inputValidation.errorBorder` | `#f472b6` | `#f472b6` | `#be1a67` | `#be1a67` |
| `inputValidation.errorBackground` | `#3a1226` | `#3e1430` | `#fdeaf2` | `#fbe8f1` |
| `inputValidation.errorForeground` | `#f9a8d4` | `#f9a8d4` | `#9d1150` | `#9d1150` |
| `editorError.foreground` | `#f472b6` | `#f472b6` | `#be1a67` | `#be1a67` |
| `editorWarning.foreground` | `#fbbf24` | `#fbbf24` | `#8a5a00` | `#8a5a00` |
| `editorInfo.foreground` | `#60a5fa` | `#7dd3fc` | `#1d4ed8` | `#1d4ed8` |
| `charts.green` / sucesso | `#4ade80` | `#4ade80` | `#137a45` | `#137a45` |
| `disabledForeground` | `#7e7e96` | `#8b819f` | `#6f6f7d` | `#6f6788` |
| `contrastBorder` | `#6b6b85` | `#776a94` | `#8e8e9c` | `#8880a0` |

`button.foreground` é deliberadamente o fundo do tema nos escuros: texto claro
sobre `#8b5cf6` dá 3,69:1 e reprova, enquanto `#0d0d12` sobre `#8b5cf6` dá
4,58:1 e passa. Nos claros o botão roxo é escuro o bastante para receber branco
(`#ffffff` sobre `#6d28d9` = 7,10:1).

`statusBar.background` usa a superfície elevada, não um roxo de marca: `D-046`
autoriza micro-rótulo com fato verificável na barra de status, e um fundo
saturado atrás de texto denso é exatamente o que a §3 de `VISUAL-IDENTITY-DRAFT`
recusa.

**Quatro temas contra três arquivos.** O auditor itera sobre
`unigma-dark.json`, `unigma-light.json` e `unigma-high-contrast.json`. Esta
paleta tem quatro temas, e nenhum deles é "alto contraste". Como isso se resolve
— renomear, acrescentar arquivos, tratar o alto contraste como quinto tema — é
decisão, não detalhe de implementação, e está na §8.

## 8. o que falta você responder

1. **Os 12 pares que falham são aceitáveis com a regra de mitigação da §6.5?**
   A regra proposta: preenchimento de área (separador, fundo de seleção, fundo de
   estado) pode ficar abaixo de 3:1 desde que a informação que ele sugere também
   apareça em borda ou texto que passem. Recusar isso significa separadores mais
   marcados e seleções mais fortes nos quatro temas.
2. **Âmbar entra como "aviso" ao lado do magenta?** `D-046` deu "atenção" ao
   magenta. A §5 propõe magenta para o que exige ação e âmbar para degradação
   que não bloqueia. Se a resposta for não, âmbar sai e esses casos viram texto
   secundário sem cor própria.
3. **Seleção do editor: mais clara para satisfazer o auditor, ou o critério do
   auditor muda?** Hoje `unigma-dark.json` só passa a checagem de luminância
   porque usa magenta em seleção, que `D-046` proibiu. As saídas são
   `editor.selectionBackground` claro (`#6b57b8`) ou revisar o limiar de 0,1 do
   auditor para temas escuros. Não escolhi por você.
4. **Quatro temas contra três arquivos: qual é o mapa?** `unigma-dark` vira
   preto, `unigma-light` vira branco, e lilás e roxo-escuro precisam de arquivos
   novos. O tema de alto contraste existente não está nesta paleta — ele
   permanece como quinto tema, é redesenhado, ou é retirado?
5. **Os arquivos de tema atuais contrariam `D-046` (foco magenta).** Corrigi-los
   é implementação e não foi feito. Isso vira `T` própria, ou entra junto com a
   criação dos dois temas novos?
6. **A âncora `#8b5cf6` variar por tema é aceitável?** Ela permanece literal no
   preto, que é o padrão, mas nos claros vira `#6d28d9` e no roxo-escuro
   `#a78bfa`, por contraste. Se a exigência for hex único nos quatro, o tema
   branco perde 4,5:1 para roxo como texto.

## 9. o que este documento não faz

- Não escreve, altera ou registra nenhum arquivo de tema.
- Não altera `DECISIONS.md`, `PRODUCT.md` ou qualquer documento existente.
- Não roda o auditor de contraste do produto; os números da §6 são de script
  próprio e **não são prova de aceite**.
- Não move `AC-012`, que continua bloqueado por autoria, direitos e não-colisão
  dos ativos de marca.
