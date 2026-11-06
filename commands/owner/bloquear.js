const { leerConfig } = require('../../lib/config');
const { esOwnerBot, SUPER_OWNER } = require('../../lib/permisos');
const { resolverJidReal, conTimeout } = require('../../lib/identidad');
const { leerDB, getUsuario } = require('../../lib/db');
const { caja, advertencia } = require('../../lib/estilo');
const bloqueos = require('../../lib/bloqueos');

const { numeroDe } = bloqueos;

function escapar(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Quita "<prefijo><comando>" del inicio y devuelve lo demas (mencion(es), numeros, tiempo)
function textoSinComando(texto, prefix) {
  return String(texto || '').replace(new RegExp(`^\\s*${escapar(prefix)}\\S+\\s*`), '').trim();
}

// Junta a las personas indicadas: menciones, mensaje citado y numeros escritos.
// De cada una devuelve TODOS los ids conocidos (numero, @lid...) para que el
// bloqueo funcione sin importar como WhatsApp reporte a esa persona.
async function resolverObjetivos(sock, jid, msg, resto) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
  const crudos = [...(ctx.mentionedJid || [])];
  if (ctx.participant) crudos.push(ctx.participant);

  for (const palabra of resto.split(/\s+/)) {
    if (/^\+?\d{8,16}$/.test(palabra)) crudos.push(`${palabra.replace('+', '')}@s.whatsapp.net`);
  }

  let metadata = null;
  if (jid.endsWith('@g.us')) {
    try { metadata = await sock.groupMetadata(jid); } catch (_) {}
  }

  const personas = [];
  for (const crudo of crudos) {
    const resuelto = await resolverJidReal(sock, crudo, metadata);
    const ids = [crudo, resuelto];

    const ficha = metadata?.participants?.find((p) => {
      const suyos = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).map(numeroDe);
      return suyos.includes(numeroDe(crudo)) || suyos.includes(numeroDe(resuelto));
    });
    if (ficha) ids.push(ficha.id, ficha.lid, ficha.jid, ficha.phoneNumber);

    // Si solo tenemos el numero de telefono, buscamos tambien su @lid
    if (!ficha && String(resuelto).endsWith('@s.whatsapp.net')) {
      try {
        const info = await conTimeout(sock.onWhatsApp(resuelto), 3000, null);
        if (info?.[0]?.lid) ids.push(info[0].lid);
        if (info?.[0]?.jid) ids.push(info[0].jid);
      } catch (_) {}
    }

    const numeros = [...new Set(ids.filter(Boolean).map(numeroDe))].filter(Boolean);
    const jidMostrar = String(resuelto).endsWith('@s.whatsapp.net') ? resuelto
      : (ficha?.phoneNumber ? (String(ficha.phoneNumber).includes('@') ? ficha.phoneNumber : `${ficha.phoneNumber}@s.whatsapp.net`) : resuelto);

    const existente = personas.find((p) => p.numeros.some((n) => numeros.includes(n)));
    if (existente) {
      existente.numeros = [...new Set([...existente.numeros, ...numeros])];
    } else {
      personas.push({ numeros, jid: jidMostrar });
    }
  }
  return personas;
}

function numerosProtegidos(sock, config) {
  const lista = [...(config.owners || []), SUPER_OWNER, sock.user?.id, sock.user?.lid];
  return lista.filter(Boolean).map(numeroDe);
}

function nombreConocido(jid) {
  try { return getUsuario(leerDB(), jid).nombre || ''; } catch (_) { return ''; }
}

async function soloOwner(sock, jid, msg) {
  const autorizado = await esOwnerBot(sock, leerConfig(), msg);
  if (!autorizado) {
    await sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) }, { quoted: msg });
  }
  return autorizado;
}

const bloquear = {
  name: 'bloquear',
  aliases: ['bloqueaer', 'bloquea', 'bloqueo'],
  category: 'owner',
  description: 'Bloquea a una o varias personas del bot, con tiempo opcional (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    if (!(await soloOwner(sock, jid, msg))) return;

    const resto = textoSinComando(texto, prefix);
    // Lo que no es mencion ni numero de telefono es el tiempo (1h, 30m, 5 minutos...)
    const textoTiempo = resto.split(/\s+/).filter((p) => !p.startsWith('@') && !/^\+?\d{8,16}$/.test(p)).join(' ');
    const duracion = bloqueos.leerDuracion(textoTiempo);

    if (duracion.error) {
      return sock.sendMessage(jid, {
        text: advertencia(`No entendi el tiempo. Ponlo con unidad, por ejemplo: *30m*, *1h*, *2d* o *5 minutos*.\nSi no pones tiempo, el bloqueo dura hasta que uses ${prefix}desbloquear.`, { titulo: 'TIEMPO INVALIDO', estilo: 'neon' })
      }, { quoted: msg });
    }

    const personas = await resolverObjetivos(sock, jid, msg, resto);
    if (!personas.length) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Menciona a alguien o responde su mensaje.\n\nEjemplos:\n${prefix}bloquear @user 1h\n${prefix}bloquear @user1 @user2 30m\n(respondiendo su mensaje) ${prefix}bloquear 5 minutos\n${prefix}bloquear @user  (sin tiempo = hasta desbloquearlo)`,
          { titulo: 'FALTA A QUIEN BLOQUEAR', estilo: 'neon' }
        )
      }, { quoted: msg });
    }

    const protegidos = numerosProtegidos(sock, leerConfig());
    const bloqueados = [];
    const omitidos = [];
    for (const p of personas) {
      if (p.numeros.some((n) => protegidos.includes(n))) { omitidos.push(p); continue; }
      bloqueos.bloquear({ ids: p.numeros, jid: p.jid, nombre: nombreConocido(p.jid), ms: duracion.ms || null, por: numeroDe(msg.key.participant || msg.key.remoteJid) });
      bloqueados.push(p);
    }

    const etiqueta = (p) => `@${numeroDe(p.jid)}`;
    const lineas = [];
    if (bloqueados.length) {
      lineas.push(`🚫 ${bloqueados.map(etiqueta).join(', ')}`);
      lineas.push('Ya no pueden usar el bot.');
      lineas.push(duracion.ms ? `⏱️ Tiempo: *${bloqueos.textoDuracion(duracion.ms)}*` : `♾️ Sin limite: hasta que uses *${prefix}desbloquear*`);
    }
    if (omitidos.length) {
      lineas.push(`🛡️ ${omitidos.map(etiqueta).join(', ')}: no se puede bloquear (owner o el propio bot).`);
    }

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: bloqueados.length ? 'BLOQUEADO' : 'NO SE BLOQUEO', estilo: 'neon' }),
      mentions: [...bloqueados, ...omitidos].map((p) => p.jid)
    }, { quoted: msg });
  }
};

const desbloquear = {
  name: 'desbloquear',
  aliases: ['desbloquea', 'desbloqueaer', 'unblock'],
  category: 'owner',
  description: 'Quita el bloqueo a una o varias personas, o a todas con "todos" (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    if (!(await soloOwner(sock, jid, msg))) return;

    const resto = textoSinComando(texto, prefix);

    if (/^(todos|todo|all)$/i.test(resto)) {
      const n = bloqueos.desbloquearTodos();
      return sock.sendMessage(jid, {
        text: caja([n ? `✅ Se desbloqueo a *${n}* persona(s).` : 'No habia nadie bloqueado.'], { titulo: 'DESBLOQUEO TOTAL', estilo: 'neon' })
      }, { quoted: msg });
    }

    const personas = await resolverObjetivos(sock, jid, msg, resto);
    if (!personas.length) {
      return sock.sendMessage(jid, {
        text: advertencia(`Menciona a alguien o responde su mensaje.\nEjemplo: ${prefix}desbloquear @user\nPara quitar todos: ${prefix}desbloquear todos`, { titulo: 'FALTA A QUIEN DESBLOQUEAR', estilo: 'neon' })
      }, { quoted: msg });
    }

    const liberados = [];
    const noEstaban = [];
    for (const p of personas) {
      const quitada = bloqueos.desbloquear(p.numeros);
      (quitada ? liberados : noEstaban).push(p);
    }

    const etiqueta = (p) => `@${numeroDe(p.jid)}`;
    const lineas = [];
    if (liberados.length) lineas.push(`✅ ${liberados.map(etiqueta).join(', ')} ya puede(n) usar el bot otra vez.`);
    if (noEstaban.length) lineas.push(`ℹ️ ${noEstaban.map(etiqueta).join(', ')} no estaba(n) bloqueado(s).`);

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: 'DESBLOQUEADO', estilo: 'neon' }),
      mentions: personas.map((p) => p.jid)
    }, { quoted: msg });
  }
};

const bloqueados = {
  name: 'bloqueados',
  aliases: ['listabloqueados', 'verbloqueados'],
  category: 'owner',
  description: 'Muestra quien esta bloqueado del bot y cuanto tiempo le queda (solo owner)',
  execute: async (sock, jid, msg, { prefix }) => {
    if (!(await soloOwner(sock, jid, msg))) return;

    const lista = bloqueos.listar();
    if (!lista.length) {
      return sock.sendMessage(jid, { text: caja(['No hay nadie bloqueado.'], { titulo: 'BLOQUEADOS', estilo: 'neon' }) }, { quoted: msg });
    }

    const ahora = Date.now();
    const lineas = lista.map((e, i) => {
      const quien = `@${numeroDe(e.jid)}`;
      const tiempo = e.hasta ? `quedan ${bloqueos.textoDuracion(e.hasta - ahora)}` : 'sin limite';
      return `${i + 1}. ${quien} — ${tiempo}`;
    });
    lineas.push('', `Quitar: ${prefix}desbloquear @user  |  ${prefix}desbloquear todos`);

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: `BLOQUEADOS (${lista.length})`, estilo: 'neon' }),
      mentions: lista.map((e) => e.jid)
    }, { quoted: msg });
  }
};

module.exports = [bloquear, desbloquear, bloqueados];
