import { Mensagem } from "../generated/prisma/client";
import {
  CreateMensagemDto,
  IMensagensRepository,
} from "../interfaces/IMensagensRepository";
import { prisma } from "../lib/prisma";

export class MensagensRepository implements IMensagensRepository {
  async create(data: CreateMensagemDto): Promise<Mensagem> {
    const result = await prisma.mensagem.create({
      data: {
        numero: data.numero,
        nome: data.nome || undefined,
        texto: data.texto,
        tipo: data.tipo || undefined,
      },
    });

    return result;
  }
}
