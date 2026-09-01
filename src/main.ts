import "./env";
import { create, Whatsapp, Message } from "@wppconnect-team/wppconnect";
import { GastosService } from "./services/gastos.service";
import { GastosRepository } from "./repositories/gastos.repositories";
import { UsuariosService } from "./services/usuarios.service";
import { UsuariosRepository } from "./repositories/usuarios.repositories";
import { MensagensService } from "./services/mensagens.service";
import { MensagensRepository } from "./repositories/mensagens.repositories";
import { SugestoesService } from "./services/sugestoes.service";
import { SugestoesRepository } from "./repositories/sugestoes.repositories";
import { handleMessage } from "./handlers/mensagem.handler";

const gastosService = new GastosService(new GastosRepository());
const usuariosService = new UsuariosService(new UsuariosRepository());
const mensagensService = new MensagensService(new MensagensRepository());
const sugestoesService = new SugestoesService(new SugestoesRepository());

create({
  session: process.env.WPP_SESSION || "default",
  browserArgs: ["--no-sandbox", "--disable-setuid-sandbox"],
})
  .then((client: Whatsapp): Promise<void> => start(client))
  .catch((error) => {
    console.error("Erro ao criar o cliente:", error);
  });

async function start(client: Whatsapp): Promise<void> {
  // QR code será gerado no terminal.
  console.log("\n\n\nCliente iniciado! Escaneie o QR Code com seu celular.");

  client.onMessage((message: Message) =>
    handleMessage(client, message, {
      gastosService,
      usuariosService,
      mensagensService,
      sugestoesService,
    }),
  );
}
