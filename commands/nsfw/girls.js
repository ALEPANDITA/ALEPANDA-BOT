const { enviarNsfwDirecto } = require('../../lib/nsfwDirecto');

module.exports = {
  name: 'girls',
  aliases: ['chicas'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} pidio girls y le cayo un contenido demasiado atrevido. 😈',
      '{autor} abrio una seleccion de girls que viene cargada de tentacion. 🔥',
      '{autor} encontro unas girls que subieron la temperatura al instante. 🖤',
      '{autor} invoco girls y el bot se lucio con el material. 💋',
      '{autor} saco girls y ahora nadie en el grupo puede hacerse el serio. 😏',
      '{autor} pidio girls y aparecio una escena tan buena que ya valio todo. 🔞',
      '{autor} desato un contenido de girls que viene durisimo. 🥵',
      '{autor} se encontro unas girls que no tienen ni una pizca de inocencia. 💦',
      '{autor} saco girls y encendio el ambiente con solo un comando. 🌚',
      '{autor} abrio girls y el resultado quedo demasiado hot para ignorarlo. 🔥'
    ];

    await enviarNsfwDirecto(sock, jid, msg, 'girls', frases);
  }
};
