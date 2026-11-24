// Ayudas compartidas por los comandos de regalos y accesorios de perfil.
const { REGALOS } = require('./regalosdata');
const { SLOTS, ACCESORIOS, MAX_PUESTOS } = require('./accesoriosdata');

function dinero(n) {
  return '$' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function norm(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Texto despues del nombre del comando: ".regalar 5" -> "5"
function argumentosDe(texto, prefix) {
  return String(texto || '').slice(prefix.length).trim().split(/\s+/).slice(1).join(' ').trim();
}

// Busca por numero de la lista (1, 2, 3...) o por nombre/id (aunque sea parcial).
// Devuelve { item } o { error: 'vacio'|'no_existe'|'varios', opciones? }
function buscar(lista, consulta) {
  const q = norm(consulta);
  if (!q) return { error: 'vacio' };
  if (/^\d+$/.test(q)) {
    const item = lista[parseInt(q, 10) - 1];
    return item ? { item } : { error: 'no_existe' };
  }
  const exacto = lista.find(i => norm(i.nombre) === q || norm(i.id) === q);
  if (exacto) return { item: exacto };
  const parecidos = lista.filter(i => norm(i.nombre).includes(q) || norm(i.id).includes(q));
  if (parecidos.length === 1) return { item: parecidos[0] };
  if (parecidos.length > 1) return { error: 'varios', opciones: parecidos.slice(0, 6) };
  return { error: 'no_existe' };
}

// Cobra de "saldo" (dinero en mano). Devuelve true si pudo cobrar.
function cobrar(usuario, monto) {
  if ((usuario.saldo || 0) < monto) return false;
  usuario.saldo -= monto;
  return true;
}

// Prepara los campos de accesorios en el usuario (si todavia no los tiene)
function datosAccesorios(usuario) {
  if (!Array.isArray(usuario.accesorios)) usuario.accesorios = [];
  if (!usuario.accEquipados || typeof usuario.accEquipados !== 'object') usuario.accEquipados = {};
  return usuario;
}

function accesorioPorId(id) {
  return ACCESORIOS.find(a => a.id === id) || null;
}

// Bloque que se AGREGA al final del .perfil. Si no llevas nada puesto devuelve '' y el perfil queda
// exactamente igual que siempre. Los espacios salen siempre en el mismo orden, nunca cambian de lugar.
function bloqueAccesorios(usuario) {
  const equipados = (usuario && usuario.accEquipados) || {};
  const lineas = [];
  for (const slot of SLOTS) {
    const acc = accesorioPorId(equipados[slot.id]);
    if (acc && acc.slot === slot.id && (usuario.accesorios || []).includes(acc.id)) {
      lineas.push(`${slot.etiqueta}: ${acc.emoji} ${acc.nombre}`);
    }
  }
  if (!lineas.length) return '';
  return `\n\n✨ *ACCESORIOS* ✨\n${lineas.join('\n')}`;
}

// Accesorios que SI llevas puestos (los que compraste y estan en su espacio), en el orden de los espacios.
function puestosDe(usuario) {
  const eq = (usuario && usuario.accEquipados) || {};
  const tengo = (usuario && usuario.accesorios) || [];
  const lista = [];
  for (const slot of SLOTS) {
    const a = accesorioPorId(eq[slot.id]);
    if (a && a.slot === slot.id && tengo.includes(a.id)) lista.push(a);
  }
  return lista;
}
// Los que se dibujan en la foto (el titulo no cuenta)
const visiblesDe = (usuario) => puestosDe(usuario).filter(a => a.slot !== 'titulo');
const tituloDe = (usuario) => { const a = puestosDe(usuario).find(x => x.slot === 'titulo'); return a ? a.nombre : ''; };

function esperar(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  REGALOS, ACCESORIOS, SLOTS, MAX_PUESTOS, puestosDe, visiblesDe, tituloDe,
  dinero, norm, argumentosDe, buscar, cobrar, datosAccesorios, accesorioPorId, bloqueAccesorios, esperar
};

// ACCESORIOS-FOTO
