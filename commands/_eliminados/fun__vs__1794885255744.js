const { advertencia, error: cajaError, caja } = require('../../lib/estilo');

const MODOS = [
  { name: '1vs1', count: 1, emoji: '⚔️' },
  { name: '2vs2', count: 2, emoji: '🤜🤛' },
  { name: '3vs3', count: 3, emoji: '🔥' },
  { name: '4vs4', count: 4, emoji: '💥' },
  { name: '5vs5', count: 5, emoji: '🚀' },
  { name: '6vs6', count: 6, emoji: '🏆' }
];

function mezclar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  name: 'vs',
  aliases: MODOS.map(m => m.name),
  category: 'fun',
  description: 'Arma equipos aleatorios de Free Fire excluyendo al bot y sin repetir participantes. Uso: .<modo> (ej: .1vs1, .6vs6)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    if (partes.length === 0) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}1vs1 (o 2vs2, 3vs3, ... 6vs6)`, { titulo: 'FALTA INFORMACION' }) });
    }
    const invocacion = partes[0].startsWith(prefix) ? partes[0].slice(prefix.length).toLowerCase() : partes[0].toLowerCase();
    const modo = MODOS.find(m => m.name === invocacion) || MODOS[0];
    const needed = modo.count * 2;

    try {
      const meta = await sock.groupMetadata(jid);
      
      const botIdJid = sock.user?.id ? sock.user.id.split('@')[0].split(':')[0] : '';
      const botLidJid = sock.user?.lid ? sock.user.lid.split('@')[0].split(':')[0] : '';

      const participantesUnicos = [...new Set(meta.participants.map(p => p.id))];
      const participantes = participantesUnicos.filter(id => {
        const usuarioLimpio = id.split('@')[0].split(':')[0];
        if (botIdJid && usuarioLimpio === botIdJid) return false;
        if (botLidJid && usuarioLimpio === botLidJid) return false;
        return true;
      });

      if (participantes.length < needed) {
        const falta = needed - participantes.length;
        return sock.sendMessage(jid, {
          text: advertencia(`Faltan ${falta} participantes (sin contar al bot) para ${modo.name}.`, { titulo: 'INSUFICIENTE' })
        });
      }

      const elegidos = mezclar([...participantes]).slice(0, needed);
      const equipoRojo = elegidos.slice(0, modo.count);
      const equipoAzul = elegidos.slice(modo.count);
      const menciones = [...equipoRojo, ...equipoAzul];

      const contenidoCaja = `🔴 *EQUIPO ROJO*\n` +
        `${equipoRojo.map(id => `  • @${id.split('@')[0]}`).join('\n')}\n\n` +
        `🔵 *EQUIPO AZUL*\n` +
        `${equipoAzul.map(id => `  • @${id.split('@')[0]}`).join('\n')}\n\n` +
        `🎯 _¡Preparados para la sala! Que gane el mejor escuadrón._`;

      const textoSalida = caja(contenidoCaja, { titulo: `SALA DE FREE FIRE [ ${modo.name.toUpperCase()} ] ${modo.emoji}` });

      await sock.sendMessage(jid, { text: textoSalida, mentions: menciones });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Error al generar los equipos: ' + err.message) });
    }
  }
};