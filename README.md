# Bot de Controle de Gastos

Um bot de WhatsApp mal-educado, mas competente, que anota seus gastos pra você. Manda uma mensagem tipo `"gastei 50 no mercado"` e ele registra sozinho — sem planilha, sem app, só o zap mesmo.

Feito com **Node.js**, **TypeScript**, **WPPConnect**, **OpenAI (Structured Outputs)** e **Prisma ORM 7** com **Neon Postgres**.

---

## Como funciona

1. Você manda uma mensagem no WhatsApp.
2. A OpenAI **classifica** a mensagem (é um gasto? falta o valor? é só um "oi"? é um pedido de resumo?) — ela **não inventa números nem gera a resposta**, só decide o tipo.
3. O código decide o que fazer com essa classificação: salva o gasto no banco, busca o resumo do mês, ou só solta uma resposta aleatória (com personalidade) de uma lista pré-definida.

A ideia central é **"a IA classifica, o código decide"**: o modelo nunca tem acesso aos dados reais, e a resposta final nunca é gerada livremente por ele — isso mantém o custo baixo e evita que o bot "alucine" valores.

### Tipos de mensagem reconhecidos

| Tipo | O que é | Exemplo |
|---|---|---|
| `gasto` | Valor + item identificáveis | "gastei 50 no mercado" |
| `sem_item` | Tem valor, falta o que foi comprado | "gastei 50 reais" |
| `sem_preco` | Tem item, falta o valor | "comprei um lanche" |
| `saudacao` | Cumprimento | "oi", "bom dia" |
| `agradecimento` | Agradecimento | "valeu", "obrigado" |
| `outro` | Sem contexto / fora do escopo | perguntas genéricas |
| `resumo` | Pedido de total/resumo do mês | "quanto gastei esse mês?" |

---

##  Tecnologias

- **Node.js + TypeScript**
- **[@wppconnect-team/wppconnect](https://github.com/wppconnect-team/wppconnect)** — integração com o WhatsApp
- **OpenAI API** (`gpt-5.6-luna`) — classificação via Structured Outputs (JSON Schema estrito)
- **Prisma ORM 7** + **[Neon](https://neon.tech)** (Postgres serverless) — persistência dos gastos
- **Arquitetura em camadas** — `repository` → `service` → `main.ts`, com injeção de dependência via interface (`IGastosRepository`)

---

## 📁 Estrutura

```
src/
├── main.ts                        # entrada: escuta mensagens e orquestra tudo
├── env.ts                         # carrega o .env antes de qualquer outra coisa
├── config/
│   └── respostas.ts                # listas de respostas + sorteio (sem repetir a última)
├── services/
│   ├── extracaoGasto.service.ts    # chamada à OpenAI (classificação)
│   └── gastos.service.ts           # regras de negócio
├── repositories/
│   └── gastos.repositories.ts      # acesso ao banco via Prisma
├── interfaces/
│   └── IGastosRepository.ts        # contrato do repositório
├── types/
│   └── gasto.ts                    # tipos compartilhados
└── lib/
    └── prisma.ts                   # singleton do Prisma Client
```

---

##  Como rodar

### Pré-requisitos
- Node.js 20+
- Uma chave de API da OpenAI
- Um banco Postgres (recomendado: [Neon](https://neon.tech), tem plano free)

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/bot-controle-de-gastos.git
cd bot-controle-de-gastos

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
```

Edite o `.env` com:

```bash
WPP_SESSION=minhaSessao
OPENAI_API_KEY=sua-chave-aqui
DATABASE_URL="postgresql://usuario:senha@host/banco?sslmode=require"
```

```bash
# 4. Rode as migrations
npx prisma migrate dev

# 5. Suba o bot
npm run dev
```

Escaneie o QR Code que aparece no terminal com o WhatsApp do celular. Pronto, o bot está online.

---

##  Sobre as variáveis de ambiente

- **`WPP_SESSION`** — nome da sessão do WhatsApp. A WPPConnect salva a autenticação localmente com esse nome; reiniciar o bot não pede QR Code de novo enquanto a sessão existir.
- **`OPENAI_API_KEY`** — usada só para classificar a intenção da mensagem (não gera texto livre, então o consumo de tokens é bem baixo).
- **`DATABASE_URL`** — string de conexão do Postgres (Neon ou outro), usada pelo Prisma para salvar e consultar os gastos.

---
