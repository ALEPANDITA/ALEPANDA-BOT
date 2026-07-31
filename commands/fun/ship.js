const { caja } = require('../../lib/estilo');

function mensajeSegunPorcentaje(pct) {
  if (pct <= 15) return 'Mejor quedense como amigos... 💀';
  if (pct <= 35) return 'Hay algo, pero le falta mucho trabajo.';
  if (pct <= 55) return 'Podria funcionar si se esfuerzan un poco.';
  if (pct <= 75) return 'Hay quimica, esto pinta bien 👀';
  if (pct <= 90) return 'Se nota que se quieren mucho 💞';
  return 'Almas gemelas, esto es amor verdadero 💍';
}

function barraCorazones(pct) {
  const llenos = Math.round(pct / 10);
  return '❤️'.repeat(llenos) + '🤍'.repeat(10 - llenos);
}

module.exports = {
  name: 'ship',
  aliases: ['love', 'match'],
  category: 'fun',
  description: 'Calcula el % de amor entre dos personas. Uso: .ship @persona1 @persona2 (o menciona/responde a 1 sola)',
  execute: async (sock, jid, msg, { prefix }) => {
    const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;

    let persona1, persona2;

    if (menciones.length >= 2) {
      persona1 = menciones[0];
      persona2 = menciones[1];
    } else if (menciones.length === 1) {
      persona1 = remitente;
      persona2 = menciones[0];
    } else if (citado) {
      persona1 = remitente;
      persona2 = citado;
    } else {
      return sock.sendMessage(jid, {
        text: caja([`Uso: ${prefix}ship @persona1 @persona2`, `O responde/menciona a 1 sola persona para compararte con ella.`], { titulo: 'SHIP', estilo: 'kawaii' })
      }, { quoted: msg });
    }

    if (persona1 === persona2) {
      return sock.sendMessage(jid, {
        text: caja(['No te puedes shippear contigo mismo 😅'], { titulo: 'SHIP', estilo: 'kawaii' })
      }, { quoted: msg });
    }

    const pct = Math.floor(Math.random() * 100) + 1;
    const num1 = persona1.split('@')[0];
    const num2 = persona2.split('@')[0];

    const texto = caja([
      `@${num1} + @${num2}`,
      '',
      `${barraCorazones(pct)}`,
      `*${pct}%* de amor`,
      '',
      mensajeSegunPorcentaje(pct)
    ], { titulo: '💘 SHIP', estilo: 'kawaii' });

    await sock.sendMessage(jid, {
      text: texto,
      mentions: [persona1, persona2]
    }, { quoted: msg });
  }
};
