# transporte do cliente Windows — opções e custo

**Estado: `[EM REVISÃO]`.** Autorizado por [D-045](DECISIONS.md): levantar as
alternativas e registrar, **sem implementar**. `T-056` continua sem implementação
autorizada até a decisão seguinte.

## 1. o defeito, dito com precisão

`docs/SSH-CONTRACT.md` declara o cliente **Windows x64 → host Linux x64** como
alvo remoto mínimo. O caminho implementado depende de `ControlMaster`, e o
OpenSSH que acompanha o Windows não o implementa. Declarar suporte sem caminho é
o defeito atual — não é a ausência do recurso.

Medido em `unigma-windows-ssh-capabilities` `33785474120`, sobre
`OpenSSH_for_Windows_9.5p2`:

- `-M` e `ControlMaster=auto` são **parseados** e falham em execução com
  `getsockname failed: Not a socket`. Não há o que remendar: o multiplexador
  depende de socket UNIX no filesystem, que é a peça ausente.
- `-L 127.0.0.1:<porta>:/caminho/socket.sock` **é aceito**. `-W` também.
- A recusa registrada antes desta medição era causada pela porta `0` na
  especificação, não pelo alvo ser um socket UNIX. Essa hipótese foi corrigida.

## 2. `ControlMaster` é usado para duas coisas diferentes

Confundir as duas é o que faz a questão parecer maior do que é.

- **(A) staging do payload.** Hoje: uma conexão, uma autenticação, duas
  invocações — o script vai por stdin (nunca em argv, visível no `ps` do host) e
  o payload chega como um único stream tar no stdin da segunda invocação.
- **(B) conexão do workbench.** Encaminhar o socket do servidor remoto até o
  cliente para que a janela fale com o extension host.

Sem `ControlMaster`, (B) tem saída direta e medida (`-L` funciona). É **(A)** que
fica exposto: sem reuso, cada invocação autentica de novo.

## 3. opções

### O-1 — segunda sessão `ssh -N -L` no lugar de `ControlMaster` (preferência atual do backlog)

Resolve **(B)**. Um único caminho de código serve aos dois clientes, e a
dependência que criou o problema desaparece.

- **custo:** uma autenticação a mais; e é preciso resolver o `socketPath` efetivo
  **antes** de abrir o encaminhamento — hoje esse valor chega no handshake, então
  a ordem das operações muda.
- **prova exigida:** janela Windows real conectando a host Linux real, com o
  extension host respondendo e o encaminhamento sobrevivendo a uma reconexão.
- **não resolve (A).**

### O-2 — staging em uma invocação só

Dobrar script e payload no **mesmo** stdin, com delimitador, de modo que (A)
deixe de precisar de duas invocações. Elimina a necessidade de multiplexação em
vez de substituí-la.

- **custo:** o script passa a consumir o próprio stdin restante como stream tar —
  desenho mais delicado, e a validação por manifesto (tamanho + SHA-256, apagar
  o staging em qualquer divergência, `mv -T` atômico) precisa continuar
  exatamente igual. Nenhuma dessas guardas pode ser relaxada para simplificar.
- **benefício além do Windows:** vale para Linux também, e reduz de duas para uma
  a superfície de autenticação em ambos.
- **prova exigida:** staging completo, mais um caso de payload corrompido em que
  a divergência de SHA-256 apaga o staging e **não** ativa.

### O-3 — `ManagedResolvedAuthority` sobre stdio, sem porta encaminhada

O cliente fala com o servidor pelo próprio stdio da sessão `ssh`, sem porta local.

- **custo:** é o desvio maior dos três; muda o resolver, não só o transporte. E
  perde a propriedade de o encaminhamento ser inspecionável de fora do produto.
- **prova exigida:** a mesma de O-1, mais equivalência de comportamento com o
  caminho Linux atual.

### O-4 — aceitar N autenticações no Windows

Decisão explícita de que, no Windows, cada operação abre sua própria conexão.

- **custo:** latência e, dependendo da identidade, uma interação de credencial
  por operação. É exatamente o custo que hoje ninguém decidiu assumir.
- **é a opção honesta se nenhuma das outras for exercitada:** documenta a perda
  em vez de escondê-la.

### O-5 — remover Windows da matriz declarada

`docs/SSH-CONTRACT.md` deixa de declarar Windows como suportado até haver
caminho provado.

- **custo:** nenhum trabalho de engenharia; fecha `T-056` sem fechar `AC-007` na
  linha Windows, e o gate MVP multiplataforma do remoto some do escopo.
- **é a única saída que não exige runner Windows.**

## 4. o que este documento recomenda

**O-1 + O-2, nessa ordem**, se houver runner Windows disponível para prova; **O-5**
se não houver.

Motivo: O-1 já tem medição favorável (`-L` aceito) e serve aos dois clientes com
um caminho só; O-2 remove a causa em vez de contorná-la e melhora também o Linux.
O-3 é desproporcional para o problema medido. O-4 é aceitável como registro, mas
transforma em permanente um custo que O-2 elimina.

Se prova em cliente Windows real não for possível, **O-5 é preferível a qualquer
implementação não exercitada**: pelo critério de aceite de `T-056`, declarar
suporte sem caminho é o defeito, e implementar sem prova apenas o disfarça.

## 5. o que falta o responsável responder

1. Existe cliente Windows real disponível para prova, ou só o runner Windows que
   hospeda o WSL?
2. Escolha entre O-1/O-2, O-4 e O-5.
3. Se O-2 entra: ela altera o caminho Linux **já provado**, então precisa de
   autorização própria para reexercitar o staging que hoje está verde.
