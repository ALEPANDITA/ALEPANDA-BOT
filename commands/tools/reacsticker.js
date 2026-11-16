// REACSTICKER: guarda stickers y reacciona con ellos a un mensaje (uno solo o en rafaga).
// Adaptado de la version TypeScript que te pasaron. Los stickers se guardan en reacsticker-cache/
//   .reacsticker save <nombre>        (respondiendo a un sticker)
//   .reacticker <nombre>              (respondiendo al mensaje al que quieres reaccionar)
//   .reacsticker boom <nombre> [cant] / .reacsticker boom2 [rondas]
//   .reacsticker list / .reacsticker del <nombre>
const fs = require('fs');
const path = require('path');
const baileys = require('@whiskeysockets/baileys');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, resolverLid, mismoUsuario } = require('../../lib/permisos');
const { caja, exito, advertencia, error: cajaError } = require('../../lib/estilo');

// ───────── Ajustes (editables) ─────────
// Los limites son mas bajos que los del comando original para no arriesgar el numero del bot por mandar mensajes muy rapido.
const CARPETA_CACHE = path.join(process.cwd(), 'reacsticker-cache');
const RAFAGA_POR_DEFECTO = 10;
const RAFAGA_MAXIMA = 20;
const PAUSA_ENTRE_STICKERS_MS = 350;
const ESPERA_ENTRE_RAFAGAS_MS = 20 * 1000; // por chat
const TITULO = 'REACSTICKER';

fs.mkdirSync(CARPETA_CACHE, { recursive: true });

// BufferJSON viene de baileys; si el fork no lo exporta, se usa este equivalente.
const BufferJSON = baileys.BufferJSON || {
  replacer: (_k, v) => {
    if (v && v.type === 'Buffer' && Array.isArray(v.data)) return { type: 'Buffer', data: Buffer.from(v.data).toString('base64') };
    if (v instanceof Uint8Array) return { type: 'Buffer', data: Buffer.from(v).toString('base64') };
    return v;
  },
  reviver: (_k, v) => {
    if (v && v.type === 'Buffer' && typeof v.data === 'string') return Buffer.from(v.data, 'base64');
    if (v && v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
    return v;
  }
};

const normalizarJid = baileys.jidNormalizedUser || ((jid) => String(jid || '').replace(/:\d+@/, '@'));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const ultimaRafaga = new Map();

// ───────── Utilidades de mensajes ─────────
function limpiarNombre(nombre) {
  return String(nombre || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

function desenvolver(message) {
  if (!message || typeof message !== 'object') return null;
  const envolturas = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage', 'editedMessage'];
  for (const clave of envolturas) {
    if (message[clave]?.message) return desenvolver(message[clave].message);
  }
  return message;
}

function extraerContextInfo(msg) {
  const raiz = desenvolver(msg?.message);
  if (!raiz) return null;
  const preferidos = ['extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage', 'audioMessage'];
  for (const clave of preferidos) {
    if (raiz[clave]?.contextInfo?.stanzaId) return raiz[clave].contextInfo;
  }
  for (const clave of Object.keys(raiz)) {
    if (clave === 'messageContextInfo') continue;
    const contenido = raiz[clave];
    if (contenido && typeof contenido === 'object' && contenido.contextInfo?.stanzaId) return contenido.contextInfo;
  }
  return null;
}

function limpiarSticker(stickerCitado) {
  const copia = JSON.parse(JSON.stringify(stickerCitado, BufferJSON.replacer), BufferJSON.reviver);
  delete copia.contextInfo;
  if (!copia.url && typeof copia.directPath === 'string' && copia.directPath.startsWith('/')) {
    copia.url = `https://mmg.whatsapp.net${copia.directPath}`;
  }
  return copia;
}

// Ids con los que se puede reconocer a quien escribe (JID, LID y sus alternos)
async function idsDelRemitente(sock, msg) {
  const k = msg.key || {};
  const crudo = k.participant || k.remoteJid;
  const lista = [crudo, k.participantAlt, k.remoteJidAlt].filter(Boolean);
  try {
    const resuelto = await resolverLid(sock, crudo);
    if (resuelto) lista.push(resuelto);
  } catch (_) {}
  return [...new Set(lista)];
}

const sonMismaPersona = (idsA, idsB) => (idsA || []).some((a) => (idsB || []).some((b) => mismoUsuario(a, b)));

// ───────── Guardado en disco ─────────
function guardarEnDisco(nombre, sticker, meta) {
  const registro = { sticker, creadorIds: meta.creadorIds, creadorNombre: meta.creadorNombre, creadoEn: Date.now() };
  fs.writeFileSync(path.join(CARPETA_CACHE, `${nombre}.json`), JSON.stringify(registro, BufferJSON.replacer), 'utf8');
}

function leerArchivo(rutaCompleta) {
  try {
    const parsed = JSON.parse(fs.readFileSync(rutaCompleta, 'utf8'), BufferJSON.reviver);
    if (!parsed || typeof parsed !== 'object') return null;
    const sticker = parsed.sticker && typeof parsed.sticker === 'object' ? parsed.sticker : parsed;
    delete sticker.contextInfo;
    if (!sticker.url && typeof sticker.directPath === 'string' && sticker.directPath.startsWith('/')) {
      sticker.url = `https://mmg.whatsapp.net${sticker.directPath}`;
    }
    return { stickerMessage: sticker, creadorIds: parsed.creadorIds || [], creadorNombre: parsed.creadorNombre };
  } catch (_) {
    return null;
  }
}

function archivosGuardados() {
  return fs.readdirSync(CARPETA_CACHE).filter((f) => f.endsWith('.json'));
}

function cargarPorNombre(consulta) {
  const limpio = limpiarNombre(consulta);
  if (!limpio) return null;
  const exacto = path.join(CARPETA_CACHE, `${limpio}.json`);
  if (fs.existsSync(exacto)) {
    const datos = leerArchivo(exacto);
    if (datos) return { nombre: limpio, ...datos };
  }
  // Si no hay uno exacto, se acepta el primero que empiece con lo que escribiste
  for (const archivo of archivosGuardados()) {
    const base = archivo.replace(/\.json$/i, '');
    if (base.startsWith(limpio)) {
      const datos = leerArchivo(path.join(CARPETA_CACHE, archivo));
      if (datos) return { nombre: base, ...datos };
    }
  }
  return null;
}

function cargarTodos() {
  const lista = [];
  for (const archivo of archivosGuardados()) {
    const datos = leerArchivo(path.join(CARPETA_CACHE, archivo));
    if (datos) lista.push({ nombre: archivo.replace(/\.json$/i, ''), ...datos });
  }
  return lista;
}

function hashHex(sticker) {
  const sha = sticker?.fileSha256;
  if (!sha) return '';
  if (Buffer.isBuffer(sha) || sha instanceof Uint8Array) return Buffer.from(sha).toString('hex');
  return '';
}

function buscarDuplicado(hash) {
  if (!hash) return null;
  for (const archivo of archivosGuardados()) {
    const datos = leerArchivo(path.join(CARPETA_CACHE, archivo));
    if (datos && hashHex(datos.stickerMessage) === hash) return archivo.replace(/\.json$/i, '');
  }
  return null;
}

// ───────── Envio de la reaccion con sticker ─────────
function claveDelMensajePadre(sock, jid, msg, ctxInfo) {
  if (!ctxInfo?.stanzaId) return msg.key;

  const esGrupo = jid.endsWith('@g.us');
  const participante = ctxInfo.participant ? normalizarJid(String(ctxInfo.participant)) : '';
  const idBot = sock?.user?.id ? normalizarJid(sock.user.id) : '';
  const lidBot = sock?.user?.lid ? normalizarJid(sock.user.lid) : '';
  const esMio = Boolean(participante && ((idBot && mismoUsuario(participante, idBot)) || (lidBot && mismoUsuario(participante, lidBot))));

  const clave = { remoteJid: jid, fromMe: esMio, id: String(ctxInfo.stanzaId) };
  if (esGrupo && participante) clave.participant = participante;
  return clave;
}

async function enviarReaccionSticker(sock, jid, claveMensajePadre, stickerMessage) {
  await sock.relayMessage(jid, {
    messageContextInfo: { messageAssociation: { associationType: 11, parentMessageKey: claveMensajePadre } },
    stickerMessage
  }, {});
}

// ───────── Comando ─────────
module.exports = {
  name: 'reacsticker',
  aliases: ['reacticker', 'reactsticker', 'rsticker'],
  category: 'tools',
  description: 'Guarda stickers y reacciona con ellos a un mensaje (uno solo o en rafaga con boom / boom2).',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const args = String(texto || '').trim().slice(prefix.length).trim().split(/\s+/).slice(1).filter(Boolean);
    const sub = String(args[0] || '').toLowerCase();

    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const reaccionar = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }).catch(() => undefined);

    try {
      // ───── lista ─────
      if (sub === 'list' || sub === 'lista') {
        const guardados = cargarTodos();
        if (!guardados.length) {
          return responder(advertencia(`No hay stickers guardados.\nResponde a un sticker con ${prefix}reacsticker save <nombre> para guardarlo.`, { titulo: TITULO }));
        }
        const lineas = guardados.map((s, i) => `${i + 1}. \`${s.nombre}\`${s.creadorNombre ? ` _(por ${s.creadorNombre})_` : ''}`);
        return responder(caja([
          `*Stickers guardados:* (${guardados.length})`,
          ...lineas,
          '',
          `• Reaccion simple: ${prefix}reacticker <nombre>`,
          `• Rafaga de 1 sticker: ${prefix}reacsticker boom <nombre> [cant]`,
          `• Rafaga de todos: ${prefix}reacsticker boom2 [rondas]`
        ], { titulo: TITULO }));
      }

      // ───── borrar ─────
      if (sub === 'del' || sub === 'delete' || sub === 'rm') {
        const nombre = limpiarNombre(args.slice(1).join(''));
        if (!nombre) return responder(advertencia(`Indica el nombre del sticker a eliminar.\nEj: ${prefix}reacsticker del <nombre>`, { titulo: TITULO }));

        const ruta = path.join(CARPETA_CACHE, `${nombre}.json`);
        if (!fs.existsSync(ruta)) return responder(cajaError(`No existe ningun sticker guardado con el nombre \`${nombre}\`.`, { titulo: TITULO }));

        const existente = leerArchivo(ruta);
        const esOwner = await esOwnerBot(sock, leerConfig(), msg);
        const esCreador = sonMismaPersona(await idsDelRemitente(sock, msg), existente?.creadorIds);
        if (!esOwner && !esCreador) {
          return responder(advertencia(`No tienes permiso para eliminar \`${nombre}\`.\nSolo quien lo guardo o un owner puede eliminarlo.`, { titulo: TITULO }));
        }

        fs.unlinkSync(ruta);
        await reaccionar('🗑️');
        return responder(exito(`Sticker \`${nombre}\` eliminado.`, { titulo: TITULO }));
      }

      const ctxInfo = extraerContextInfo(msg);
      const citadoRaiz = desenvolver(ctxInfo?.quotedMessage);

      // ───── guardar ─────
      if (sub === 'save' || sub === 'guardar') {
        const nombre = limpiarNombre(args.slice(1).join(''));
        if (!nombre) return responder(advertencia(`Escribe un nombre para guardar el sticker.\nEj: ${prefix}reacsticker save gatoxd`, { titulo: TITULO }));

        const stickerCitado = citadoRaiz?.stickerMessage;
        if (!stickerCitado) {
          return responder(advertencia(`Debes responder a un *sticker* con ${prefix}reacsticker save ${nombre}`, { titulo: TITULO }));
        }

        const carga = limpiarSticker(stickerCitado);
        if (!carga.mediaKey || (!carga.directPath && !carga.url)) {
          return responder(cajaError('El sticker seleccionado no trae los datos necesarios para guardarse.', { titulo: TITULO }));
        }

        const misIds = await idsDelRemitente(sock, msg);
        const esOwner = await esOwnerBot(sock, leerConfig(), msg);

        // Si ya existe uno con ese nombre, solo su creador o un owner puede sobrescribirlo
        const rutaExistente = path.join(CARPETA_CACHE, `${nombre}.json`);
        if (fs.existsSync(rutaExistente)) {
          const existente = leerArchivo(rutaExistente);
          if (!esOwner && !sonMismaPersona(misIds, existente?.creadorIds)) {
            return responder(advertencia(`El sticker \`${nombre}\` ya lo guardo otra persona.\nSolo quien lo guardo o un owner puede sobrescribirlo.`, { titulo: TITULO }));
          }
        }

        const duplicado = buscarDuplicado(hashHex(carga));
        guardarEnDisco(nombre, carga, { creadorIds: misIds, creadorNombre: msg.pushName || 'Usuario' });
        await reaccionar('💾');

        if (duplicado && duplicado !== nombre) {
          return responder(exito(`Sticker guardado como \`${nombre}\` (tambien esta como \`${duplicado}\`).`, { titulo: TITULO }));
        }
        return responder(exito(`Sticker guardado como \`${nombre}\`.\nResponde a un mensaje con ${prefix}reacticker ${nombre} o ${prefix}reacsticker boom ${nombre}.`, { titulo: TITULO }));
      }

      // ───── boom (rafaga con un sticker) ─────
      if (sub === 'boom') {
        if (!ctxInfo?.stanzaId) {
          return responder(advertencia(`Responde al mensaje que quieres rodear de reacciones y escribe:\n${prefix}reacsticker boom <nombre> [cantidad]`, { titulo: TITULO }));
        }

        const espera = ESPERA_ENTRE_RAFAGAS_MS - (Date.now() - (ultimaRafaga.get(jid) || 0));
        if (espera > 0) return responder(advertencia(`Calma, espera ${Math.ceil(espera / 1000)} s antes de otra rafaga en este chat.`, { titulo: TITULO }));

        const clavePadre = claveDelMensajePadre(sock, jid, msg, ctxInfo);
        const arg1 = String(args[1] || '').trim();
        const arg2 = String(args[2] || '').trim();

        let cantidad = RAFAGA_POR_DEFECTO;
        let sticker = null;

        if (/^\d+$/.test(arg1)) {
          cantidad = Math.min(RAFAGA_MAXIMA, Math.max(2, parseInt(arg1, 10)));
        } else if (arg1) {
          const encontrado = cargarPorNombre(arg1);
          if (!encontrado) {
            return responder(cajaError(`No se encontro el sticker \`${limpiarNombre(arg1)}\`.\nUsa ${prefix}reacsticker list para ver los guardados.`, { titulo: TITULO }));
          }
          sticker = encontrado.stickerMessage;
          if (/^\d+$/.test(arg2)) cantidad = Math.min(RAFAGA_MAXIMA, Math.max(2, parseInt(arg2, 10)));
        }

        if (!sticker) {
          if (citadoRaiz?.stickerMessage) {
            sticker = limpiarSticker(citadoRaiz.stickerMessage);
          } else {
            const todos = cargarTodos();
            if (!todos.length) {
              return responder(advertencia(`No tienes stickers guardados. Guarda uno primero con ${prefix}reacsticker save <nombre>`, { titulo: TITULO }));
            }
            sticker = todos[0].stickerMessage;
          }
        }

        ultimaRafaga.set(jid, Date.now());
        await reaccionar('💥');
        for (let i = 0; i < cantidad; i++) {
          await enviarReaccionSticker(sock, jid, clavePadre, sticker);
          if (i + 1 < cantidad) await dormir(PAUSA_ENTRE_STICKERS_MS);
        }
        await reaccionar('✅');
        return;
      }

      // ───── boom2 (rafaga con todos los guardados) ─────
      if (sub === 'boom2') {
        if (!ctxInfo?.stanzaId) {
          return responder(advertencia(`Responde al mensaje al que quieres reaccionar con todos los stickers y escribe:\n${prefix}reacsticker boom2 [rondas]`, { titulo: TITULO }));
        }

        const todos = cargarTodos();
        if (!todos.length) {
          return responder(advertencia(`No hay stickers guardados para usar boom2.\nGuarda varios con ${prefix}reacsticker save <nombre>`, { titulo: TITULO }));
        }

        const espera = ESPERA_ENTRE_RAFAGAS_MS - (Date.now() - (ultimaRafaga.get(jid) || 0));
        if (espera > 0) return responder(advertencia(`Calma, espera ${Math.ceil(espera / 1000)} s antes de otra rafaga en este chat.`, { titulo: TITULO }));

        const clavePadre = claveDelMensajePadre(sock, jid, msg, ctxInfo);
        const rondasArg = parseInt(String(args[1] || '1'), 10);
        const rondas = Number.isFinite(rondasArg) && rondasArg > 0 ? rondasArg : 1;
        const total = Math.min(RAFAGA_MAXIMA, todos.length * rondas);

        ultimaRafaga.set(jid, Date.now());
        await reaccionar('💣');
        for (let i = 0; i < total; i++) {
          await enviarReaccionSticker(sock, jid, clavePadre, todos[i % todos.length].stickerMessage);
          if (i + 1 < total) await dormir(PAUSA_ENTRE_STICKERS_MS);
        }
        await reaccionar('✅');
        return;
      }

      // ───── reaccion simple con un sticker guardado ─────
      const nombrePedido = limpiarNombre(args.join(''));
      if (nombrePedido) {
        const encontrado = cargarPorNombre(nombrePedido);
        if (!encontrado) {
          return responder(cajaError(`No se encontro el sticker \`${nombrePedido}\`.\nUsa ${prefix}reacsticker list para ver los guardados, o guardalo con ${prefix}reacsticker save ${nombrePedido}`, { titulo: TITULO }));
        }
        await enviarReaccionSticker(sock, jid, claveDelMensajePadre(sock, jid, msg, ctxInfo), encontrado.stickerMessage);
        await reaccionar('✅');
        return;
      }

      // ───── reaccion simple con el sticker que respondes ─────
      if (citadoRaiz?.stickerMessage) {
        await enviarReaccionSticker(sock, jid, claveDelMensajePadre(sock, jid, msg, ctxInfo), limpiarSticker(citadoRaiz.stickerMessage));
        await reaccionar('✅');
        return;
      }

      // ───── ayuda ─────
      return responder(caja([
        `*Guardar:* responde a un sticker con ${prefix}reacsticker save <nombre>`,
        `*Reaccionar:* responde a un mensaje con ${prefix}reacticker <nombre>`,
        `*Sticker citado:* responde a un sticker con ${prefix}reacticker`,
        `*Boom (1 sticker):* ${prefix}reacsticker boom <nombre> [cant]`,
        `*Boom2 (todos):* ${prefix}reacsticker boom2 [rondas]`,
        `*Lista / eliminar:* ${prefix}reacsticker list | ${prefix}reacsticker del <nombre>`
      ], { titulo: TITULO }));
    } catch (err) {
      console.error('[reacsticker]', err);
      await reaccionar('❌');
      await responder(cajaError(`Error: ${err?.message || String(err)}`, { titulo: TITULO })).catch(() => undefined);
    }
  }
};
