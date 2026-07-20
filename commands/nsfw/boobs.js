const { enviarNsfwDirecto } = require('../../lib/nsfwDirecto');

module.exports = {
  name: 'boobs',
  aliases: ['tetas'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} pidio boobs y el bot respondio con puro material peligroso. 😈',
      '{autor} acaba de recibir una dosis de boobs que no tiene nada de discreta. 🔥',
      '{autor} encontro un contenido de boobs que viene a romper la calma del grupo. 🖤',
      '{autor} saco unas boobs tan provocativas que ya nadie esta concentrado. 🥵',
      '{autor} se fue directo por boobs y le cayo una joyita tremenda. 💋',
      '{autor} invoco boobs y recibio justo lo necesario para pecar un rato. 😏',
      '{autor} desato una escena de boobs que no piensa pasar desapercibida. 🔞',
      '{autor} se topo con unas boobs demasiado buenas para no compartirlas. 💦',
      '{autor} pidio boobs y ahora el grupo entero anda distraido. 🌙',
      '{autor} trajo unas boobs que vienen listas para incendiar el chat. 🔥'
    ];

    await enviarNsfwDirecto(sock, jid, msg, 'boobs', 'image', frases);
  }
};
