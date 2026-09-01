export type TipoMensagem =
  | "gasto"
  | "sem_item"
  | "sem_preco"
  | "saudacao"
  | "agradecimento"
  | "outro"
  | "resumo"
  | "sugestao"
  | "sugestao_mal_feita"
  | "comando"
  | "comando_mal_feito";

export interface ResultadoExtracao {
  tipo: TipoMensagem;
  valor: number | null;
  categoria: string | null;
  descricao: string | null;
}
