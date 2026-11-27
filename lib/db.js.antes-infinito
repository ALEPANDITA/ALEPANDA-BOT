const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database.json');

function leerDB() {
  if (!fs.existsSync(dbPath)) {
    const inicial = { usuarios: {}, grupos: {} };
    fs.writeFileSync(dbPath, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function guardarDB(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// ---- Identidad unica de la economia ----
// WhatsApp reporta a la misma persona como "numero@s.whatsapp.net" o como "xxxx@lid" segun el grupo/momento. Antes cada
// comando guardaba el dinero bajo el id que le llegaba, y un mismo usuario acababa con VARIAS carteras (minar sumaba en una,
// la ruleta leia otra). Ahora db.alias_economia mapea CADA numero/lid conocido de una persona a UNA sola llave
// (su numero real cuando se conoce) y getUsuario() siempre redirige ahi, asi todos los comandos comparten cartera.
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];

function claveCanonica(db, id) {
  const alias = db && db.alias_economia;
  return (alias && alias[numeroDe(id)]) || id;
}

const SUMAR = ['saldo', 'banco'];
function fusionar(destino, origen) {
  for (const k of Object.keys(origen)) {
    const a = destino[k]; const b = origen[k];
    if (SUMAR.includes(k)) destino[k] = (Number(a) || 0) + (Number(b) || 0);
    else if (Array.isArray(a) && Array.isArray(b)) { const vistos = new Set(a.map((x) => JSON.stringify(x))); for (const x of b) if (!vistos.has(JSON.stringify(x))) a.push(x); }
    else if (typeof a === 'number' && typeof b === 'number') destino[k] = /^(last|ultimo)/i.test(k) ? Math.max(a, b) : (a || b);
    else if (['gachaHP', 'gachaAnime'].includes(k) && a && b && typeof a === 'object' && typeof b === 'object') { for (const n of Object.keys(b)) a[n] = (Number(a[n]) || 0) + (Number(b[n]) || 0); }
    else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) { for (const n of Object.keys(b)) if (a[n] === undefined || a[n] === null) a[n] = b[n]; }
    else if (a === undefined || a === null || a === '' || a === false) { if (b !== undefined && b !== null) destino[k] = b; }
  }
}

// Declara que todos estos ids (lid, numero, jid...) son la MISMA persona. Junta sus carteras en una sola.
// Devuelve la llave unica. Cambia db en memoria: quien llama decide cuando guardarDB.
function unirIdentidad(db, ids) {
  if (!db) return null;
  const lista = [].concat(ids).filter((x) => x && typeof x === 'string' && x.includes('@') && !x.endsWith('@g.us'));
  const nums = [...new Set(lista.map(numeroDe).filter(Boolean))];
  if (!nums.length) return null;
  if (!db.usuarios) db.usuarios = {};
  if (!db.alias_economia) db.alias_economia = {};
  const alias = db.alias_economia;
  const pn = lista.find((x) => x.endsWith('@s.whatsapp.net'));
  // Llave: numero real si se conoce; si no, la que ya estaba asignada; si no, el primer id (un @lid)
  let canon = pn ? `${numeroDe(pn)}@s.whatsapp.net` : (nums.map((n) => alias[n]).find(Boolean) || lista[0]);
  // Si ya existia otra llave para alguno de estos numeros, tambien se junta
  const viejas = new Set(nums.map((n) => alias[n]).filter((x) => x && x !== canon));
  for (const k of Object.keys(db.usuarios)) if (nums.includes(numeroDe(k)) && k !== canon) viejas.add(k);
  let cambio = false;
  for (const k of viejas) {
    if (db.usuarios[k]) {
      if (!db.usuarios[canon]) db.usuarios[canon] = db.usuarios[k];
      else fusionar(db.usuarios[canon], db.usuarios[k]);
      delete db.usuarios[k];
      cambio = true;
    }
    // quien apuntaba a la llave vieja apunta a la nueva
    for (const n of Object.keys(alias)) if (alias[n] === k) { alias[n] = canon; cambio = true; }
  }
  for (const n of nums) if (alias[n] !== canon) { alias[n] = canon; cambio = true; }
  if (db.registroIndice) for (const n of Object.keys(db.registroIndice)) if (viejas.has(db.registroIndice[n])) db.registroIndice[n] = canon;
  return canon;
}

function getUsuario(db, id) {
  id = claveCanonica(db, id);
  const base = {
    warns: 0, muteado: false, saldo: 0, banco: 0, lastTrabajo: 0, lastDiario: 0,
    vida: 100, lastCrimen: 0, lastRobar: 0, lastMinar: 0, lastCazar: 0,
    waifus: [], lastRoll: 0, pareja: null, nombre: null, tresRayaVictorias: 0, tresRayaPuntos: 0
  };
  if (!db.usuarios[id]) {
    db.usuarios[id] = { ...base };
  } else {
    db.usuarios[id] = { ...base, ...db.usuarios[id] };
  }
  return db.usuarios[id];
}

function getGrupo(db, id) {
  const base = {
    bienvenida: true,
    despedida: true,
    antilink: false,
    usarDescripcion: true,
    soloAdmins: false,
    nsfw: false,
    simonAutomatico: true,
    vozUnica: [],
    prefix: null,
    permisosCategorias: {},
    textoBienvenida: 'Bienvenido/a {user} al grupo {group}! 🎉',
    textoDespedida: '{user} salio del grupo. Hasta luego! 👋'
  };
  if (!db.grupos[id]) {
    db.grupos[id] = { ...base };
  } else {
    db.grupos[id] = { ...base, ...db.grupos[id] };
  }
  return db.grupos[id];
}

// Normaliza grupo.vozUnica a un arreglo, sin importar si en disco quedo guardado
// en el formato viejo (un solo numero como texto) o el nuevo (arreglo de numeros).
function listaVozUnica(grupo) {
  if (!grupo.vozUnica) return [];
  return Array.isArray(grupo.vozUnica) ? grupo.vozUnica : [grupo.vozUnica];
}

module.exports = { leerDB, guardarDB, getUsuario, claveCanonica, unirIdentidad, getGrupo, listaVozUnica };
