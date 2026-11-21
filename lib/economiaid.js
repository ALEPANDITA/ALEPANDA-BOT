// lib/economiaid.js
// Ayuda para que los comandos de economia (robar, transferir, depositar, retirar...) identifiquen a la persona
// (quien escribe y a quien se menciona/responde) con la MISMA identidad unica de lib/db.js (unirIdentidad).
// WhatsApp da a la misma persona como @lid o como numero segun el caso; aqui se juntan todos sus ids con ayuda de la ficha
// del grupo y del mapeo lid<->numero, y se devuelve su llave de cartera.
const { unirIdentidad, claveCanonica } = require('./db');
const { conTimeout } = require('./identidad');

const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];

// Todos los ids que se conozcan de esta persona (ficha del grupo + mapeo de Baileys)
async function idsDePersona(sock, jid, id, extra = []) {
  const ids = new Set([id, ...extra].filter(Boolean));
  const nums = new Set([...ids].map(numeroDe));
  if (String(jid).endsWith('@g.us')) {
    let meta = null;
    try { meta = await conTimeout(Promise.resolve(sock.groupMetadata(jid)), 3000, null); } catch (_) { meta = null; }
    const ficha = meta && Array.isArray(meta.participants)
      ? meta.participants.find((p) => [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some((x) => nums.has(numeroDe(x))))
      : null;
    if (ficha) for (const x of [ficha.id, ficha.lid, ficha.jid, ficha.phoneNumber]) if (x) ids.add(String(x).includes('@') ? x : `${x}@s.whatsapp.net`);
  }
  const mapa = sock.signalRepository && sock.signalRepository.lidMapping;
  if (mapa) {
    for (const x of [...ids]) {
      try { const pn = await conTimeout(mapa.getPNForLID && mapa.getPNForLID(x), 1500, null); if (pn) ids.add(pn); } catch (_) { /* sin mapeo */ }
      try { const lid = await conTimeout(mapa.getLIDForPN && mapa.getLIDForPN(x), 1500, null); if (lid) ids.add(lid); } catch (_) { /* idem */ }
    }
  }
  return [...ids];
}

// Une los ids de la persona en una sola cartera y devuelve su llave
async function llavePersona(sock, jid, db, id, extra = []) {
  const ids = await idsDePersona(sock, jid, id, extra);
  return unirIdentidad(db, ids) || claveCanonica(db, id);
}

// Llave de quien escribio el mensaje
async function llaveRemitente(sock, jid, db, msg) {
  const k = (msg && msg.key) || {};
  const id = k.participant || k.remoteJid;
  return llavePersona(sock, jid, db, id, [k.participantPn, k.participantAlt]);
}

// A quien se menciona o se responde (en cualquier tipo de mensaje: texto, imagen con pie, etc.). Si no hay, intenta un numero escrito.
function objetivoDe(msg, texto = '') {
  const m = (msg && msg.message) || {};
  for (const tipo of Object.keys(m)) {
    const ci = m[tipo] && m[tipo].contextInfo;
    if (!ci) continue;
    const mencionado = ci.mentionedJid && ci.mentionedJid[0];
    if (mencionado) return mencionado;
    if (ci.participant) return ci.participant;
  }
  const numero = String(texto || '').replace(/[+\s()-]/g, ' ').match(/(?:^|\s)(\d{8,15})(?=\s|$)/);
  return numero ? `${numero[1]}@s.whatsapp.net` : null;
}

module.exports = { idsDePersona, llavePersona, llaveRemitente, objetivoDe };
