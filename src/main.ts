import "./env";
import { create, Whatsapp, Message } from "@wppconnect-team/wppconnect";
import { extrairGasto } from "./services/extracaoGasto.service";
import { GastosService } from "./services/gastos.service";
import { GastosRepository } from "./repositories/gastos.repositories";
import { sortearResposta } from "./config/respostas";

const gastosService = new GastosService(new GastosRepository());

create({
  session: process.env.WPP_SESSION || "default",
})
  .then((client: Whatsapp): Promise<void> => start(client))
  .catch((error) => {
    console.error("Erro ao criar o cliente:", error);
  });

async function start(client: Whatsapp): Promise<void> {
  // QR code será gerado no terminal.
  console.log("\n\n\nCliente iniciado! Escaneie o QR Code com seu celular.");

  // Listener de mensagens
  client.onMessage(async (message: Message) => {
    // Ignora mensagens de grupo ou vazias
    if (message.isGroupMsg || !message.body) return;

    const numUsuario = message.from;

    console.log("--- Nova Mensagem Recebida ---");
    console.log("De:", message.from);
    console.log("Nome:", message.sender.pushname);
    console.log("Conteúdo da mensagem:", message.body);
    console.log("--------------------------------\n");

    try {
      const resultado = await extrairGasto(message.body);

      // -----------------------------
      //            GASTO
      // -----------------------------
      if (resultado.tipo === "gasto") {
        if (
          resultado.valor === null ||
          resultado.categoria === null ||
          resultado.descricao === null
        ) {
          throw new Error(
            "Resultado do tipo 'gasto' veio sem valor/categoria/descricao.",
          );
        }

        console.log("Gasto registrado:", {
          valor: resultado.valor,
          categoria: resultado.categoria,
          descricao: resultado.descricao,
        });

        await gastosService.create({
          valor: String(resultado.valor),
          categoria: resultado.categoria,
          descricao: resultado.descricao,
        });
      }

      // -----------------------------
      //            RESUMO
      // -----------------------------
      if (resultado.tipo === "resumo") {
        await client.sendText(numUsuario, sortearResposta(resultado.tipo));

        const gastosDoMes = await gastosService.getGastosDoMes();
        const total = gastosDoMes.reduce(
          (soma, gasto) => soma + Number(gasto.valor),
          0,
        );

        await client.sendText(
          numUsuario,
          `Total gasto esse mês: R$ ${total.toFixed(2)} \n(${gastosDoMes.length} gastos registrados).`,
        );
        return;
      }

      await client.sendText(numUsuario, sortearResposta(resultado.tipo));
    } catch (error) {
      console.error("Erro ao processar mensagem com a OpenAI:", error);
      await client.sendText(
        numUsuario,
        "Perai, deu pau aqui. Tenta mandar a mensagem dnv pfv.",
      );
    }
  });
}
