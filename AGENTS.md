# AGENTS.md

Contexto para qualquer agente (humano ou IA) que for mexer neste projeto.

## O que é o projeto

Bot de WhatsApp para controle de gastos pessoais. O usuário manda uma mensagem em linguagem natural (ex: "gastei 50 no mercado") e o bot registra o gasto num banco Postgres, ou responde de forma apropriada se a mensagem não for um gasto completo.

O bot tem "personalidade": as respostas são informais e usam gírias/palavrão leve em português brasileiro, de propósito — isso é uma decisão de produto, não um bug de tom.

## Princípio arquitetural central: "a IA classifica, o código decide"

Este é o ponto mais importante para entender antes de mexer em qualquer coisa:

- A OpenAI (`src/services/extracaoGasto.service.ts`) **só classifica** a mensagem do usuário em um `tipo` (enum fechado via JSON Schema `strict: true`) e extrai `valor`/`categoria`/`descricao` quando aplicável.
- A IA **nunca gera texto de resposta livre** e **nunca tem acesso ao banco de dados** — ela não sabe quanto o usuário já gastou, não pode inventar totais.
- Todo o resto (o que fazer com a classificação, qual frase mandar, cálculo de totais) é decidido em código, sem chamada nenhuma à IA.

Isso existe por dois motivos: custo (menos tokens de saída) e confiabilidade (a IA não pode alucinar números financeiros). **Não reintroduza geração de texto livre pela IA para as respostas do bot** sem entender que isso quebra essa garantia.

## Fluxo de uma mensagem

`main.ts` faz só bootstrap (cria o client WPPConnect, instancia `GastosService`/`UsuariosService`/`MensagensService`/`SugestoesService` com seus repositories, e liga `client.onMessage` no handler). Toda a lógica de processar mensagem está em `handleMessage` (`src/handlers/mensagem.handler.ts`), que recebe `client`, `message` e `{ gastosService, usuariosService, mensagensService, sugestoesService }` por parâmetro:

1. Ignora mensagens de grupo ou vazias.
2. **Resolução/cadastro de usuário (dentro do mesmo `try/catch` do resto):** chama `usuariosService.resolverNumeroCanonico(client, message.from)` (ver seção `@lid` abaixo) e depois `usuariosService.findOne(numeroCanonico)`; se não existir, chama `usuariosService.create(...)`. O resultado (existente ou recém-criado) fica guardado na variável `usuario` — seu `usuario.id` é usado depois como FK em `Gasto.usuarioId` e como filtro em `getGastosDoMes`. Isso roda em **toda** mensagem válida, antes de qualquer classificação da IA — não só em mensagens do tipo `gasto`.
3. Chama `extrairGasto(message.body)` → retorna `{ tipo, valor, categoria, descricao }`.
3.1. Dispara (sem `await` bloqueante, `.catch` próprio) `mensagensService.create({ numero: numeroCanonico, nome, texto: message.body, tipo: resultado.tipo })` — ver seção "Estoque de mensagens" abaixo. Roda pra **toda** mensagem válida, independente do `tipo`, e uma falha aqui não pode derrubar o resto do fluxo.
4. Se `tipo === "gasto"`: valida que valor/categoria/descricao não são `null` e chama `gastosService.create({ ..., usuarioId: usuario.id })`, que persiste via `GastosRepository` (Prisma).
5. Se `tipo === "resumo"`: manda uma resposta de "vou verificar", busca `gastosService.getGastosDoMes(usuario.id)` — **só os gastos do usuário que pediu**, não de todo mundo — soma os valores em código e manda o total numa segunda mensagem.
6. Se `tipo === "sugestao"`: ver seção "Comando `/sugestao`" abaixo — tem uma verificação extra em código antes de confiar na classificação da IA.
7. Para qualquer outro tipo: só manda uma resposta sorteada, sem tocar no banco.
8. Qualquer erro no `try/catch` (que envolve tanto o cadastro de usuário quanto a classificação/gasto/resumo/sugestão) cai numa mensagem genérica de erro para o usuário.

## Tipos de mensagem (`TipoMensagem`, em `src/types/gasto.ts`)

| Tipo | Significado | Ação em `main.ts` |
|---|---|---|
| `gasto` | valor + item identificáveis | grava no banco |
| `sem_item` | tem valor, falta o item | só responde |
| `sem_preco` | tem item, falta o valor | só responde |
| `saudacao` | cumprimento | só responde |
| `agradecimento` | agradecimento | só responde |
| `outro` | fora do escopo / sem contexto | só responde |
| `resumo` | pedido de total do mês | consulta banco e responde com total |
| `sugestao` | mensagem começa com `/sugestao` | grava em `Sugestao` (ver seção própria) |
| `sugestao_mal_feita` | parece sugestão, mas sem o comando `/sugestao` | só responde, pedindo pra reenviar com `/sugestao` |
| `comando` | mensagem é exatamente `/comandos` | só responde, com a lista de comandos disponíveis |
| `comando_mal_feito` | `/comandos` seguido de mais texto | só responde, pedindo pra mandar `/comandos` sozinho |

Se adicionar um novo tipo, é preciso atualizar em **três lugares ao mesmo tempo** (o TypeScript não vai reclamar se você esquecer um deles fora do `Record`):
1. `TipoMensagem` em `src/types/gasto.ts`
2. `enum` do `SCHEMA_RESULTADO` + texto das `INSTRUCOES` em `src/services/extracaoGasto.service.ts`
3. Entrada correspondente em `RESPOSTAS` (`src/config/respostas.ts`) — o `Record<TipoMensagem, string[]>` obriga todos os tipos a terem lista de respostas, então esquecer um dá erro de compilação ali, mas os outros dois pontos não têm essa rede de segurança.

## Sorteio de respostas (`src/config/respostas.ts`)

- Cada `TipoMensagem` tem uma lista fixa de frases pré-escritas (mantendo a personalidade/tom do bot).
- `sortearResposta(tipo)` sorteia uma frase aleatoriamente **e evita repetir a última frase sorteada para aquele tipo** (guarda o último índice em memória, `ultimoIndice`).
- Essa memória é só em runtime do processo (reseta ao reiniciar o bot) — é suficiente porque o objetivo é só evitar repetição imediata, não é analytics nem estado persistente.
- **Importante:** anteriormente a IA tentava sortear a resposta sozinha via prompt ("sorteie uma delas") e isso não funcionava bem — LLMs tendem a favorecer sempre a mesma opção de uma lista. Por isso o sorteio foi movido para o código. Não volte a delegar essa escolha ao modelo.
- Ao editar as listas de frases, evite deixar uma lista com só 1 item — o anti-repetição fica sem efeito (o `while` em `sortearResposta` entraria em loop infinito se a lista tivesse 1 item e esse item já fosse o `ultimoIndice`... na prática isso não trava porque a condição `respostas.length > 1` protege esse caso, mas listas de 1 item matam a variedade).

## Camadas / arquitetura

```
main.ts  →  handlers/mensagem.handler.ts  →  services/gastos.service.ts       →  repositories/gastos.repositories.ts      →  Prisma → Postgres (Neon)
                                        ↘   services/usuarios.service.ts     →  repositories/usuarios.repositories.ts    →  Prisma → Postgres (Neon)
                                        ↘   services/mensagens.service.ts    →  repositories/mensagens.repositories.ts   →  Prisma → Postgres (Neon)
                                        ↘   services/sugestoes.service.ts    →  repositories/sugestoes.repositories.ts   →  Prisma → Postgres (Neon)
                                        ↘   services/extracaoGasto.service.ts  →  OpenAI
```

- `main.ts` só faz bootstrap: cria o client, instancia os services/repositories, e passa tudo pro `handleMessage` via `client.onMessage`. Não coloque lógica de negócio de volta em `main.ts` — isso é o que a última reorganização tirou de lá de propósito.
- `handleMessage` (`src/handlers/mensagem.handler.ts`) recebe `client`, `message` e `{ gastosService, usuariosService }` como parâmetros (não importa singletons globais) — facilita teste/mock no futuro.
- `GastosService` depende de `IGastosRepository` (interface, `src/interfaces/IGastosRepository.ts`), não da classe concreta — injeção de dependência via construtor. Se precisar trocar a fonte de dados ou mockar em teste, implemente a interface, não altere `GastosService`.
- Mesmo padrão para usuários: `UsuariosService` (`src/services/usuarios.service.ts`) depende de `IUsuarioRepository` (interface, `src/interfaces/IUsuariosRepository.ts` — repare que o **arquivo** é plural (`IUsuariosRepository.ts`) mas a **interface** exportada é singular (`IUsuarioRepository`), inconsistente com `IGastosRepository`). Além de `create`/`findOne`, `UsuariosService` também expõe `resolverNumeroCanonico(client, from)` (ver seção `@lid` abaixo) — é o único método do service que depende do client WPPConnect, passado por parâmetro em vez de guardado no construtor, pra não acoplar o service à lib do WhatsApp. `UsuariosRepository` (`src/repositories/usuarios.repositories.ts`) implementa via Prisma. Instanciado em `main.ts` junto com `GastosRepository`/`GastosService`.
- `src/lib/prisma.ts` exporta um **singleton** do `PrismaClient` (padrão `globalThis`, evita múltiplas conexões em hot-reload). Sempre importe `prisma` daqui — nunca instancie `new PrismaClient()` em outro lugar.
- `src/env.ts` só faz `process.loadEnvFile()`. Ele **precisa ser o primeiro import em `main.ts`** (`import "./env"` na linha 1) — imports em TS viram `require()` em ordem, e qualquer módulo que leia `process.env` no escopo de módulo (como `new OpenAI()` em `extracaoGasto.service.ts`) precisa que o `.env` já esteja carregado antes de ser importado.

## Banco de dados (Prisma 7 + Neon)

- Schema em `prisma/schema.prisma`, quatro models:
  - `Gasto` (`id`, `valor`, `categoria`, `descricao`, `createdAt`, `usuarioId`), mapeado para a tabela `gastos`.
  - `Usuario` (`id`, `numero` — `@unique` —, `nome` opcional, `gastos` — relação inversa), mapeado para a tabela `usuarios`, **sem `createdAt`**.
  - `Mensagem` (`id`, `numero`, `nome` opcional, `texto`, `tipo` opcional, `createdAt`), mapeado para a tabela `mensagens` — ver seção "Estoque de mensagens" abaixo. **Não tem relação/FK com `Usuario`** (por design, é um log solto, não normalizado).
  - `Sugestao` (`id`, `numero`, `nome` opcional, `texto`, `createdAt`), mapeado para a tabela `sugestoes` — ver seção "Comando `/sugestao`" abaixo. Também sem FK com `Usuario`, mesmo motivo.
  - `Gasto.usuarioId` é FK obrigatória pra `Usuario` (`@relation`) — todo gasto tem dono. `handleMessage` resolve/cadastra o `Usuario` **antes** de criar o `Gasto`, e usa `usuario.id` no `usuarioId`. Não crie `Gasto` sem passar por esse fluxo de resolução de usuário primeiro.
- `valor` é `String` no schema (não `Decimal`/`Float`) — a conversão pra número acontece em código (`Number(gasto.valor)` em `getGastosDoMes`/soma do resumo, `String(resultado.valor)` ao criar). Se for mexer em cálculos monetários, cuidado com essa conversão string↔número.
- `getGastosDoMes()` filtra por `createdAt` usando `gte`/`lt` (início do mês atual até início do mês seguinte) — calculado em JS a partir de `new Date()`, não no banco.
- Usa driver adapter (`@prisma/adapter-pg` + `pg`), exigido pelo Prisma ORM 7 mesmo com Postgres "normal" — não tente voltar para a instanciação antiga sem adapter.
- Depois de qualquer mudança em `schema.prisma`, rode `npx prisma generate` (client fica em `app/generated/prisma`, fora de `src/`) e crie uma migration com `npx prisma migrate dev --name <algo>`.
- **Nunca rode `prisma migrate reset`, `db push --force-reset` ou `db push --accept-data-loss` sem confirmação explícita do usuário na mensagem atual** — são destrutivos e apagam dados/histórico de migration.

## Variáveis de ambiente (`.env`, não commitado)

- `WPP_SESSION` — nome da sessão WPPConnect (evita re-escanear QR Code).
- `OPENAI_API_KEY` — usada só pra classificação, consumo de tokens baixo (a IA não gera texto livre).
- `DATABASE_URL` — connection string do Postgres (Neon). Note que `.env.example` hoje **não lista essa variável** — é uma lacuna conhecida, mas ela é obrigatória para o projeto rodar.
- Depois de qualquer alteração no `.env`, é preciso **reiniciar o processo** (`npm run dev`) — `process.loadEnvFile()` só roda uma vez, no boot.

## `@lid` do WhatsApp e resolução de número canônico

Em alguns casos, `message.from` chega no formato `<algo>@lid` em vez do tradicional `<numero>@c.us`, por causa de um recurso de privacidade do próprio WhatsApp que esconde o número real (confirmado em produção: contatos como `Oliveira`, `Lunna`, `Pedro Assunção` chegam só como `@lid`, nunca vimos `@c.us` até agora).

Como `handleMessage` persiste `numero` como `@unique` em `Usuario`, um `@lid` cru geraria um `Usuario` duplicado por pessoa se o mesmo contato variar de formato. Isso é resolvido por `usuariosService.resolverNumeroCanonico(client, from)` (`src/services/usuarios.service.ts`):
- Se `from` não termina em `@lid`, retorna ele mesmo sem chamada extra.
- Se termina em `@lid`, chama `client.getPnLidEntry(from)` (método nativo do `@wppconnect-team/wppconnect`, resolve mapeamento LID↔telefone) e usa `phoneNumber._serialized` (formato confirmado em teste real: `"558393804313@c.us"`) como número canônico.
- Se a chamada falhar ou não vier `phoneNumber` (contato ainda não sincronizado o bastante pro WhatsApp mapear), cai de volta pro `@lid` original — melhor persistir algo do que travar o fluxo; nesse caso o risco de duplicata descrito acima ainda existe, é só um fallback de última instância.

**Importante:** esse número resolvido é usado **só** para persistir/consultar `Usuario` (`numeroCanonico`). Para `client.sendText(...)`, continue usando `numUsuario` (= `message.from`, o `@lid` original quando for o caso) — o `sendText` precisa do `chatId` original da conversa, trocar por `phoneNumber._serialized` provavelmente quebra o envio.

## Estoque de mensagens (`Mensagem` / `MensagensService`)

Toda mensagem válida que passa por `handleMessage` (depois da classificação, ver passo 3.1 do fluxo acima) é salva crua via `mensagensService.create({ numero, nome, texto, tipo })` (`src/services/mensagens.service.ts` → `src/repositories/mensagens.repositories.ts` → tabela `mensagens`). `numero` é o número já resolvido (`numeroCanonico`), não o `@lid` cru.

- **Objetivo:** formar um estoque de mensagens reais pra curadoria manual futura — a ideia é revisar isso periodicamente e, com base nos padrões encontrados, adicionar respostas variadas fixas nas instruções da IA (`src/services/extracaoGasto.service.ts`) como pares pergunta/resposta catalogados. **Não é fine-tuning nem geração automática** — a curadoria é manual, feita pelo usuário do projeto.
- **Por que ainda não foi usado:** essa fase de curadoria só deve começar quando o bot estiver gerando renda o suficiente pra sustentar o aumento de tokens no prompt (cada Q&A adicionado às instructions aumenta o tamanho do prompt enviado em toda mensagem). Até lá, é só coleta passiva — não construa nenhuma feature de leitura/consumo desses dados sem pedido explícito.
- A gravação é **best-effort e não bloqueante para o resto do fluxo**: é disparada sem impedir o restante do `try` e tem `.catch` próprio (loga erro no console) — uma falha ao salvar a mensagem não pode gerar a mensagem genérica de erro pro usuário nem impedir a resposta do gasto/resumo.
- Sem relação com `Usuario` de propósito — é um log solto, mais simples de escrever e sem risco de travar a persistência do gasto/resumo por causa de uma FK.

## Comando `/sugestao` (`Sugestao` / `SugestoesService`)

Usuários podem mandar sugestões de melhoria pro bot (funções, interações, etc) prefixando a mensagem com `/sugestao`. Ex: `/sugestao adiciona a função de ver quais itens eu comprei ao invés de apenas a quantidade de registros`.

- A IA classifica isso como `tipo === "sugestao"` (`src/services/extracaoGasto.service.ts`, tipo 8 nas `INSTRUCOES`/`SCHEMA_RESULTADO`) **apenas quando a mensagem começa literalmente com `/sugestao`** (case-insensitive) — instrução explícita no prompt pra IA nunca usar esse tipo por mensagens que só *falem sobre* melhorias sem o comando.
- Se a mensagem parece claramente uma sugestão (algo que o usuário quer que seja adicionado/mudado/melhorado) mas **não** veio com `/sugestao`, a IA classifica como `tipo === "sugestao_mal_feita"` (tipo 9 nas `INSTRUCOES`) — não confundir com `outro`, que é o catch-all genérico. Esse tipo não grava nada no banco: cai direto no fallback padrão do `handleMessage` (`await client.sendText(numUsuario, sortearResposta(resultado.tipo))`, sem branch dedicado), só respondendo pra pedir que o usuário reenvie com `/sugestao` na frente (respostas em `RESPOSTAS.sugestao_mal_feita`, `src/config/respostas.ts`).
- `descricao` é reaproveitado pra carregar o texto da sugestão (a mensagem sem o prefixo `/sugestao`, já trimada). Não existe campo dedicado pra isso no schema do resultado — não confunda com uma sugestão de gasto.
- **Defesa em profundidade em `handleMessage`:** mesmo confiando na IA, o handler faz sua própria checagem (`message.body.trim().toLowerCase().startsWith("/sugestao")`) antes de tratar como sugestão — se a IA classificar errado (raro, mas o schema não impede), cai pra resposta de `outro` em vez de gravar lixo em `Sugestao`. Se o comando bater mas `descricao` vier vazio (ex: só `/sugestao` sem nada depois), o bot pede pra reenviar com o texto, sem gravar nada.
- `sugestoesService.create({ numero: numeroCanonico, nome, texto: resultado.descricao })` grava direto em `Sugestao`, com `numeroCanonico` (mesmo número resolvido de `@lid`, não o `Usuario.numero` — não há FK aqui).
- Não existe (ainda) nenhuma feature de leitura dessas sugestões — é só coleta, igual ao estoque de mensagens acima. Não construa dashboard/consulta disso sem pedido explícito.

## Comando `/comandos`

Mensagem exatamente `/comandos` (sem mais nada, case-insensitive, trim) faz a IA classificar como `tipo === "comando"` (tipo 10 nas `INSTRUCOES`/`SCHEMA_RESULTADO`, `src/services/extracaoGasto.service.ts`). Se vier `/comandos` seguido de qualquer outro texto (ex: `/comandos gasto`), é `tipo === "comando_mal_feito"` (tipo 11).

- Nenhum dos dois grava nada no banco nem tem branch dedicado em `handleMessage` — ambos caem no fallback padrão do fim da função (`sortearResposta(resultado.tipo)`).
- `RESPOSTAS.comando` (`src/config/respostas.ts`) guarda o texto de ajuda com a lista de comandos disponíveis. **Atenção:** hoje essa lista tem só 1 item — é proposital (é texto informativo, não teria sentido variar), mas lembre de manter esse texto atualizado manualmente toda vez que um comando novo for adicionado (`/sugestao`, futuros comandos, etc), já que nada gera essa lista dinamicamente a partir do código.
- `RESPOSTAS.comando_mal_feito` só orienta o usuário a mandar `/comandos` sozinho.
- Diferente de `/sugestao`, não há checagem extra em código no `handleMessage` pra `comando`/`comando_mal_feito` — como nenhum dos dois persiste dado nenhum, uma classificação errada da IA aqui não tem risco de gravar lixo no banco, só de mandar a resposta "errada" (baixo risco).

## O que evitar

- Não adicione validação/fallback para cenários que a IA já garante via `strict: true` no JSON Schema (ex: `tipo` fora do enum) — o schema já impede isso na origem.
- Não faça a IA gerar a resposta final de novo (veja "princípio arquitetural" acima).
- Não instancie `PrismaClient` fora de `src/lib/prisma.ts`.
- Não esqueça o `await` nas chamadas ao Prisma/OpenAI/`client.sendText` — já rolou bug de esquecimento de `async`/`await`/`return` durante o desenvolvimento deste projeto, então isso é revisado com atenção em qualquer PR aqui.
