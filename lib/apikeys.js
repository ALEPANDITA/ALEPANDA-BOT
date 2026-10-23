const fs = require('fs');
const path = require('path');
const keysPath = path.join(__dirname, '..', 'api-keys.json');

// Estructura del archivo: { "servicio": ["clave1", "clave2", ...] }
// (Los archivos viejos con "servicio": "clave" se migran solos al leerlos.)

function leerKeys() {
  if (!fs.existsSync(keysPath)) {
    const inicial = {};
    fs.writeFileSync(keysPath, JSON.stringify(inicial, null, 2));
    return inicial;
  }

  const data = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
  let migrado = false;

  for (const servicio of Object.keys(data)) {
    if (typeof data[servicio] === 'string') {
      data[servicio] = data[servicio].trim() ? [data[servicio]] : [];
      migrado = true;
    } else if (!Array.isArray(data[servicio])) {
      data[servicio] = [];
      migrado = true;
    }
  }

  if (migrado) guardarKeys(data);
  return data;
}

function guardarKeys(keys) {
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
}

// Devuelve TODAS las claves guardadas de un servicio (array, puede estar vacio)
function getApiKeys(servicio) {
  const keys = leerKeys();
  return keys[servicio] || [];
}

// Devuelve solo la primera clave (para el codigo viejo que solo espera una)
function getApiKey(servicio) {
  const claves = getApiKeys(servicio);
  return claves[0] || null;
}

// Agrega una clave nueva a la lista del servicio, sin borrar las que ya habia
function agregarApiKey(servicio, valor) {
  const keys = leerKeys();
  if (!Array.isArray(keys[servicio])) keys[servicio] = [];
  if (!keys[servicio].includes(valor)) keys[servicio].push(valor);
  guardarKeys(keys);
  return keys[servicio];
}

// Reemplaza TODAS las claves de un servicio por una sola (se mantiene por compatibilidad)
function setApiKey(servicio, valor) {
  const keys = leerKeys();
  keys[servicio] = [valor];
  guardarKeys(keys);
}

// Elimina una clave de un servicio por su numero de lista (1, 2, 3...) o por el valor exacto
function quitarApiKey(servicio, indiceOValor) {
  const keys = leerKeys();
  if (!Array.isArray(keys[servicio]) || keys[servicio].length === 0) return null;

  let indice = -1;
  const comoNumero = Number(indiceOValor);
  if (Number.isInteger(comoNumero) && comoNumero >= 1 && comoNumero <= keys[servicio].length) {
    indice = comoNumero - 1;
  } else {
    indice = keys[servicio].indexOf(indiceOValor);
  }

  if (indice === -1) return null;

  const eliminada = keys[servicio].splice(indice, 1)[0];
  guardarKeys(keys);
  return eliminada;
}

// Servicios que el bot sabe usar (sirve para avisar cuando alguien escribe mal el nombre)
const SERVICIOS_CONOCIDOS = [
  'gemini', 'groq', 'nvidia', 'openrouter',
  'tiktok', 'mediafire', 'pinterest', 'facebook', 'instagram', 'ytmp3', 'ytmp4',
  'dvyer', 'evogb', 'audd', 'sightengine_user', 'sightengine_secret'
];

function distancia(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) { m[i] = [i]; }
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

// Devuelve el servicio conocido mas parecido a "nombre" (ej. "gorq" -> "groq"), o null si ninguno se parece
function servicioParecido(nombre) {
  let mejor = null;
  let mejorDist = 3;
  for (const s of SERVICIOS_CONOCIDOS) {
    const d = distancia(nombre, s);
    if (d < mejorDist) { mejor = s; mejorDist = d; }
  }
  return mejor;
}

module.exports = { leerKeys, guardarKeys, getApiKey, getApiKeys, agregarApiKey, setApiKey, quitarApiKey, SERVICIOS_CONOCIDOS, servicioParecido };
