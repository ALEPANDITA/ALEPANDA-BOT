// lib/traslado.js
// Traspasa TODO lo de una persona (cartera, negocios, accesorios, perfil, gacha, xp, pareja/hijos...) a otro numero.
// Pensado para cuando alguien cambia de numero. Trabaja sobre `db` en memoria; quien llama decide cuando guardarDB.
const { unirIdentidad } = require('./db');

const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];
const esJid = (s) => typeof s === 'string' && /^\d+(:\d+)?@(s\.whatsapp\.net|lid)$/.test(s);
const esObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const num = (x) => Number(x) || 0;
const SUMAR = new Set(['saldo', 'banco']);

// Mezcla `extra` (lo que ya tenia el destino) dentro de `base` (copia del origen). Lo del ORIGEN manda;
// el dinero se suma, las listas se juntan y los contadores tipo {a:1,b:2} se suman.
function mezclar(base, extra) {
  for (const k of Object.keys(extra)) {
    const a = base[k]; const b = extra[k];
    if (SUMAR.has(k)) base[k] = num(a) + num(b);
    else if (a === undefined || a === null || a === '' || a === false) { if (b !== undefined && b !== null) base[k] = b; }
    else if (typeof a === 'number' && typeof b === 'number') { if (a === 0) base[k] = b; }
    else if (Array.isArray(a) && Array.isArray(b)) { const vistos = new Set(a.map((x) => JSON.stringify(x))); for (const x of b) if (!vistos.has(JSON.stringify(x))) a.push(x); }
    else if (esObj(a) && esObj(b)) {
      const va = Object.values(a); const vb = Object.values(b);
      const contadores = va.length && vb.length && va.every((v) => typeof v === 'number') && vb.every((v) => typeof v === 'number');
      if (contadores) for (const n of Object.keys(b)) a[n] = num(a[n]) + num(b[n]);
      else mezclar(a, b);
    }
  }
}

// Reemplaza (dentro de cualquier objeto) los ids de la persona vieja por la llave nueva
function reemplazarIds(obj, nums, nueva, prof = 0) {
  if (!obj || typeof obj !== 'object' || prof > 8) return 0;
  let n = 0;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (esJid(v)) { if (nums.has(numeroDe(v)) && v !== nueva) { obj[k] = nueva; n++; } }
    else if (v && typeof v === 'object') n += reemplazarIds(v, nums, nueva, prof + 1);
  }
  return n;
}

// Todos los numeros/lids conocidos de una persona: su llave + todo lo que apunta a ella en alias_economia
function numerosDe(db, llave, extra = []) {
  const nums = new Set([numeroDe(llave), ...extra.map(numeroDe)].filter(Boolean));
  for (const [n, k] of Object.entries(db.alias_economia || {})) if (k === llave) nums.add(n);
  return nums;
}

function resumen(u) {
  return {
    saldo: num(u.saldo), banco: num(u.banco),
    negocios: Array.isArray(u.negocios) ? u.negocios.length : 0,
    accesorios: Array.isArray(u.accesorios) ? u.accesorios.length : 0,
    personajes: (Array.isArray(u.waifus) ? u.waifus.length : 0) + Object.keys(u.gachaAnime || {}).length,
    xp: num(u.xp),
    pareja: u.pareja || null,
    hijos: Array.isArray(u.hijos) ? u.hijos.length : 0,
  };
}

// idsOrigen / idsDestino: todos los ids conocidos de cada persona (mencion, ficha del grupo, numero real...)
function trasladar(db, idsOrigen, idsDestino) {
  const o = [].concat(idsOrigen).filter(Boolean); const d = [].concat(idsDestino).filter(Boolean);
  const llaveO = unirIdentidad(db, o); const llaveD = unirIdentidad(db, d);
  if (!llaveO || !llaveD) return { error: 'ids' };
  if (numeroDe(llaveO) === numeroDe(llaveD) || llaveO === llaveD) return { error: 'mismo' };
  const origen = db.usuarios[llaveO];
  if (!origen) return { error: 'sinDatos' };
  const antes = resumen(origen);

  const numsO = numerosDe(db, llaveO, o.map(numeroDe));
  const numsD = numerosDe(db, llaveD, d.map(numeroDe));
  const viejoDestino = db.usuarios[llaveD] ? JSON.parse(JSON.stringify(db.usuarios[llaveD])) : null;
  if (origen.pareja && numeroDe(origen.pareja) && numsD.has(numeroDe(origen.pareja))) return { error: 'casados' };
  if (viejoDestino && viejoDestino.pareja && numsO.has(numeroDe(viejoDestino.pareja))) return { error: 'casados' };

  // 1) el destino pasa a ser una copia exacta del origen (+ lo que ya tenia, sumado)
  const nuevo = JSON.parse(JSON.stringify(origen));
  if (viejoDestino) mezclar(nuevo, viejoDestino);
  db.usuarios[llaveD] = nuevo;
  delete db.usuarios[llaveO];

  // 2) quien apuntaba al origen (pareja, hijos, padres, subastas, propiedades unicas...) ahora apunta al destino
  let referencias = 0;
  referencias += reemplazarIds(db.usuarios, numsO, llaveD);
  for (const clave of ['propiedadesUnicas', 'subasta', 'mercadoAnime', 'mascotas']) if (db[clave]) referencias += reemplazarIds(db[clave], numsO, llaveD);
  for (const m of Object.values(db.mascotas || {})) if (Array.isArray(m.duenos)) m.duenos = [...new Set(m.duenos)]; // MASCOTAS-TRASLADO
  for (const g of Object.values(db.grupos || {})) {
    for (const campo of ['mensajes', 'actividad', 'muteados']) {
      const mapa = g && g[campo]; if (!esObj(mapa)) continue;
      for (const k of Object.keys(mapa)) {
        if (!numsO.has(numeroDe(k))) continue;
        const v = mapa[k]; delete mapa[k];
        const kd = Object.keys(mapa).find((x) => numsD.has(numeroDe(x))) || llaveD;
        if (typeof v === 'number' && typeof mapa[kd] === 'number') mapa[kd] = campo === 'mensajes' ? mapa[kd] + v : Math.max(mapa[kd], v);
        else if (mapa[kd] === undefined) mapa[kd] = v;
      }
    }
  }

  // 3) el numero viejo queda sin registro (empieza de cero si vuelve a usarse)
  if (db.registroIndice) for (const n of Object.keys(db.registroIndice)) if (numsO.has(n)) delete db.registroIndice[n];
  if (db.registroIndice) for (const n of numsD) db.registroIndice[n] = llaveD;

  return { ok: true, llaveO, llaveD, antes, despues: resumen(db.usuarios[llaveD]), referencias, huboDestino: !!viejoDestino };
}

module.exports = { trasladar, mezclar, resumen, numeroDe };

// MASCOTAS-TRASLADO
