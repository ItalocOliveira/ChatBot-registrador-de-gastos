import { Whatsapp } from "@wppconnect-team/wppconnect";
import {
  CreateUsuarioDto,
  IUsuarioRepository,
} from "../interfaces/IUsuariosRepository";

export class UsuariosService {
  constructor(private readonly usuarioRepository: IUsuarioRepository) {}

  async create(data: CreateUsuarioDto) {
    return this.usuarioRepository.create(data);
  }

  async findOne(numero: string) {
    return this.usuarioRepository.findOne(numero);
  }

  // Quando o WhatsApp esconde o número real por trás de um @lid, resolve pra
  // "<numero>@c.us" via getPnLidEntry, pra não cadastrar o mesmo usuário duas
  // vezes com IDs diferentes. Se a resolução falhar ou não vier phoneNumber
  // (contato ainda não sincronizado o suficiente pro WhatsApp mapear), cai de
  // volta pro @lid original — melhor persistir algo do que travar o fluxo.
  //
  // Não usar o resultado disso pra enviar mensagens: client.sendText precisa
  // do chatId original da conversa, que pode ser o @lid mesmo.
  async resolverNumeroCanonico(
    client: Whatsapp,
    from: string,
  ): Promise<string> {
    if (!from.endsWith("@lid")) return from;

    try {
      const pnLidEntry = await client.getPnLidEntry(from);
      return pnLidEntry.phoneNumber?._serialized || from;
    } catch (error) {
      console.error("Falha ao resolver @lid via getPnLidEntry:", error);
      return from;
    }
  }
}
