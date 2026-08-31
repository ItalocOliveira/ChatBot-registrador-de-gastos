import { Whatsapp, Message } from "@wppconnect-team/wppconnect";
import { extrairGasto } from "../services/extracaoGasto.service";
import { GastosService } from "../services/gastos.service";
import { UsuariosService } from "../services/usuarios.service";
import { sortearResposta } from "../config/respostas";

interface MensagemHandlerDeps {
  gastosService: GastosService;
  usuariosService: UsuariosService;
}

export async function handleMessage(
  client: Whatsapp,
  message: Message,
  { gastosService, usuariosService }: MensagemHandlerDeps,
): Promise<void> {
  // Ignora mensagens de grupo ou vazias
  if (message.isGroupMsg || !message.body) return;

  const numUsuario = message.from;
  const nomeUsuario = message.sender.pushname;

  console.log("--- Nova Mensagem Recebida ---");
  console.log("De:", numUsuario);
  console.log("Nome:", nomeUsuario);
  console.log("Conteúdo da mensagem:", message.body);
  console.log("--------------------------------\n");

  try {
    // Resolve o número real quando o WhatsApp esconde ele atrás de um @lid,
    // pra não cadastrar o mesmo usuário duas vezes com IDs diferentes.
    // Não usar isso pra enviar mensagens: o sendText precisa do chatId
    // original (numUsuario), que pode ser o @lid mesmo.
    const numeroCanonico = await usuariosService.resolverNumeroCanonico(
      client,
      numUsuario,
    );

    // Verificar se o número do usário já está registrado no banco
    let usuario = await usuariosService.findOne(numeroCanonico);

    if (!usuario) {
      // Salvar o número do usuário que enviou mensagem
      usuario = await usuariosService.create({
        numero: numeroCanonico,
        nome: nomeUsuario,
      });

      console.log("--- Novo Número Cadastrado ---");
      console.log(`Cadastrado o Número: ${numeroCanonico}`);
      console.log("--------------------------------\n");
    }

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
        usuarioId: usuario.id,
      });
    }

    // -----------------------------
    //            RESUMO
    // -----------------------------
    if (resultado.tipo === "resumo") {
      await client.sendText(numUsuario, sortearResposta(resultado.tipo));

      const gastosDoMes = await gastosService.getGastosDoMes(usuario.id);
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
}
