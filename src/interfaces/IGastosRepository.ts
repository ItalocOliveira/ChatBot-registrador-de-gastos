import { Gasto } from "../generated/prisma/client";

export interface CreateGastoDto {
  valor: string;
  categoria: string;
  descricao: string;
  usuarioId: string;
}

export interface IGastosRepository {
  create(data: CreateGastoDto): Promise<Gasto>;
  getGastosDoMes(usuarioId: string): Promise<Gasto[]>;
}
