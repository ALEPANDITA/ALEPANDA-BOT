const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const dinero = (n) => '$' + Math.floor(n).toLocaleString('en-US');
const barra = (parte, todo, largo = 12) => {
  const llenos = todo > 0 ? Math.round((parte / todo) * largo) : 0;
  return '▰'.repeat(llenos) + '▱'.repeat(largo - llenos);
};
const nivel = (total) => (total >= 1e7 ? '👑 Magnate' : total >= 1e6 ? '💎 Millonario' : total >= 1e5 ? '🥇 Inversionista' : total >= 1e4 ? '🥈 Ahorrador' : total >= 1e3 ? '🥉 Cliente' : '🌱 Principiante');

function tarjeta(titulo, filas, pie) {
  return [
    '🏦 *B A N C O   A L E P A N D A* 🏦',
    `✦ ${titulo}`,
    '━━━━━━━━━━━━━━━━━━━━',
    ...filas,
    ...(pie ? ['', pie] : []),
    '━━━━━━━━━━━━━━━━━━━━',
    '🐼 _Tu dinero, seguro con el panda_'
  ].join('\n');
}

function resumen(u) {
  const total = u.saldo + u.banco;
  const pct = total > 0 ? Math.round((u.banco / total) * 100) : 0;
  return [
    `👛 En mano   ›  *${dinero(u.saldo)}*`,
    `🏦 En banco  ›  *${dinero(u.banco)}*`,
    '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄',
    `💰 Total     ›  *${dinero(total)}*`,
    '',
    `🔒 Protegido: ${barra(u.banco, total)} *${pct}%*`,
    `🏅 Rango: ${nivel(total)}`
  ];
}

function leerMonto(palabra, disponible) {
  const p = String(palabra || '').toLowerCase();
  if (p === 'all' || p === 'todo' || p === 'todos') return disponible;
  if (p === 'mitad' || p === 'half') return Math.floor(disponible / 2);
  const n = parseInt(p, 10);
  return /^\d+$/.test(p) && n > 0 ? n : 0;
}

module.exports = {
  name: 'banco',
  aliases: ['bank'],
  category: 'economia',
  description: 'Tu banco: ver, guardar o sacar dinero (ej: .banco guardar 100, .banco guardar todo, .banco sacar mitad)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const accion = (partes[1] || '').toLowerCase();
    const yo = `@${remitente.split('@')[0]}`;
    const enviar = (t) => sock.sendMessage(jid, { text: t, mentions: [remitente] }, { quoted: msg });

    const db = leerDB();
    const u = getUsuario(db, remitente);

    if (!accion || accion === 'ver' || accion === 'saldo') {
      return enviar(tarjeta(`Cuenta de ${yo}`, resumen(u), `💡 _${prefix}banco guardar <monto|todo>  ·  ${prefix}banco sacar <monto|todo>_`));
    }

    if (accion === 'guardar' || accion === 'depositar' || accion === 'sacar' || accion === 'retirar') {
      const guardar = accion === 'guardar' || accion === 'depositar';
      const disponible = guardar ? u.saldo : u.banco;
      const monto = leerMonto(partes[2], disponible);
      if (!partes[2]) return enviar(tarjeta(guardar ? '📥 Depósito' : '📤 Retiro', [`Uso: *${prefix}banco ${guardar ? 'guardar' : 'sacar'} <monto>*`, `También: *todo* o *mitad*`, '', `Disponible: *${dinero(disponible)}*`]));
      if (!monto) return enviar(tarjeta(guardar ? '📥 Depósito' : '📤 Retiro', [`⚠️ ${disponible > 0 ? 'Pon un monto válido (o *todo* / *mitad*).' : guardar ? 'No tienes dinero en mano para guardar.' : 'No tienes dinero guardado para sacar.'}`, '', `Disponible: *${dinero(disponible)}*`]));
      if (monto > disponible) return enviar(tarjeta(guardar ? '📥 Depósito' : '📤 Retiro', [`❌ ${guardar ? 'No tienes suficiente en mano.' : 'No tienes suficiente guardado.'}`, '', `Disponible: *${dinero(disponible)}*`, `Intentaste: *${dinero(monto)}*`]));

      if (guardar) { u.saldo -= monto; u.banco += monto; } else { u.banco -= monto; u.saldo += monto; }
      guardarDB(db);
      return enviar(tarjeta(guardar ? '📥 Depósito exitoso' : '📤 Retiro exitoso', [`${guardar ? '➕ Guardaste' : '➖ Sacaste'}  *${dinero(monto)}*`, '', ...resumen(u)]));
    }

    return enviar(tarjeta('Ayuda', [`${prefix}banco  ›  ver tu cuenta`, `${prefix}banco guardar <monto>  ›  depositar`, `${prefix}banco sacar <monto>  ›  retirar`, '', '✨ En lugar del monto puedes poner *todo* o *mitad*']));
  }
};
