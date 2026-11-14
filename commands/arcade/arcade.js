// ARCADE: juegos web que pagan monedas al saldo.
//   .arcade               -> lista de juegos y como se juega
//   .flappy               -> tu link personal de Flappy Fox        (.flappy nuevo = link nuevo)
//   .reclamar FOX-...     -> cobras el codigo que te dio la pagina al perder
//   .arcade top           -> ranking por mejor puntaje
//   Solo owner: .arcade url <http://IP:8787 | https://dominio | auto> · .arcade puerto <n> · .arcade config [clave valor] · .arcade estado
// Para sumar otro juego: su .html en assets/arcade/ + una entrada en CATALOGO de lib/arcade.js (los comandos salen solos).
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, resolverLid } = require('../../lib/permisos');
const { caja, advertencia } = require('../../lib/estilo');
const arcade = require('../../lib/arcade');
const web = require('../../lib/arcade-web');

const fmt = (n) => Number(n).toLocaleString('es-MX');
const ESTILO = 'gamer';

// Ids con los que se puede reconocer a quien escribe (JID, LID y sus versiones alternas si Baileys las trae)
function idsBasicos(msg) {
  const k = msg.key || {};
  return arcade.idsDe(k.participant || k.remoteJid, k.participantAlt, k.remoteJidAlt);
}
async function idsConResolucion(sock, msg) {
  const crudo = (msg.key || {}).participant || (msg.key || {}).remoteJid;
  let resuelto = null;
  try { resuelto = await resolverLid(sock, crudo); } catch (_) { resuelto = null; }
  return arcade.idsDe(crudo, resuelto, ...idsBasicos(msg));
}

const argumentos = (texto, prefix) => String(texto || '').trim().slice(prefix.length).trim().split(/\s+/).slice(1).filter(Boolean);

function lineasReglas(cfg) {
  return [
    `🪙 Cada moneda de oro = *$${fmt(cfg.valorMoneda)}*`,
    `🧱 Cada tubería = *$1*`,
    `🎟️ Tope: *$${fmt(cfg.maxPorCobro)}* por cobro · *$${fmt(cfg.maxDiario)}* al día`
  ];
}

// ───────────── Comando de cada juego del catalogo (.flappy, ...) ─────────────
function comandoJuego(juego) {
  return {
    name: juego.comandos[0],
    aliases: juego.comandos.slice(1),
    category: 'arcade',
    description: `${juego.emoji} ${juego.titulo}: ${juego.descripcion} Te da tu link personal; el código que te da al perder se cobra con .reclamar`,
    execute: async (sock, jid, msg, { prefix, texto }) => {
      const arg = argumentos(texto, prefix).join(' ').toLowerCase();
      const nueva = /^(nuevo|nueva|renovar|reset|otro|otra)/.test(arg);
      const cfg = arcade.leerConfigArcade();

      const srv = web.estadoServidor();
      if (!srv.escuchando) {
        return sock.sendMessage(jid, {
          text: advertencia(`El servidor del arcade no está encendido${srv.error ? ` (${srv.error})` : ''}. Avísale al owner: .arcade estado`, { titulo: 'ARCADE APAGADO', estilo: ESTILO })
        });
      }
      const base = await web.urlBase();
      if (!base) {
        return sock.sendMessage(jid, {
          text: advertencia(`Todavía no sé la dirección pública del arcade. El owner debe poner su link con:\n${prefix}arcade url http://IP-DEL-VPS:${srv.puerto}`, { titulo: 'FALTA LA DIRECCIÓN', estilo: ESTILO })
        });
      }

      const ids = await idsConResolucion(sock, msg);
      if (!ids.length) return sock.sendMessage(jid, { text: 'No pude identificarte, intenta de nuevo.' });
      const { tarjeta, nueva: esNueva } = arcade.obtenerTarjeta(juego, ids, { nueva });
      const enlace = base.base + arcade.enlaceRelativo(juego, tarjeta, prefix);
      const horas = Math.max(1, Math.round((tarjeta.expira - Date.now()) / 3600000));

      const caja1 = caja([
        `${juego.emoji} *${juego.titulo.toUpperCase()}*`,
        esNueva ? '🔗 Tu link personal (nuevo) está abajo ⬇️' : '🔗 Tu link personal sigue vigente ⬇️',
        '',
        '1️⃣ Ábrelo y juega.',
        `2️⃣ Al perder te sale un código *${juego.tag}-...*`,
        `3️⃣ Mándalo aquí: *${prefix}reclamar ${juego.tag}-...*`,
        '',
        ...lineasReglas(cfg),
        `⏳ Este link dura ~${horas} h · no lo compartas`
      ], { titulo: 'ARCADE', estilo: ESTILO });

      await sock.sendMessage(jid, { text: caja1 });
      await sock.sendMessage(jid, { text: enlace });
    }
  };
}

// ───────────── .reclamar ─────────────
const reclamar = {
  name: 'reclamar',
  aliases: ['cobrar', 'canjear'],
  category: 'arcade',
  description: 'Cobra el código FOX-... que te dio un juego del arcade y las monedas caen en tu saldo',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const idPago = msg.key.participant || msg.key.remoteJid;
    const partes = arcade.analizarCodigo(texto);
    if (!partes) {
      return sock.sendMessage(jid, {
        text: caja([
          'Pega aquí el código que te dio la página del juego al perder.',
          `Ejemplo: *${prefix}reclamar FOX-ABC234-0A031B2C9D4E5F6A7B*`,
          '',
          `¿Aún no tienes link? Usa *${prefix}flappy*`
        ], { titulo: 'COBRAR BOLETO', estilo: ESTILO })
      });
    }

    const nombre = msg.pushName || null;
    let ids = idsBasicos(msg);
    let r = arcade.reclamar({ texto, ids, idPago, nombre });
    if (!r.ok && r.codigo === 'dueno') {
      // Puede ser el mismo usuario con otro formato de id (@lid vs numero): lo resolvemos y probamos una vez mas
      const ampliados = await idsConResolucion(sock, msg);
      if (ampliados.some((i) => !ids.includes(i))) {
        ids = ampliados;
        r = arcade.reclamar({ texto, ids, idPago, nombre });
      }
    }

    if (!r.ok) {
      const titulo = r.codigo === 'repetido' ? 'YA COBRADO' : (r.codigo === 'tope-diario' ? 'TOPE DIARIO' : 'BOLETO NO VÁLIDO');
      return sock.sendMessage(jid, { text: advertencia(r.mensaje, { titulo, estilo: ESTILO }) });
    }

    const lineas = [
      `${r.juego.emoji} *${r.juego.titulo}*`,
      r.juego.resumen(r.datos),
      '',
      `🪙 Premio: *+$${fmt(r.premio)}*`
    ];
    if (r.recortado === 'por cobro') lineas.push('ℹ️ Se aplicó el tope por cobro.');
    if (r.recortado === 'diario') lineas.push('ℹ️ Se aplicó el tope diario.');
    lineas.push(`💰 Saldo en mano: *$${fmt(r.saldo)}*`, `📅 Te quedan *$${fmt(r.restanteHoy)}* por ganar hoy`);
    return sock.sendMessage(jid, { text: caja(lineas, { titulo: '¡BOLETO COBRADO!', estilo: ESTILO }) });
  }
};

// ───────────── .arcade ─────────────
const CLAVES = {
  url: 'url', puerto: 'puerto', nombre: 'nombreBot', moneda: 'valorMoneda', valor: 'valorMoneda',
  maxcobro: 'maxPorCobro', maxdia: 'maxDiario', maxdiario: 'maxDiario', vigencia: 'vigenciaHoras'
};

function nombreVisible(f) {
  return f.nombre || `Jugador ····${String(f.llave).slice(-4)}`;
}

const arcadeCmd = {
  name: 'arcade',
  aliases: ['minijuegos'],
  category: 'arcade',
  description: 'Juegos web que pagan monedas a tu saldo. Ej: .arcade · .arcade top · (owner) .arcade url http://IP:8787 · .arcade estado',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const args = argumentos(texto, prefix);
    const sub = (args[0] || '').toLowerCase();
    const cfg = arcade.leerConfigArcade();

    // Subcomandos solo para el owner
    if (['url', 'puerto', 'config', 'configurar', 'estado'].includes(sub)) {
      const config = leerConfig();
      if (!(await esOwnerBot(sock, config, msg))) {
        return sock.sendMessage(jid, { text: advertencia('Eso solo lo puede usar un owner del bot.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
      }
      return subOwner({ sock, jid, prefix, sub, args: args.slice(1), cfg });
    }

    if (sub === 'top' || sub === 'ranking') {
      const juego = arcade.juegoPorRuta(args[1]) || arcade.listarJuegos()[0];
      const filas = arcade.top(juego, 10);
      if (!filas.length) {
        return sock.sendMessage(jid, { text: caja([`Todavía nadie ha cobrado partidas de ${juego.titulo}.`, `¡Sé el primero con *${prefix}${juego.comandos[0]}*!`], { titulo: 'RANKING', estilo: ESTILO }) });
      }
      const medallas = ['🥇', '🥈', '🥉'];
      const lineas = filas.map((f, i) => `${medallas[i] || `${i + 1}.`} ${nombreVisible(f)} — *${f.mejor}* tuberías (${f.partidas} partidas)`);
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: `TOP ${juego.titulo.toUpperCase()}`, estilo: ESTILO }) });
    }

    const lineas = [];
    for (const j of arcade.listarJuegos()) {
      lineas.push(`${j.emoji} *${j.titulo}* → *${prefix}${j.comandos[0]}*`, `   ${j.descripcion}`);
    }
    lineas.push(
      '',
      '*Cómo se juega*',
      `1️⃣ Escribe el comando del juego y te doy tu link.`,
      '2️⃣ Juega en la página. Al perder te da un código.',
      `3️⃣ Mándalo con *${prefix}reclamar CÓDIGO* y las monedas caen en tu saldo.`,
      '',
      ...lineasReglas(cfg),
      `🏆 Ranking: *${prefix}arcade top*`
    );
    return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'ARCADE', estilo: ESTILO }) });
  }
};

async function subOwner({ sock, jid, prefix, sub, args, cfg }) {
  const responder = (t) => sock.sendMessage(jid, { text: t });

  if (sub === 'estado') {
    const srv = web.estadoServidor();
    const r = arcade.resumenEstado();
    const base = await web.urlBase();
    const lineas = [
      `🌐 Servidor web: ${srv.escuchando ? '*encendido* ✅' : `*apagado* ❌${srv.error ? ` (${srv.error})` : ''}`}`,
      `🔌 Puerto: *${srv.puerto}*`,
      `🔗 Dirección: ${base ? `*${base.base}*${base.auto ? ' (detectada sola)' : ''}` : '*no detectada* — usa ' + prefix + 'arcade url ...'}`,
      `🎟️ Boletos vivos: *${r.tarjetasVivas}* · Jugadores: *${r.jugadores}*`,
      '',
      `🪙 Moneda: $${fmt(cfg.valorMoneda)} · Tope cobro: $${fmt(cfg.maxPorCobro)} · Tope día: $${fmt(cfg.maxDiario)}`,
      `⏳ Vigencia del link: ${cfg.vigenciaHoras} h · Nombre en la página: ${cfg.nombreBot}`
    ];
    if (base && base.auto) {
      lineas.push('', `Si desde fuera no abre, abre el puerto en el VPS:`, `sudo ufw allow ${srv.puerto}/tcp`);
    }
    return responder(caja(lineas, { titulo: 'ARCADE · ESTADO', estilo: 'neon' }));
  }

  if (sub === 'url') {
    if (!args.length) {
      return responder(caja([
        `Dirección actual: *${cfg.url || 'automática (IP pública del VPS)'}*`,
        '',
        `${prefix}arcade url http://123.45.67.89:${cfg.puerto}`,
        `${prefix}arcade url https://juegos.midominio.com`,
        `${prefix}arcade url auto`
      ], { titulo: 'ARCADE · URL', estilo: 'neon' }));
    }
    const r = arcade.cambiarConfig('url', args[0]);
    if (!r.ok) return responder(advertencia(r.motivo, { titulo: 'URL NO VÁLIDA', estilo: 'neon' }));
    return responder(caja([r.valor ? `Listo, los links ahora usan: *${r.valor}*` : 'Listo, vuelvo a detectar la IP pública sola.'], { titulo: 'ARCADE · URL', estilo: 'neon' }));
  }

  if (sub === 'puerto') {
    if (!args.length) return responder(`Puerto actual: ${cfg.puerto}. Cambia con ${prefix}arcade puerto 8788`);
    const r = arcade.cambiarConfig('puerto', args[0]);
    if (!r.ok) return responder(advertencia(r.motivo, { titulo: 'PUERTO NO VÁLIDO', estilo: 'neon' }));
    await web.reiniciar();
    await new Promise((res) => setTimeout(res, 400));
    const srv = web.estadoServidor();
    return responder(caja([
      `Puerto cambiado a *${r.valor}* — servidor ${srv.escuchando ? 'encendido ✅' : `con problema ❌ ${srv.error || ''}`}`,
      cfg.url ? `Recuerda actualizar ${prefix}arcade url (el puerto va dentro de la URL).` : 'Abre ese puerto en el VPS:',
      cfg.url ? '' : `sudo ufw allow ${r.valor}/tcp`
    ].filter((x) => x !== ''), { titulo: 'ARCADE · PUERTO', estilo: 'neon' }));
  }

  // config
  if (!args.length) {
    return responder(caja([
      `url: *${cfg.url || 'auto'}*`,
      `puerto: *${cfg.puerto}*`,
      `nombre (en la página): *${cfg.nombreBot}*`,
      `moneda (valor de cada moneda de oro): *$${fmt(cfg.valorMoneda)}*`,
      `maxcobro (tope por cobro): *$${fmt(cfg.maxPorCobro)}*`,
      `maxdia (tope por persona al día): *$${fmt(cfg.maxDiario)}*`,
      `vigencia (horas del link): *${cfg.vigenciaHoras}*`,
      '',
      `Cambiar: ${prefix}arcade config moneda 100`,
      `         ${prefix}arcade config maxdia 50000`
    ], { titulo: 'ARCADE · CONFIG', estilo: 'neon' }));
  }
  const clave = CLAVES[String(args[0]).toLowerCase()];
  if (!clave || args.length < 2) {
    return responder(advertencia(`Uso: ${prefix}arcade config <${Object.keys(CLAVES).join('/')}> <valor>`, { titulo: 'CONFIG', estilo: 'neon' }));
  }
  const valor = args.slice(1).join(' ');
  const r = arcade.cambiarConfig(clave, valor);
  if (!r.ok) return responder(advertencia(r.motivo, { titulo: 'CONFIG', estilo: 'neon' }));
  if (clave === 'puerto') await web.reiniciar();
  return responder(caja([`*${args[0].toLowerCase()}* = *${r.valor === '' ? 'auto' : r.valor}* ✅`, 'Los links que ya se dieron siguen valiendo. El premio real siempre lo calcula el bot con estos valores (la página solo lo muestra).'], { titulo: 'ARCADE · CONFIG', estilo: 'neon' }));
}

module.exports = [arcadeCmd, reclamar, ...arcade.listarJuegos().map(comandoJuego)];
