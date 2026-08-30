import OpenAI from "openai";
import { ResultadoExtracao } from "../types/gasto";

const client = new OpenAI();

const INSTRUCOES = `Você é o classificador de mensagens de um bot de WhatsApp para controle de gastos pessoais.
Sua única tarefa é interpretar a mensagem do usuário e classificá-la em um dos tipos abaixo, preenchendo os campos correspondentes.
Você NÃO deve gerar nenhum texto de resposta — apenas a classificação. As respostas ao usuário são escolhidas pelo próprio sistema, fora do seu controle.

TIPOS:

1. "gasto" — a mensagem descreve claramente uma compra ou despesa, com valor e item identificáveis.
   Ex: "gastei 50 no mercado", "comprei um lanche por 20 reais", "acabei de comprar gasolina por 100"
   - valor: número do gasto (sem "R$", sem vírgula decimal).
   - categoria: palavra curta que resuma o tipo de gasto (ex: alimentação, transporte, lazer, mercado, saúde).
   - descricao: o item ou serviço comprado, como o usuário escreveu.

2. "sem_item" — o usuário informou que gastou dinheiro e o valor, mas não disse com o quê (ex: "gastei 50 reais", "paguei 20").
   - valor, categoria, descricao: null.

3. "sem_preco" — o usuário informou o que comprou, mas não disse o valor (ex: "comprei um lanche", "paguei uma conta", "gastei com gasolina").
   - valor, categoria, descricao: null.

4. "saudacao" — o usuário está apenas cumprimentando (oi, olá, bom dia, e aí, etc).
   - valor, categoria, descricao: null.

5. "agradecimento" — o usuário está agradecendo pelo registro ou pela ajuda do bot.
   - valor, categoria, descricao: null.

6. "outro" — qualquer mensagem que não se encaixe nos tipos acima (perguntas gerais, comandos ainda não suportados, mensagens sem contexto).
   - valor, categoria, descricao: null.

7. "resumo" — o usuário está pedindo um resumo, total ou lista dos gastos (ex: "quanto eu gastei esse mês", "me manda o resumo", "quanto já gastei", "total de gastos").
   - valor, categoria, descricao: null.
   - Você NÃO tem acesso aos valores reais gastos pelo usuário, então NÃO invente números.`;

const SCHEMA_RESULTADO = {
  type: "object",
  properties: {
    tipo: {
      type: "string",
      enum: [
        "gasto",
        "sem_item",
        "sem_preco",
        "saudacao",
        "agradecimento",
        "outro",
        "resumo",
      ],
      description: "Classificação da mensagem do usuário.",
    },
    valor: {
      type: ["number", "null"],
      description:
        "Valor do gasto, em reais. Null se não houver gasto identificado.",
    },
    categoria: {
      type: ["string", "null"],
      description:
        "Categoria curta do gasto. Null se não houver gasto identificado.",
    },
    descricao: {
      type: ["string", "null"],
      description: "O que foi comprado. Null se não houver gasto identificado.",
    },
  },
  required: ["tipo", "valor", "categoria", "descricao"],
  additionalProperties: false,
};

export async function extrairGasto(
  mensagem: string,
): Promise<ResultadoExtracao> {
  const response = await client.responses.create({
    model: "gpt-5.6-luna",
    instructions: INSTRUCOES,
    input: mensagem,
    text: {
      format: {
        type: "json_schema",
        name: "resultado_extracao",
        schema: SCHEMA_RESULTADO,
        strict: true,
      },
    },
  });

  return JSON.parse(response.output_text) as ResultadoExtracao;
}
