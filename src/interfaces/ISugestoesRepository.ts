import { Sugestao } from "../generated/prisma/client";

export interface CreateSugestaoDto {
  numero: string;
  nome?: string | undefined;
  texto: string;
}

export interface ISugestoesRepository {
  create(data: CreateSugestaoDto): Promise<Sugestao>;
}
