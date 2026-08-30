import { TipoMensagem } from "../types/gasto";

const RESPOSTAS: Record<TipoMensagem, string[]> = {
  gasto: [
    "Pdp, deixa eu anotar essa bosta",
    "Orra, ta com um dinheiro da porra né? vô anotar essa merdaKKKKKKKKK",
    "Ta cagano dinheiro éKKKKKKKKKKKKK. Vô anotar perai",
  ],
  sem_item: [
    "Sim, mas comprou oq com esse dinheiro, vou advinhar é?",
    "Gastou isso noq carai? Sou vidente não",
  ],
  sem_preco: [
    "E essa bosta custou quanto? Foi de graça?",
    "Me diga quanto você gastou nisso meu parceiro, que eu não vou advinhar não",
  ],
  saudacao: ["Dir", "Fala", "Fouq"],
  agradecimento: [
    "Tmj, só não fica gastando tudo pq tu não é herdeiro",
    "Suave, é pra isso que eu tô aqui",
    "De nada parça, gaste com moderação pq vc é pobre",
  ],
  outro: [
    "Parça, eu to aqui pra anotar gasto, que já é favor pra tu. Não me faz brincar de psicólogo n",
    "Você gastou dinheiro em alguma coisa ou quer conversar sobre tua depressão?",
    "Eu tenho nada a ver com tua vida não fi, fala noq tu gastou dinheiro.",
  ],
  resumo: [
    "Pera, vou ver quanto tu já gastou esse mês",
    "Deixa eu ver no que tu queimou o dinheiro esse mês",
    "Deixa eu ver as desgraças que tu comprou esse mês",
    "Quer saber quanto tu gastou em maconha né, calmae que vou fazer as conta",
    "Calma aí, vou puxar essa conta pra tu",
  ],
};

const ultimoIndice: Partial<Record<TipoMensagem, number>> = {};

export function sortearResposta(tipo: TipoMensagem): string {
  const respostas = RESPOSTAS[tipo];

  let indice = Math.floor(Math.random() * respostas.length);
  if (respostas.length > 1) {
    while (indice === ultimoIndice[tipo]) {
      indice = Math.floor(Math.random() * respostas.length);
    }
  }

  ultimoIndice[tipo] = indice;
  return respostas[indice];
}
