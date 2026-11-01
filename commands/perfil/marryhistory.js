const { leerDB, getUsuario } = require('../../lib/db');

const FORMATO_FECHA = { timeZone: 'America/Tijuana', day: '2-digit', month: '2-digit', year: 'numeric' };
const fecha = (ms) => new Date(ms).toLocaleDateString('es-MX', FORMATO_FECHA);

function duracion(inicio, fin) {
  const dias = Math.floor(((fin || Date.now()) - inicio) / 86400000);
  if (dias < 1) return 'menos de un dia';
  if (dias < 60) return `${dias} dia${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30);
  return meses < 24 ? `${meses} meses` : `${Math.floor(meses / 12)} años`;
}

function estadoCivil(genero) {
  if (genero === 'hombre') return 'Casado';
  if (genero === 'mujer') return 'Casada';
  return 'Casade';
}

// Historial de matrimonios de alguien (mencionalo, responde a su mensaje, o sin nadie el tuyo).
module.exports = {
  name: 'marryhistory',
  aliases: ['historialmatrimonial', 'historial', 'history'],
  category: 'perfil',
  description: 'Muestra el historial matrimonial de alguien (mencionalo o responde a su mensaje). Sin nadie, el tuyo',
  execute: async (sock, jid, msg) => {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = ctx?.mentionedJid?.[0] || ctx?.participant || remitente;

    const db = leerDB();
    const perfil = getUsuario(db, objetivo);
    const historial = Array.isArray(perfil.historialMatrimonial) ? perfil.historialMatrimonial : [];
    const menciones = [objetivo];

    let texto = `💍 *HISTORIAL MATRIMONIAL*\n@${objetivo.split('@')[0]}\n\n`;

    if (perfil.pareja) {
      const actual = [...historial].reverse().find((h) => !h.fin);
      menciones.push(perfil.pareja);
      texto += `❤️ ${estadoCivil(perfil.genero)} con @${perfil.pareja.split('@')[0]}` +
        `${actual ? ` _(desde ${fecha(actual.inicio)})_` : ' _(desde antes del historial)_'}\n`;
    } else {
      texto += '💔 Sin pareja por ahora.\n';
    }

    const anteriores = historial.filter((h) => h.fin);
    if (anteriores.length) {
      texto += `\n📜 *Matrimonios anteriores (${anteriores.length}):*\n`;
      anteriores.slice(-10).forEach((h, i) => {
        menciones.push(h.con);
        texto += `${i + 1}. @${h.con.split('@')[0]} — ${fecha(h.inicio)} → ${fecha(h.fin)} _(${duracion(h.inicio, h.fin)})_\n`;
      });
    } else {
      texto += '\n_Sin matrimonios anteriores registrados._';
    }

    await sock.sendMessage(jid, { text: texto.trimEnd(), mentions: [...new Set(menciones)] }, { quoted: msg });
  }
};
