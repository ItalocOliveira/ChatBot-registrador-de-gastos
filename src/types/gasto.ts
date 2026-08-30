export type TipoMensagem =
  | "gasto"
  | "sem_item"
  | "sem_preco"
  | "saudacao"
  | "agradecimento"
  | "outro"
  | "resumo";

export interface ResultadoExtracao {
  tipo: TipoMensagem;
  valor: number | null;
  categoria: string | null;
  descricao: string | null;
}
