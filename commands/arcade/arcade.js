// PARCHE-PANEL aplicado
// PARCHE-FLAPPY aplicado
// ARCADE: juegos web que pagan monedas al saldo.
//   .arcade               -> sala de juegos: lista y como se juega
//   .flappy               -> tu link personal de Flappy Fox        (.flappy nuevo = link nuevo)
//   .reclamar FOX-...     -> cobras el codigo que te dio la pagina al perder
//   .arcade top           -> ranking por mejor puntaje
//   Solo owner: .arcade modo <archivo|link> · .arcade estado · .arcade config [clave valor]
//               (solo modo link) .arcade url <http://IP:8787 | https://dominio | auto> · .arcade puerto <n>
//               .arcade juegos (los instalados con .crearcmd) · .arcade quitar <id>
// Para sumar otro juego: mandale su .html a .crearcmd (lib/arcade-crear.js) o, a mano, su .html en assets/arcade/ + una
// entrada en CATALOGO de lib/arcade.js (los comandos salen solos).
// Diseño de los mensajes: lib/arcade-ui.js
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, resolverLid } = require('../../lib/permisos');
const arcade = require('../../lib/arcade');
const web = require('../../lib/arcade-web');
const { marco, fmt, lineasPremios, REGLA } = require('../../lib/arcade-ui');
const { enviarComoPanel } = require('../../lib/arcade-panel');

// Ids con los que se puede reconocer a quien escribe (JID, LID y sus versiones alternas si Baileys las trae)
function idsBasicos(msg) {
  const k = msg.key || {};
  return arcade.idsDe(k.participant || k.remoteJid, k.participantAlt, k.remoteJidAlt);
}
async function idsConResolucion(sock, msg) {
  const crudo = (msg.key || {}).participant || (msg.key || {}).remoteJid;
  let resuelto = null;
  try { resuelto = await resolverLid(sock, crudo); } catch (_) { resuelto = null; }
  let pn = null;
  try {
    pn = await Promise.race([Promise.resolve(sock.signalRepository?.lidMapping?.getPNForLID?.(crudo)), new Promise((r) => setTimeout(() => r(null), 2000))]);
  } catch (_) { pn = null; }
  return arcade.idsDe(crudo, resuelto, pn, ...idsBasicos(msg));
}

const argumentos = (texto, prefix) => String(texto || '').trim().slice(prefix.length).trim().split(/\s+/).slice(1).filter(Boolean);

// ───────────── Comando de cada juego del catalogo (.flappy, ...) ─────────────
// Modo "archivo" (por defecto): el bot manda el juego como archivo .html personalizado y se juega directo desde el chat.
// Modo "link": el bot manda un link a su mini servidor web (.arcade modo link).
function lineasComoSeJuega(juego, prefix, paso1) {
  return [
    '🎮 *¿Cómo se juega?*',
    paso1,
    `② Al perder te da un boleto *${juego.tag}-...*`,
    `③ Tócale *Copiar código* y pégalo aquí: *${prefix}reclamar ${juego.tag}-...*`
  ];
}

async function enviarComoArchivo({ sock, jid, msg, juego, prefix, ids, nueva, cfg }) {
  const { tarjeta, nueva: esNueva } = arcade.obtenerTarjeta(juego, ids, { nueva });
  const html = arcade.htmlPersonalizado(juego, tarjeta, prefix);
  const horas = Math.max(1, Math.round((tarjeta.expira - Date.now()) / 3600000));
  const caption = marco([
    `_${juego.descripcion}_`,
    '',
    esNueva ? '📎 *Tu juego personal va arriba* ⬆️' : '📎 *Tu juego sigue vigente, va arriba* ⬆️',
    '_Tócalo para abrirlo: si te pregunta con qué, elige *Chrome* 🌐_',
    '',
    ...lineasComoSeJuega(juego, prefix, '① Toca el archivo y juega'),
    '',
    REGLA,
    ...lineasPremios(cfg),
    `⏳ Dura ~${horas} h · 🤫 es solo tuyo, no lo reenvíes`
  ], { titulo: juego.titulo.toUpperCase(), emoji: juego.emoji });
  await sock.sendMessage(jid, {
    document: Buffer.from(html, 'utf8'),
    mimetype: 'text/html',
    fileName: `${juego.titulo.replace(/\s+/g, '')}-${tarjeta.id}.html`,
    caption
  }, { quoted: msg });
}

// Boton nativo de WhatsApp: se abre DENTRO de WhatsApp (Android y iPhone), sin mandarte a Google.
async function enviarBotonJugar(sock, jid, msg, juego, enlace) {
  try {
    const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
    const IM = proto.Message.InteractiveMessage;
    const interactiveMessage = IM.create({
      body: IM.Body.fromObject({ text: `${juego.emoji} *${juego.titulo}*\nToca el botón y juega aquí mismo en WhatsApp 👇` }),
      footer: IM.Footer.fromObject({ text: 'ALEPANDA ARCADE' }),
      header: IM.Header.fromObject({ title: '', hasMediaAttachment: false }),
      nativeFlowMessage: IM.NativeFlowMessage.fromObject({
        buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: `🎮 JUGAR ${juego.titulo.toUpperCase()}`, url: enlace, merchant_url: enlace }) }]
      })
    });
    const contenido = proto.Message.fromObject({ viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage } } });
    const m = generateWAMessageFromContent(jid, contenido, { quoted: msg });
    await sock.relayMessage(jid, m.message, { messageId: m.key.id });
    return true;
  } catch (err) {
    console.warn('[arcade] el boton fallo, mando el link normal:', err.message);
    return false;
  }
}

async function enviarComoLink({ sock, jid, msg, juego, prefix, ids, nueva, cfg }) {
  const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
  const srv = web.estadoServidor();
  if (!srv.escuchando) {
    return responder(marco([
      '😴 La sala arcade está *apagada* en este momento.',
      srv.error ? `_(${srv.error})_` : '',
      'Avísale al owner: *' + prefix + 'arcade estado*'
    ].filter((x) => x !== ''), { titulo: 'ARCADE APAGADO', emoji: '🔌' }));
  }
  const base = await web.urlBase();
  if (!base) {
    return responder(marco([
      '🧭 Todavía no sé la dirección pública del arcade.',
      '',
      'El owner debe ponerla con:',
      `*${prefix}arcade url http://IP-DEL-VPS:${srv.puerto}*`
    ], { titulo: 'FALTA LA DIRECCIÓN', emoji: '🧭' }));
  }

  const { tarjeta, nueva: esNueva } = arcade.obtenerTarjeta(juego, ids, { nueva });
  const enlace = base.base + arcade.enlaceRelativo(juego, tarjeta, prefix);
  const horas = Math.max(1, Math.round((tarjeta.expira - Date.now()) / 3600000));

  await responder(marco([
    `_${juego.descripcion}_`,
    '',
    esNueva ? '🔗 *Tu link personal está abajo* ⬇️' : '🔗 *Tu link sigue vigente, está abajo* ⬇️',
    '',
    ...lineasComoSeJuega(juego, prefix, '① Ábrelo y juega'),
    '',
    REGLA,
    ...lineasPremios(cfg),
    `⏳ Dura ~${horas} h · 🤫 es solo tuyo, no lo compartas`
  ], { titulo: juego.titulo.toUpperCase(), emoji: juego.emoji }));
  if (!(await enviarBotonJugar(sock, jid, msg, juego, enlace))) await sock.sendMessage(jid, { text: enlace });
}

function comandoJuego(juego) {
  return {
    name: juego.comandos[0],
    aliases: juego.comandos.slice(1),
    category: 'arcade',
    _juegoId: juego.id,
    description: `${juego.emoji} ${juego.titulo}: te mando el juego para jugar directo desde WhatsApp y ganar monedas (se cobra con .reclamar)`,
    execute: async (sock, jid, msg, { prefix, texto }) => {
      const arg = argumentos(texto, prefix).join(' ').toLowerCase();
      const nueva = /^(nuevo|nueva|renovar|reset|otro|otra)/.test(arg);
      const cfg = arcade.leerConfigArcade();

      const ids = await idsConResolucion(sock, msg);
      if (!ids.length) return sock.sendMessage(jid, { text: 'No pude identificarte, intenta de nuevo.' });

      const datos = { sock, jid, msg, juego, prefix, ids, nueva, cfg };
      if (cfg.modo === 'panel') return enviarComoPanel(datos, enviarComoArchivo);
      return cfg.modo === 'link' ? enviarComoLink(datos) : enviarComoArchivo(datos);
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
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const partes = arcade.analizarCodigo(texto);
    if (!partes) {
      return responder(marco([
        '🎟️ Pega aquí el boleto que te dio la página del juego al perder.',
        '',
        `Ejemplo: *${prefix}reclamar FOX-ABC234-0A031B2C9D4E5F6A7*`,
        '',
        `¿Aún no tienes link? Usa *${prefix}flappy* 🦊`
      ], { titulo: 'COBRAR BOLETO', emoji: '🎟️' }));
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
      const base = {
        repetido: ['YA COBRADO', '🎟️'],
        'tope-diario': ['TOPE DIARIO', '🔒'],
        bloqueado: ['CALMA, PANDA', '⏳']
      }[r.codigo] || ['BOLETO NO VÁLIDO', '🚫'];
      return responder(marco([`⚠️ ${r.mensaje}`], { titulo: base[0], emoji: base[1] }));
    }

    const lineas = [
      `${r.juego.emoji} *${r.juego.titulo}*${nombre ? ` · _${String(nombre).slice(0, 20)}_` : ''}`,
      r.juego.resumen(r.datos),
      '',
      r.juego.rango(r.datos),
      REGLA,
      `💸 Premio: *+$${fmt(r.premio)}*`
    ];
    if (r.recortado === 'por cobro') lineas.push('ℹ️ _Se aplicó el tope por cobro._');
    if (r.recortado === 'diario') lineas.push('ℹ️ _Se aplicó el tope diario._');
    lineas.push(
      `💰 En mano: *$${fmt(r.saldo)}*`,
      `📅 Te quedan *$${fmt(r.restanteHoy)}* por ganar hoy`
    );
    if (r.puesto) {
      const record = r.nuevoRecord ? ' · 🎉 *¡NUEVO RÉCORD!*' : (r.primerRecord ? ' · 🎉 *¡Primer récord!*' : '');
      lineas.push(`🏆 Puesto *#${r.puesto}* del ranking (mejor: *${r.mejor}*)${record}`);
    }
    return responder(marco(lineas, { titulo: '¡BOLETO COBRADO!', emoji: '🎉' }));
  }
};

// ───────────── .arcade ─────────────
const CLAVES = {
  modo: 'modo', url: 'url', puerto: 'puerto', nombre: 'nombreBot', moneda: 'valorMoneda', valor: 'valorMoneda',
  maxcobro: 'maxPorCobro', maxdia: 'maxDiario', maxdiario: 'maxDiario', vigencia: 'vigenciaHoras'
};

function nombreVisible(f) {
  return f.nombre || `Jugador ····${String(f.llave).slice(-4)}`;
}

const arcadeCmd = {
  name: 'arcade',
  aliases: ['minijuegos'],
  category: 'arcade',
  description: 'Sala de juegos web que pagan monedas a tu saldo (.arcade top = ranking)',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const args = argumentos(texto, prefix);
    const sub = (args[0] || '').toLowerCase();
    const cfg = arcade.leerConfigArcade();

    // Subcomandos solo para el owner
    if (['modo', 'url', 'puerto', 'config', 'configurar', 'estado', 'quitar', 'juegos'].includes(sub)) {
      const config = leerConfig();
      if (!(await esOwnerBot(sock, config, msg))) {
        return sock.sendMessage(jid, { text: marco(['⚠️ Eso solo lo puede usar un owner del bot.'], { titulo: 'SIN PERMISOS', emoji: '👑' }) }, { quoted: msg });
      }
      return subOwner({ sock, jid, msg, prefix, sub, args: args.slice(1), cfg, comandos });
    }

    if (sub === 'top' || sub === 'ranking') {
      const juego = arcade.juegoPorRuta(args[1]) || arcade.listarJuegos()[0];
      const filas = arcade.top(juego, 10);
      if (!filas.length) {
        return sock.sendMessage(jid, {
          text: marco([`🎋 Todavía nadie ha cobrado partidas de ${juego.titulo}.`, '', `¡Sé el primero con *${prefix}${juego.comandos[0]}*! ${juego.emoji}`], { titulo: 'RANKING', emoji: '🏆' })
        }, { quoted: msg });
      }
      const medallas = ['🥇', '🥈', '🥉'];
      const lineas = [`${juego.emoji} *Mejores pilotos de ${juego.titulo}*`, ''];
      filas.forEach((f, i) => {
        lineas.push(`${medallas[i] || `*${i + 1}.*`} ${nombreVisible(f)} ➜ *${f.mejor}* ${juego.unidad || 'puntos'}`);
      });
      lineas.push('', REGLA, `🎮 Sube de puesto con *${prefix}${juego.comandos[0]}*`);
      return sock.sendMessage(jid, { text: marco(lineas, { titulo: `TOP ${juego.titulo.toUpperCase()}`, emoji: '🏆' }) }, { quoted: msg });
    }

    // Sala de juegos
    const lineas = ['🎋 _Los juegos de la manada: juega, junta monedas y cóbralas en tu saldo_', '', '🎮 *JUEGOS*'];
    for (const j of arcade.listarJuegos()) {
      lineas.push(`${j.emoji} *${j.titulo}* ➜ *${prefix}${j.comandos[0]}*`, `   ↳ _${j.descripcion}_`);
    }
    lineas.push(
      '',
      '🐾 *¿CÓMO SE JUEGA?*',
      '① Escribe el comando del juego y te lo mando',
      '② Juega; al perder te da un boleto',
      `③ Mándalo con *${prefix}reclamar BOLETO*`,
      `④ Las monedas caen en tu *${prefix}saldo* 💰`,
      '',
      REGLA,
      ...lineasPremios(cfg),
      '',
      `🏆 Ranking: *${prefix}arcade top*`
    );
    return sock.sendMessage(jid, { text: marco(lineas, { titulo: 'SALA ARCADE', emoji: '🕹️' }) }, { quoted: msg });
  }
};

async function subOwner({ sock, jid, msg, prefix, sub, args, cfg, comandos }) {
  const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
  const caja = (lineas, titulo) => marco(lineas, { titulo, emoji: '👑' });

  // Juegos instalados con .crearcmd (assets/arcade/juegos/)
  if (sub === 'juegos') {
    const extras = arcade.listarJuegos().filter((j) => j.esExtra);
    const avisos = arcade.extras.avisos(arcade.reservadosPropios());
    const lineas = extras.length
      ? extras.flatMap((j) => [`${j.emoji} *${j.titulo}* · id *${j.id}* · boleto *${j.tag}-*`, `   ↳ ${prefix}${j.comandos[0]} · quitar: *${prefix}arcade quitar ${j.id}*`])
      : ['Todavía no hay juegos instalados con *' + prefix + 'crearcmd*.', 'Manda un archivo .html con ' + prefix + 'crearcmd para instalar uno.'];
    for (const a of avisos) lineas.push(`⚠️ Ignorado: ${a}`);
    return responder(caja(lineas, 'ARCADE · JUEGOS INSTALADOS'));
  }

  if (sub === 'quitar') {
    const id = String(args[0] || '').toLowerCase();
    if (!id) return responder(caja([`Uso: *${prefix}arcade quitar <id>*`, `Mira los ids con *${prefix}arcade juegos*`], 'ARCADE · QUITAR'));
    const r = arcade.extras.quitar(id, arcade.reservadosPropios());
    if (!r.ok) return responder(caja([`⚠️ ${r.motivo}`], 'ARCADE · QUITAR'));
    if (comandos) for (const k of [...comandos.keys()]) { const c = comandos.get(k); if (c && c._juegoId === id) comandos.delete(k); }
    return responder(caja([`✅ *${r.juego.titulo}* quitado y sus comandos desactivados.`, 'Los archivos quedaron en assets/arcade/juegos/_quitados/ por si te arrepientes.'], 'ARCADE · QUITAR'));
  }

  if (sub === 'estado') {
    const srv = web.estadoServidor();
    const r = arcade.resumenEstado();
    const enLink = cfg.modo === 'link';
    const base = enLink ? await web.urlBase() : null;
    const lineas = [
      `🎛️ Modo: *${enLink ? 'link (página web del bot)' : (cfg.modo === 'panel' ? 'panel (se abre dentro de WhatsApp)' : 'archivo (se juega directo en WhatsApp)')}*`,
      ...(enLink ? [
        `🌐 Servidor web: ${srv.escuchando ? '*encendido* ✅' : `*apagado* ❌${srv.error ? ` (${srv.error})` : ''}`}`,
        `🔌 Puerto: *${srv.puerto}*`,
        `🔗 Dirección: ${base ? `*${base.base}*${base.auto ? ' _(detectada sola)_' : ''}` : `*no detectada* — usa ${prefix}arcade url ...`}`
      ] : []),
      `🎟️ Boletos vivos: *${r.tarjetasVivas}* · 🎮 Jugadores: *${r.jugadores}*`,
      '',
      REGLA,
      `🪙 Moneda: *$${fmt(cfg.valorMoneda)}* · Tope cobro: *$${fmt(cfg.maxPorCobro)}* · Tope día: *$${fmt(cfg.maxDiario)}*`,
      `⏳ Vigencia del boleto: *${cfg.vigenciaHoras} h* · Nombre en la página: *${cfg.nombreBot}*`
    ];
    if (enLink && base && base.auto) {
      lineas.push('', '🧱 Si desde fuera no abre, abre el puerto en el VPS:', `*sudo ufw allow ${srv.puerto}/tcp*`);
    }
    return responder(caja(lineas, 'ARCADE · ESTADO'));
  }

  if (sub === 'modo') {
    if (!args.length) {
      return responder(caja([
        `Modo actual: *${cfg.modo}*`,
        '',
        `📎 *${prefix}arcade modo archivo* ➜ el bot manda el juego como archivo y se juega directo en WhatsApp (sin servidor, sin puertos)`,
        `🔗 *${prefix}arcade modo link* ➜ el bot manda un link a su página web (necesita puerto abierto)`,
        `🪟 *${prefix}arcade modo panel* ➜ el juego se abre DENTRO de WhatsApp (sin servidor ni HTTPS)`
      ], 'ARCADE · MODO'));
    }
    const r = arcade.cambiarConfig('modo', args[0]);
    if (!r.ok) return responder(caja([`⚠️ ${r.motivo}`], 'MODO NO VÁLIDO'));
    if (r.valor === 'link') {
      web.iniciar();
      await new Promise((res) => setTimeout(res, 400));
      const srv = web.estadoServidor();
      return responder(caja([
        '✅ Modo *link* activado.',
        `🌐 Servidor web: ${srv.escuchando ? '*encendido*' : `*con problema* (${srv.error || 'sin detalle'})`} · puerto *${srv.puerto}*`,
        '',
        'Abre el puerto en el VPS:',
        `*sudo ufw allow ${srv.puerto}/tcp*`,
        `Revisa la dirección con *${prefix}arcade estado*`
      ], 'ARCADE · MODO'));
    }
    if (r.valor === 'panel') {
      await web.detener();
      return responder(caja(['✅ Modo *panel* activado: el juego se abre DENTRO de WhatsApp (sin servidor ni HTTPS).', 'Si tu WhatsApp no lo soporta, el bot manda el archivo como respaldo.'], 'ARCADE · MODO'));
    }
    await web.detener();
    return responder(caja(['✅ Modo *archivo* activado: ahora el juego se manda como archivo y se juega directo desde WhatsApp.', '🔌 Apagué el servidor web (ya no hace falta).'], 'ARCADE · MODO'));
  }

  if (sub === 'url') {
    if (!args.length) {
      return responder(caja([
        `Dirección actual: *${cfg.url || 'automática (IP pública del VPS)'}*`,
        '',
        `${prefix}arcade url http://123.45.67.89:${cfg.puerto}`,
        `${prefix}arcade url https://juegos.midominio.com`,
        `${prefix}arcade url auto`
      ], 'ARCADE · URL'));
    }
    const r = arcade.cambiarConfig('url', args[0]);
    if (!r.ok) return responder(caja([`⚠️ ${r.motivo}`], 'URL NO VÁLIDA'));
    return responder(caja([r.valor ? `✅ Listo, los links ahora usan: *${r.valor}*` : '✅ Listo, vuelvo a detectar la IP pública sola.'], 'ARCADE · URL'));
  }

  if (sub === 'puerto') {
    if (!args.length) return responder(caja([`Puerto actual: *${cfg.puerto}*`, `Cambia con *${prefix}arcade puerto 8788*`], 'ARCADE · PUERTO'));
    const r = arcade.cambiarConfig('puerto', args[0]);
    if (!r.ok) return responder(caja([`⚠️ ${r.motivo}`], 'PUERTO NO VÁLIDO'));
    await web.reiniciar();
    await new Promise((res) => setTimeout(res, 400));
    const srv = web.estadoServidor();
    const lineas = [`Puerto cambiado a *${r.valor}* — servidor ${srv.escuchando ? 'encendido ✅' : `con problema ❌ ${srv.error || ''}`}`];
    if (cfg.url) lineas.push('', `Recuerda actualizar *${prefix}arcade url* (el puerto va dentro de la URL).`);
    else lineas.push('', 'Abre ese puerto en el VPS:', `*sudo ufw allow ${r.valor}/tcp*`);
    return responder(caja(lineas, 'ARCADE · PUERTO'));
  }

  // config
  if (!args.length) {
    return responder(caja([
      `🎛️ modo: *${cfg.modo}*`,
      `🔗 url: *${cfg.url || 'auto'}*`,
      `🔌 puerto: *${cfg.puerto}*`,
      `🏷️ nombre (en la página): *${cfg.nombreBot}*`,
      `🪙 moneda (valor de cada moneda de oro): *$${fmt(cfg.valorMoneda)}*`,
      `🎟️ maxcobro (tope por cobro): *$${fmt(cfg.maxPorCobro)}*`,
      `📅 maxdia (tope por persona al día): *$${fmt(cfg.maxDiario)}*`,
      `⏳ vigencia (horas del link): *${cfg.vigenciaHoras}*`,
      '',
      REGLA,
      `Cambiar: *${prefix}arcade config moneda 100*`,
      `         *${prefix}arcade config maxdia 50000*`
    ], 'ARCADE · CONFIG'));
  }
  const clave = CLAVES[String(args[0]).toLowerCase()];
  if (!clave || args.length < 2) {
    return responder(caja([`⚠️ Uso: ${prefix}arcade config <${Object.keys(CLAVES).join('/')}> <valor>`], 'CONFIG'));
  }
  const valor = args.slice(1).join(' ');
  const r = arcade.cambiarConfig(clave, valor);
  if (!r.ok) return responder(caja([`⚠️ ${r.motivo}`], 'CONFIG'));
  if (clave === 'puerto') await web.reiniciar();
  return responder(caja([
    `✅ *${args[0].toLowerCase()}* = *${r.valor === '' ? 'auto' : r.valor}*`,
    '',
    '_Los links que ya se dieron siguen valiendo. El premio real siempre lo calcula el bot con estos valores (la página solo lo muestra)._'
  ], 'ARCADE · CONFIG'));
}

const exportados = [arcadeCmd, reclamar, ...arcade.listarJuegos().map(comandoJuego)];
// La fabrica queda a la mano (no enumerable, el cargador de comandos no la ve) para activar juegos nuevos en caliente
Object.defineProperty(exportados, 'comandoJuego', { value: comandoJuego, enumerable: false });
module.exports = exportados;
