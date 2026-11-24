'use strict';
// Qué se ve en el mapa para UNA persona: cada una de las 119 propiedades con su estado (tuya, de tu pareja, sin comprar...).
// Lo usan las imágenes (.mapa 1-4) y el panel interactivo (.mapa). Solo lee datos, no cambia nada.
const N = require('./eco-negocios');

const CAT = Object.fromEntries(N.CATEGORIAS.map((c) => [c.id, c]));
const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

// Estados: 'm' tuya · 'p' de tu pareja · 'l' libre (sin comprar) · 'o' exclusiva que ya tiene dueño · 's' exclusiva en subasta ahora
function estadosMapa(u, db) {
  const inv = N.inventario(u, db), mias = new Map(inv.items.map((e) => [e.n.id, e]));
  const unicas = (db && db.propiedadesUnicas) || {}, activa = db && db.subasta && db.subasta.activa;
  return N.NEGOCIOS.map((n) => {
    const c = CAT[n.cat], e = mias.get(n.id), ex = n.tipo === 'exclusiva';
    const base = { id: n.id, num: n.num, cat: n.cat, colorCat: c.color, nombreCat: c.nombre, color: c.color, exclusiva: ex, maxNivel: n.maxNivel, precio: n.precio };
    if (e) {
      const sig = n.etapas[e.nivel + 1];
      return { ...base, estado: e.mio ? 'm' : 'p', gris: false, pareja: !e.mio, nombre: e.nombre, nivel: e.nivel, hora: e.hora, bono: !!e.bono, sigNombre: sig ? sig.nombre : null, sigCosto: sig ? sig.costo : 0 };
    }
    const estado = ex && activa && activa.id === n.id ? 's' : ex && unicas[n.id] ? 'o' : 'l';
    return { ...base, estado, gris: true, pareja: false, nombre: n.etapas[0].nombre, nivel: 0, hora: n.hora, bono: false, sigNombre: null, sigCosto: 0 };
  });
}

// Datos para el panel (formato corto para que el mensaje pese poco)
function datosPanel(estados, { titulo, prefix = '.', resumen } = {}) {
  return {
    t: titulo, pre: prefix,
    res: resumen || [],
    c: N.CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color })),
    e: estados.map((s) => {
      const r = { i: s.id, u: s.num, c: s.cat, n: s.nombre, m: s.maxNivel, s: s.estado, v: s.nivel, h: s.hora, p: s.precio };
      if (s.exclusiva) r.x = 1;
      if (s.bono) r.b = 1;
      if (s.sigNombre) { r.g = s.sigNombre; r.k = s.sigCosto; }
      return r;
    })
  };
}

module.exports = { estadosMapa, datosPanel, dinero };
