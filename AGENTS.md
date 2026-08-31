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

`main.ts` faz só bootstrap (cria o client WPPConnect, instancia `GastosService`/`UsuariosService` com seus repositories, e liga `client.onMessage` no handler). Toda a lógica de processar mensagem está em `handleMessage` (`src/handlers/mensagem.handler.ts`), que recebe `client`, `message` e `{ gastosService, usuariosService }` por parâmetro:

1. Ignora mensagens de grupo ou vazias.
2. **Resolução/cadastro de usuário (dentro do mesmo `try/catch` do resto):** chama `usuariosService.resolverNumeroCanonico(client, message.from)` (ver seção `@lid` abaixo) e depois `usuariosService.findOne(numeroCanonico)`; se não existir, chama `usuariosService.create(...)`. O resultado (existente ou recém-criado) fica guardado na variável `usuario` — seu `usuario.id` é usado depois como FK em `Gasto.usuarioId` e como filtro em `getGastosDoMes`. Isso roda em **toda** mensagem válida, antes de qualquer classificação da IA — não só em mensagens do tipo `gasto`.
3. Chama `extrairGasto(message.body)` → retorna `{ tipo, valor, categoria, descricao }`.
4. Se `tipo === "gasto"`: valida que valor/categoria/descricao não são `null` e chama `gastosService.create({ ..., usuarioId: usuario.id })`, que persiste via `GastosRepository` (Prisma).
5. Se `tipo === "resumo"`: manda uma resposta de "vou verificar", busca `gastosService.getGastosDoMes(usuario.id)` — **só os gastos do usuário que pediu**, não de todo mundo — soma os valores em código e manda o total numa segunda mensagem.
6. Para qualquer outro tipo: só manda uma resposta sorteada, sem tocar no banco.
7. Qualquer erro no `try/catch` (que envolve tanto o cadastro de usuário quanto a classificação/gasto/resumo) cai numa mensagem genérica de erro para o usuário.

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
main.ts  →  handlers/mensagem.handler.ts  →  services/gastos.service.ts     →  repositories/gastos.repositories.ts    →  Prisma → Postgres (Neon)
                                        ↘   services/usuarios.service.ts   →  repositories/usuarios.repositories.ts  →  Prisma → Postgres (Neon)
                                        ↘   services/extracaoGasto.service.ts  →  OpenAI
```

- `main.ts` só faz bootstrap: cria o client, instancia os services/repositories, e passa tudo pro `handleMessage` via `client.onMessage`. Não coloque lógica de negócio de volta em `main.ts` — isso é o que a última reorganização tirou de lá de propósito.
- `handleMessage` (`src/handlers/mensagem.handler.ts`) recebe `client`, `message` e `{ gastosService, usuariosService }` como parâmetros (não importa singletons globais) — facilita teste/mock no futuro.
- `GastosService` depende de `IGastosRepository` (interface, `src/interfaces/IGastosRepository.ts`), não da classe concreta — injeção de dependência via construtor. Se precisar trocar a fonte de dados ou mockar em teste, implemente a interface, não altere `GastosService`.
- Mesmo padrão para usuários: `UsuariosService` (`src/services/usuarios.service.ts`) depende de `IUsuarioRepository` (interface, `src/interfaces/IUsuariosRepository.ts` — repare que o **arquivo** é plural (`IUsuariosRepository.ts`) mas a **interface** exportada é singular (`IUsuarioRepository`), inconsistente com `IGastosRepository`). Além de `create`/`findOne`, `UsuariosService` também expõe `resolverNumeroCanonico(client, from)` (ver seção `@lid` abaixo) — é o único método do service que depende do client WPPConnect, passado por parâmetro em vez de guardado no construtor, pra não acoplar o service à lib do WhatsApp. `UsuariosRepository` (`src/repositories/usuarios.repositories.ts`) implementa via Prisma. Instanciado em `main.ts` junto com `GastosRepository`/`GastosService`.
- `src/lib/prisma.ts` exporta um **singleton** do `PrismaClient` (padrão `globalThis`, evita múltiplas conexões em hot-reload). Sempre importe `prisma` daqui — nunca instancie `new PrismaClient()` em outro lugar.
- `src/env.ts` só faz `process.loadEnvFile()`. Ele **precisa ser o primeiro import em `main.ts`** (`import "./env"` na linha 1) — imports em TS viram `require()` em ordem, e qualquer módulo que leia `process.env` no escopo de módulo (como `new OpenAI()` em `extracaoGasto.service.ts`) precisa que o `.env` já esteja carregado antes de ser importado.

## Banco de dados (Prisma 7 + Neon)

- Schema em `prisma/schema.prisma`, dois models:
  - `Gasto` (`id`, `valor`, `categoria`, `descricao`, `createdAt`, `usuarioId`), mapeado para a tabela `gastos`.
  - `Usuario` (`id`, `numero` — `@unique` —, `nome` opcional, `gastos` — relação inversa), mapeado para a tabela `usuarios`, **sem `createdAt`**.
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

## O que evitar

- Não adicione validação/fallback para cenários que a IA já garante via `strict: true` no JSON Schema (ex: `tipo` fora do enum) — o schema já impede isso na origem.
- Não faça a IA gerar a resposta final de novo (veja "princípio arquitetural" acima).
- Não instancie `PrismaClient` fora de `src/lib/prisma.ts`.
- Não esqueça o `await` nas chamadas ao Prisma/OpenAI/`client.sendText` — já rolou bug de esquecimento de `async`/`await`/`return` durante o desenvolvimento deste projeto, então isso é revisado com atenção em qualquer PR aqui.
