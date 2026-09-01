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
    "Me diga quanto você gastou nisso meu parceiro, eu não vou advinhar não",
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
  sugestao: [
    "Blz parça, vo ve e te aviso",
    "Vou pensar no seu caso, viu chefe?",
    "Quer da pitaco no meu trabalho agr? Jajá começo a falar do teu tbm",
  ],
  sugestao_mal_feita: [
    "Pdp, mas se quiser dar sugestao usa o comando */sugestao* antes de falar merda, mamute depilado",
    "Usa */sugestao* no inicio da mensagem, se não eu não vou anotar essa tua sugestão não",
    "Calmae perna de alicate, escreve */sugestao* antes de querer falar do meu trabalho.",
  ],
  comando: [
    "Os comando que eu entendo são esses aqui:\n\n*/sugestao <texto>* - manda uma sugestão de melhoria pro bot\n*/comandos* - mostra essa lista aqui\n\nFora isso só me fala teus gasto que eu anoto, ou pergunta o resumo do mês.\nVai que sobra alguma coisa pra tu comprar um fogão pra tua mãeKKKKKKKLKK",
  ],
  comando_mal_feito: [
    "O */comandos* é sozinho, sem nada depois, espirro de pica. Manda só '/comandos' que eu te mostro a lista",
    "Não bota nada depois do */comandos* não, escroto.",
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
