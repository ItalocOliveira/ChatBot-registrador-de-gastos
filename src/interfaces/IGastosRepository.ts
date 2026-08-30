import { Gasto } from "../../app/generated/prisma/client";

export interface CreateGastoDto {
  valor: string;
  categoria: string;
  descricao: string;
}

export interface IGastosRepository {
  create(data: CreateGastoDto): Promise<Gasto>;
  getGastosDoMes(): Promise<Gasto[]>;
}
