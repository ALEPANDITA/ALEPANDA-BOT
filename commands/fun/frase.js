const frases = [
  'El que persevera, alcanza.',
  'Cae siete veces, levantate ocho.',
  'La suerte favorece a la mente preparada.',
  'No cuentes los dias, haz que los dias cuenten.',
  'El exito es la suma de pequeños esfuerzos repetidos dia tras dia.',
  'Todo parece imposible hasta que se hace.'
];

module.exports = {
  name: 'frase',
  category: 'fun',
  description: 'Envia una frase motivacional al azar',
  execute: async (sock, jid) => {
    const frase = frases[Math.floor(Math.random() * frases.length)];
    await sock.sendMessage(jid, { text: `💭 ${frase}` });
  }
};
