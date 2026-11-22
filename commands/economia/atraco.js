const eco = require('../../lib/eco-anim');
const { advertencia, porCategoria } = require('../../lib/estilo');

// .atraco  -> arma una banda en el grupo (el mensaje se va editando con la cuenta regresiva y quién se une).
//             Los demás se unen escribiendo .atraco. Al terminar el tiempo la banda asalta el banco.
const CONFIG = { LOBBY_MS: 45000, TICK_MS: 9000 }; // se pueden cambiar en las pruebas
const COOLDOWN = 60 * 60 * 1000;
const ENTRADA = 200;     // saldo mínimo para unirte (es lo máximo que arriesgas)
const MIN_BANDA = 2;
const MAX_BANDA = 8;

const lobbies = new Map(); // jid del grupo -> { banda: [{ id, llave }], cerrado }

const probabilidad = (n) => Math.min(0.75, 0.30 + 0.09 * n);
const numeroDe = (id) => String(id).split('@')[0].split(':')[0];
const conSigno = (n) => (n >= 0 ? `+${eco.dinero(n)}` : `-${eco.dinero(-n)}`);

async function organizar(sock, jid, msg, lobby, prefix) {
  const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'ATRACO', mentions: () => lobby.banda.map((m) => m.id) });
  const lineasBanda = () => lobby.banda.map((m) => `   ▸ @${numeroDe(m.id)}`);

  // ---------- se junta la banda ----------
  const inicio = Date.now();
  for (;;) {
    const resta = CONFIG.LOBBY_MS - (Date.now() - inicio);
    if (resta <= 0) break;
    await anim.paso([
      '🏦 ¡Se prepara un atraco al banco!',
      '',
      `🕵️ Banda (${lobby.banda.length}/${MAX_BANDA}, mínimo ${MIN_BANDA}):`,
      ...lineasBanda(),
      '',
      `🎲 Probabilidad de éxito: ${Math.round(probabilidad(lobby.banda.length) * 100)}%`,
      `⏳ Salen en ${eco.tiempo(resta)}`,
      `Únete con *${prefix}atraco* (necesitas ${eco.dinero(ENTRADA)})`
    ], { pausa: 0 });
    await eco.esperar(Math.min(CONFIG.TICK_MS, resta));
  }
  lobby.cerrado = true;

  // Solo salen los que todavía tienen el dinero que arriesgan
  const banda = lobby.banda.filter((m) => (Number(eco.ficha(m.id).usuario.saldo) || 0) >= ENTRADA);
  if (banda.length < MIN_BANDA) {
    return anim.final([
      '🏦 Atraco cancelado', '',
      `No se juntó una banda de al menos ${MIN_BANDA} con fondos.`,
      'Nadie pierde nada.'
    ]);
  }

  // ---------- el atraco ----------
  const exito = Math.random() < probabilidad(banda.length);
  const resultados = banda.map(() => (exito
    ? eco.aleatorio(250, 600) + (banda.length - MIN_BANDA) * 50
    : -eco.aleatorio(100, 200)));
  lobby.banda = banda; // las menciones ya solo incluyen a quien sale
  const cabecera = [`🕵️ La banda (${banda.length}):`, ...lineasBanda(), ''];

  await anim.paso([...cabecera, '🚗 Llegan al banco...', eco.barra(0.1)]);
  await anim.paso([...cabecera, '🔧 Cortan la luz y las cámaras...', eco.barra(0.35)]);
  await anim.paso([...cabecera, '🔐 Abren la bóveda...', eco.barra(0.7)]);
  await anim.paso([...cabecera, '🚨 ¿Suena la alarma...?', eco.barra(0.95)], { pausa: eco.config.PAUSA * 1.5 });

  // Recién ahora se lee la base de cada uno y se aplica
  const ahora = Date.now();
  const finales = banda.map((m, i) => eco.actualizar(m.id, (u) => {
    const antes = Number(u.saldo) || 0;
    u.saldo = Math.max(0, antes + resultados[i]);
    u.lastAtraco = ahora;
    return { real: u.saldo - antes, saldo: u.saldo };
  }));

  const filas = banda.map((m, i) => `   ▸ @${numeroDe(m.id)}  ${conSigno(finales[i].real)}  (saldo ${eco.dinero(finales[i].saldo)})`);
  if (exito) {
    await anim.final(['🎉 ¡EL ATRACO SALIÓ BIEN!', '', '💰 Se repartieron el botín:', ...filas]);
  } else {
    await anim.final(['🚔 ¡LLEGÓ LA POLICÍA!', '', '💸 La banda pagó la multa:', ...filas]);
  }
}

module.exports = {
  name: 'atraco',
  aliases: ['heist', 'asalto'],
  category: 'economia',
  description: 'Arma una banda en el grupo y asalten el banco (cada 1 h). Animado',
  config: CONFIG,
  execute: async (sock, jid, msg, { prefix = '.' } = {}) => {
    const estilo = porCategoria('economia');
    const aviso = (t) => sock.sendMessage(jid, { text: advertencia(t, { titulo: 'ATRACO', estilo }) }, { quoted: msg });
    if (!String(jid).endsWith('@g.us')) return aviso('El atraco se arma en grupos: hacen falta al menos 2 personas.');

    const remitente = msg.key.participant || msg.key.remoteJid;
    const { usuario, llave } = eco.ficha(remitente);
    const falta = eco.restante(usuario, 'lastAtraco', COOLDOWN);
    if (falta > 0) return sock.sendMessage(jid, { text: eco.textoEspera(falta, 'participar en otro atraco') }, { quoted: msg });
    if ((Number(usuario.saldo) || 0) < ENTRADA) {
      return aviso(`Necesitas al menos ${eco.dinero(ENTRADA)} para unirte (es lo que arriesgas). Tienes ${eco.dinero(usuario.saldo)}.`);
    }

    const lobby = lobbies.get(jid);
    if (lobby) {
      if (lobby.cerrado) return aviso('La banda ya salió al atraco. Espera a que termine.');
      if (lobby.banda.some((m) => m.llave === llave)) return aviso('Ya estás en la banda 😎');
      if (lobby.banda.length >= MAX_BANDA) return aviso('La banda ya está llena.');
      lobby.banda.push({ id: remitente, llave });
      try {
        await sock.sendMessage(jid, { react: { text: '🕵️', key: msg.key } });
      } catch (_) {
        await sock.sendMessage(jid, { text: '🕵️ Te uniste a la banda.' }, { quoted: msg });
      }
      return;
    }

    const nuevo = { banda: [{ id: remitente, llave }], cerrado: false };
    lobbies.set(jid, nuevo);
    // En segundo plano: así el bot sigue atendiendo mensajes (y los que quieran unirse) durante la espera
    organizar(sock, jid, msg, nuevo, prefix)
      .catch((e) => console.error('[atraco]', e))
      .finally(() => lobbies.delete(jid));
  }
};
