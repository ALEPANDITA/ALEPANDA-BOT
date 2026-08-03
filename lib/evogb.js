// lib/evogb.js
// Centraliza las llamadas a api.evogb.org. Antes, ~14 comandos tenian la
// clave escrita a mano y repetida ("evogb-WPHlBOdu"), asi que si esa clave
// se moria, TODOS esos comandos se caian de golpe y ninguno miraba las
// claves que el owner fuera guardando con .setapikey.
//
// Este helper prueba, para cada peticion, todas las claves guardadas con
// .setapikey evogb <clave> (pueden ser varias) y si ninguna esta guardada
// usa la clave original de fabrica como ultimo recurso. Si una clave falla,
// prueba la siguiente automaticamente, en la MISMA peticion.

const { getApiKeys } = require('./apikeys');

const CLAVE_DE_FABRICA = 'evogb-WPHlBOdu'; // la que traia el bot originalmente, puede estar agotada

function obtenerClaves() {
  let claves = [];
  try {
    claves = getApiKeys('evogb') || [];
  } catch (e) {
    claves = [];
  }
  if (!claves.length) claves = [CLAVE_DE_FABRICA];
  return claves;
}

// Recibe la URL de evogb SIN el parametro "key" (ej: ".../sfw/interaction?type=hug")
// y prueba cada clave disponible hasta que una responda bien (HTTP ok).
// Devuelve el mismo tipo de objeto que fetch() normal (con .ok, .json(), .status),
// para no tener que reescribir el resto de cada comando: siguen usando
// res.ok / res.json() exactamente igual que antes.
async function fetchEvogb(urlSinClave) {
  const claves = obtenerClaves();
  const separador = urlSinClave.includes('?') ? '&' : '?';
  let ultimaRespuesta = null;

  for (const clave of claves) {
    try {
      const res = await fetch(`${urlSinClave}${separador}key=${clave}`);
      ultimaRespuesta = res;
      if (res.ok) return res;
    } catch (err) {
      // Error de red con esta clave/host: seguimos con la siguiente clave.
    }
  }

  // Si ninguna clave funciono, devolvemos la ultima respuesta obtenida
  // (normalmente con .ok = false) para que cada comando la maneje con su
  // propio mensaje de error de siempre.
  return ultimaRespuesta;
}

module.exports = { fetchEvogb, obtenerClaves, CLAVE_DE_FABRICA };
