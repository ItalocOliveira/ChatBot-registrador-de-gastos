import { Sugestao } from "../../app/generated/prisma/client";
import {
  CreateSugestaoDto,
  ISugestoesRepository,
} from "../interfaces/ISugestoesRepository";
import { prisma } from "../lib/prisma";

export class SugestoesRepository implements ISugestoesRepository {
  async create(data: CreateSugestaoDto): Promise<Sugestao> {
    const result = await prisma.sugestao.create({
      data: {
        numero: data.numero,
        nome: data.nome || undefined,
        texto: data.texto,
      },
    });

    return result;
  }
}
