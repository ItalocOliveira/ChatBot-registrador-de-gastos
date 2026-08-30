import { Gasto } from "../../app/generated/prisma/client";
import {
  CreateGastoDto,
  IGastosRepository,
} from "../interfaces/IGastosRepository";
import { prisma } from "../lib/prisma";

export class GastosRepository implements IGastosRepository {
  async create(data: CreateGastoDto): Promise<Gasto> {
    const result = await prisma.gasto.create({
      data: {
        valor: data.valor,
        categoria: data.categoria,
        descricao: data.descricao,
      },
    });

    return result;
  }

  async getGastosDoMes(): Promise<Gasto[]> {
    // Obter a data atual
    const agora = new Date();

    // Obter inicio do mês atual
    const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    // Obter inicio do mês seguinte
    const inicioDoProximoMes = new Date(
      agora.getFullYear(),
      agora.getMonth() + 1,
      1,
    );

    const gastos = await prisma.gasto.findMany({
      where: {
        createdAt: {
          gte: inicioDoMes,
          lt: inicioDoProximoMes,
        },
      },
    });
    return gastos;
  }
}
