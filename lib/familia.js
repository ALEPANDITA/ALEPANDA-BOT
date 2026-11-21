// lib/familia.js
// Adopciones (.adoptar) y boda. Usa la misma lista de propuestas que .casar (lib/matrimonio),
// asi index.js ya sabe recibir el "si"/"no". propuesta.tipo === 'adopcion' -> aceptarAdopcion.
const { leerDB, guardarDB, getUsuario } = require('./db');
const { mismoNumero } = require('./identidad');
const { propuestasPorMensaje, tienePropuestaActiva, TIEMPO_EXPIRA } = require('./matrimonio');

const MAX_HIJOS = 10;
const tag = (j) => '@' + String(j || '').split('@')[0].split(':')[0];
const num = (j) => String(j || '').split('@')[0];

// ¿"posible" es un ancestro (padre, abuelo...) de "id"?
function esAncestro(db, id, posible, nivel = 0) {
  if (nivel > 6) return false;
  const perfil = db.usuarios && db.usuarios[id];
  for (const p of (perfil && perfil.padres) || []) {
    if (mismoNumero(p, posible) || esAncestro(db, p, posible, nivel + 1)) return true;
  }
  return false;
}

// Devuelve un texto de error o null si se puede adoptar.
function motivoNoSePuede(db, padre, hijo) {
  const perfilPadre = getUsuario(db, padre);
  const perfilHijo = getUsuario(db, hijo);
  if (mismoNumero(padre, hijo)) return 'No puedes adoptarte a ti mismo/a. 😅';
  if (perfilPadre.pareja && mismoNumero(perfilPadre.pareja, hijo)) return 'No puedes adoptar a tu pareja. 😳';
  if ((perfilPadre.hijos || []).some((h) => mismoNumero(h, hijo))) return 'Esa persona ya es tu hijo/a.';
  if ((perfilPadre.hijos || []).length >= MAX_HIJOS) return `Ya tienes ${MAX_HIJOS} hijos, es el máximo.`;
  if ((perfilHijo.padres || []).length) return 'Esa persona ya tiene familia (ya fue adoptada).';
  if ((perfilPadre.padres || []).some((p) => mismoNumero(p, hijo)) || esAncestro(db, padre, hijo)) return 'No puedes adoptar a tu propio padre/madre. 🤨';
  return null;
}

async function proponer(sock, jid, msg, padre, hijo) {
  const db = leerDB();
  const motivo = motivoNoSePuede(db, padre, hijo);
  if (motivo) return sock.sendMessage(jid, { text: motivo }, { quoted: msg });
  if (tienePropuestaActiva(num(padre)) || tienePropuestaActiva(num(hijo))) {
    return sock.sendMessage(jid, { text: 'Ya hay una propuesta pendiente (boda o adopción) para alguna de las dos personas. Espera a que se resuelva.' }, { quoted: msg });
  }
  const minutos = Math.round(TIEMPO_EXPIRA / 60000);
  const enviado = await sock.sendMessage(jid, {
    text: `👶 ${tag(padre)} quiere adoptar a ${tag(hijo)}!\n\n` +
      `${tag(hijo)}, responde a *este mensaje* con "si" para aceptar ser su hijo/a, o "no" para rechazar.\n` +
      `⏳ Tienes ${minutos} minutos antes de que expire.`,
    mentions: [padre, hijo]
  }, { quoted: msg });
  propuestasPorMensaje.set(enviado.key.id, { tipo: 'adopcion', de: padre, para: hijo, jid, timestamp: Date.now() });
}

// index.js lo llama cuando el hijo responde "si"
async function aceptarAdopcion(sock, propuesta) {
  const padre = propuesta.de;
  const hijo = propuesta.para;
  const db = leerDB();
  const motivo = motivoNoSePuede(db, padre, hijo);
  if (motivo) return sock.sendMessage(propuesta.jid, { text: `La adopción ya no es válida: ${motivo}` });

  const perfilPadre = getUsuario(db, padre);
  const perfilHijo = getUsuario(db, hijo);
  const padres = [padre];
  if (perfilPadre.pareja && !mismoNumero(perfilPadre.pareja, hijo)) padres.push(perfilPadre.pareja);
  for (const idPadre of padres) {
    const perfil = getUsuario(db, idPadre);
    if (!Array.isArray(perfil.hijos)) perfil.hijos = [];
    if (!perfil.hijos.some((h) => mismoNumero(h, hijo))) perfil.hijos.push(hijo);
  }
  perfilHijo.padres = padres;
  guardarDB(db);

  await sock.sendMessage(propuesta.jid, {
    text: `👨‍👩‍👧 *¡NUEVA FAMILIA!* 🎉\n\n${tag(hijo)} fue adoptado/a por ${padres.map(tag).join(' y ')}.\n` +
      `Ahora son familia. 🥹💞\n\n_Mira el árbol familiar en el comando de perfil._`,
    mentions: [...padres, hijo]
  });
}

// index.js lo llama cuando aceptan la propuesta de matrimonio
async function celebrarBoda(sock, propuesta) {
  return require('./boda').celebrarBoda(sock, propuesta.jid, propuesta.de, propuesta.para);
}

module.exports = { proponer, aceptarAdopcion, celebrarBoda, MAX_HIJOS };
