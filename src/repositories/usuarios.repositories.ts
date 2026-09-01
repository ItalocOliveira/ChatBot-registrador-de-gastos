import { Usuario } from "../generated/prisma/client";
import {
  CreateUsuarioDto,
  IUsuarioRepository,
} from "../interfaces/IUsuariosRepository";
import { prisma } from "../lib/prisma";

export class UsuariosRepository implements IUsuarioRepository {
  async create(data: CreateUsuarioDto): Promise<Usuario> {
    const result = await prisma.usuario.create({
      data: {
        numero: data.numero,
        nome: data.nome || undefined,
      },
    });

    return result;
  }

  async findOne(numero: string): Promise<Usuario | null> {
    const result = await prisma.usuario.findUnique({
      where: {
        numero: numero,
      },
    });

    return result;
  }
}
