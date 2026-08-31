import { Mensagem } from "../../app/generated/prisma/client";

export interface CreateMensagemDto {
  numero: string;
  nome?: string | undefined;
  texto: string;
  tipo?: string | undefined;
}

export interface IMensagensRepository {
  create(data: CreateMensagemDto): Promise<Mensagem>;
}
