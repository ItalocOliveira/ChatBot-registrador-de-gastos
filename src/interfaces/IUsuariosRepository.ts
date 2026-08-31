import { Usuario } from "../../app/generated/prisma/client";

export interface CreateUsuarioDto {
  numero: string;
  nome?: string | undefined;
}

export interface IUsuarioRepository {
  create(data: CreateUsuarioDto): Promise<Usuario>;
  findOne(numero: string): Promise<Usuario | null>;
}
