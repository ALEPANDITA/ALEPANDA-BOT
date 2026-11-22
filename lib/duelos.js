'use strict';
// Duelos 1 contra 1 con apuesta (ruleta rusa, dados...). Flujo: el retador menciona a alguien + monto, el rival acepta con
// ".<comando> aceptar" y ahi el bot les quita la apuesta a los dos; el ganador se lleva el bote (las dos apuestas).
// Los desafios viven en memoria (se pierden si el bot se reinicia, pero el dinero solo se mueve al aceptar).
const { leerDB, guardarDB, getUsuario } = require('./db');
const { llaveRemitente, llavePersona, objetivoDe } = require('./economiaid');
const { reproducir, marco, ocupar, liberar } = require('./cuadros');
const { exito, advertencia } = require('./estilo');

const ESPERA_MS = 90 * 1000;
const pendientes = new Map(); // `${jid}|${llaveRival}` -> desafio
const tag = (id) => '@' + String(id || '').split('@')[0].split(':')[0];

function limpiarVencidos() {
  const ahora = Date.now();
  for (const [k, d] of pendientes) if (ahora - d.timestamp > ESPERA_MS) pendientes.delete(k);
}
const enDuelo = (jid, llave) => [...pendientes.values()].some((d) => d.jid === jid && (d.retador.llave === llave || d.rival.llave === llave));

// opciones: { comando, titulo, emoji, minimo, jugar(a, b, monto) -> { ganador: 0|1, cuadros: [...] , resumen?: string } }
async function manejarDuelo(sock, jid, msg, { texto, prefix }, op) {
  const args = texto.trim().split(/\s+/).slice(1);
  const sub = (args[0] || '').toLowerCase();
  const responder = (t, mentions) => sock.sendMessage(jid, { text: t, mentions }, { quoted: msg });
  const aviso = (t) => responder(advertencia(t, { titulo: op.titulo, estilo: 'gamer' }));
  limpiarVencidos();

  const db = leerDB();
  const yoLlave = await llaveRemitente(sock, jid, db, msg);
  const yoId = msg.key.participant || msg.key.remoteJid;

  // ---- rechazar / cancelar ----
  if (['rechazar', 'no', 'cancelar'].includes(sub)) {
    const d = [...pendientes.values()].find((x) => x.jid === jid && x.juego === op.comando && (x.rival.llave === yoLlave || x.retador.llave === yoLlave));
    if (!d) return aviso('No tienes ningún desafío pendiente.');
    pendientes.delete(`${d.jid}|${d.rival.llave}`);
    return responder(d.retador.llave === yoLlave ? `❎ ${tag(d.retador.id)} canceló su desafío.` : `🏳️ ${tag(d.rival.id)} rechazó el desafío de ${tag(d.retador.id)}.`, [d.retador.id, d.rival.id]);
  }

  // ---- aceptar ----
  if (['aceptar', 'si', 'sí', 'acepto'].includes(sub)) {
    const d = pendientes.get(`${jid}|${yoLlave}`);
    if (!d || d.juego !== op.comando) return aviso('Nadie te ha retado (o ya venció el desafío).');
    if (Date.now() - d.timestamp > ESPERA_MS) { pendientes.delete(`${jid}|${yoLlave}`); return aviso('El desafío ya venció.'); }
    if (!ocupar(d.retador.llave)) return aviso('Tu rival está en otra jugada, espera un momento.');
    if (!ocupar(d.rival.llave)) { liberar(d.retador.llave); return aviso('Estás en otra jugada, espera un momento.'); }
    pendientes.delete(`${jid}|${yoLlave}`);
    try {
      const db2 = leerDB();
      const A = getUsuario(db2, d.retador.llave); const B = getUsuario(db2, d.rival.llave);
      if (A.saldo < d.monto) return responder(`❌ ${tag(d.retador.id)} ya no tiene $${d.monto}. Desafío cancelado.`, [d.retador.id]);
      if (B.saldo < d.monto) return responder(`❌ No tienes $${d.monto} para aceptar. Tu saldo: $${B.saldo}.`);

      const partida = op.jugar({ tag: tag(d.retador.id) }, { tag: tag(d.rival.id) }, d.monto);
      const gana = partida.ganador === 0 ? [A, d.retador] : [B, d.rival];
      const pierde = partida.ganador === 0 ? [B, d.rival] : [A, d.retador];
      gana[0].saldo += d.monto; pierde[0].saldo -= d.monto; // se descuenta/paga ya: el bote es la suma de las dos apuestas
      guardarDB(db2);

      const final = exito(
        `${op.emoji} ${partida.resumen ? partida.resumen + '\n\n' : ''}🏆 ¡${tag(gana[1].id)} gana el bote de *$${d.monto * 2}*!\n` +
        `💀 ${tag(pierde[1].id)} pierde *$${d.monto}*.\n\n` +
        `💳 ${tag(gana[1].id)}: $${gana[0].saldo}  ·  ${tag(pierde[1].id)}: $${pierde[0].saldo}`,
        { titulo: op.titulo, estilo: 'gamer' });
      await reproducir(sock, jid, [...partida.cuadros, { texto: final }], { quoted: msg, pausaMs: 1100, mentions: [d.retador.id, d.rival.id] });
    } finally { liberar(d.retador.llave); liberar(d.rival.llave); }
    return;
  }

  // ---- crear desafio: .comando @rival <monto> ----
  const objetivo = objetivoDe(msg, texto);
  const monto = args.map((a) => (/^\d+$/.test(a) ? parseInt(a, 10) : NaN)).find((n) => n > 0);
  if (!objetivo || !monto) {
    return aviso(`${op.reglas}\n\nUso: ${prefix}${op.comando} @rival <monto>\nEl rival responde: ${prefix}${op.comando} aceptar  (o rechazar)\nEj: ${prefix}${op.comando} @amigo 200`);
  }
  if (monto < op.minimo) return aviso(`La apuesta mínima es *$${op.minimo}*.`);
  const rivalLlave = await llavePersona(sock, jid, db, objetivo);
  if (rivalLlave === yoLlave) return aviso('No puedes retarte a ti mismo. 😅');
  if (String(objetivo).includes(String(sock.user && sock.user.id || '#').split(':')[0].split('@')[0])) return aviso('El bot no juega, solo reparte. 🤖');
  const yo = getUsuario(db, yoLlave);
  if (yo.saldo < monto) return aviso(`No tienes suficiente saldo.\nTu saldo: *$${yo.saldo}*`);
  const rival = getUsuario(db, rivalLlave);
  if (rival.saldo < monto) return responder(`❌ ${tag(objetivo)} no tiene $${monto} para aceptar (tiene $${rival.saldo}).`, [objetivo]);
  if (enDuelo(jid, yoLlave) || enDuelo(jid, rivalLlave)) return aviso('Tú o tu rival ya tienen un desafío pendiente. Espera a que se resuelva.');

  pendientes.set(`${jid}|${rivalLlave}`, { juego: op.comando, jid, monto, timestamp: Date.now(), retador: { id: yoId, llave: yoLlave }, rival: { id: objetivo, llave: rivalLlave } });
  await sock.sendMessage(jid, {
    text: marco(`${op.emoji} ${op.titulo} ${op.emoji}`, [
      `${tag(yoId)} reta a ${tag(objetivo)}`,
      `💰 Apuesta: *$${monto}* cada uno (bote *$${monto * 2}*)`,
      '', `${tag(objetivo)}, escribe:`, `✅ *${prefix}${op.comando} aceptar*`, `❌ *${prefix}${op.comando} rechazar*`,
      '', `⏳ Tienes ${Math.round(ESPERA_MS / 1000)} segundos. El dinero se descuenta al aceptar.`]),
    mentions: [yoId, objetivo]
  }, { quoted: msg });
}

module.exports = { manejarDuelo, tag };
