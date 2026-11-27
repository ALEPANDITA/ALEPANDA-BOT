// Lógica de .darnegocio y .quitarnegocio (solo owner): regalar o quitar propiedades de la economía, una por una
// o una categoría completa. Las propiedades viven en la ficha del usuario (negocios, negocioNiveles) y las
// exclusivas además en db.propiedadesUnicas (quién es el único dueño). Ver lib/eco-negocios.js.

const { leerConfig } = require('./config');
const { leerDB, guardarDB, getUsuario, claveCanonica, unirIdentidad } = require('./db');
const { esOwnerBot } = require('./permisos');
const { exito, advertencia } = require('./estilo');
const N = require('./eco-negocios');

const ESTILO = 'neon';
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];
const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const lista = (items, max) => {
  const visibles = items.slice(0, max).map((n) => `${n.emoji} ${n.nombre}`);
  return items.length > max ? [...visibles, `… y ${items.length - max} más`] : visibles;
};

// Lo que pidió el owner: { negocio } (número, id o nombre), { categoria } o null si no se entiende.
// Orden: "categoria X" (forzado) → número → nombre exacto de una propiedad → categoría → nombre parecido.
function entender(consulta) {
  const t = N.sinAcentos(consulta);
  if (!t) return null;
  if (['todo', 'todos', 'todas', 'all'].includes(t)) return { todos: true }; // NEGOCIO-TODO
  const forzada = t.match(/^(?:categoria|categorias|zona|cat)\s+(.+)$/);
  if (forzada) { const c = N.buscarCategoria(forzada[1]); return c ? { categoria: c } : null; }
  if (/^\d+$/.test(t)) { const n = N.buscarNegocio(t); return n ? { negocio: n } : null; }
  const exacto = N.NEGOCIOS.find((n) => n.id === t || n.etapas.some((e) => N.sinAcentos(e.nombre) === t));
  if (exacto) return { negocio: exacto };
  const categoria = N.buscarCategoria(t);
  if (categoria) return { categoria };
  const n = N.buscarNegocio(t);
  return n ? { negocio: n } : null;
}

// Regala propiedades (en la ficha "u" de la base "db"). Antes de cambiar nada se "fija" lo ya ganado para que lo que
// juntaban hasta ahora no cambie de golpe. Las exclusivas solo se dan si están libres y no están en subasta.
function dar(db, u, llave, negocios, ahora = Date.now(), maximo = false) { // PARCHE-MAXIMO
  const res = { dados: [], ya: [], ocupadas: [], enSubasta: [], copias: [], mejoradas: [] };
  if (!db.propiedadesUnicas) db.propiedadesUnicas = {};
  const unicas = db.propiedadesUnicas;
  const activa = db.subasta && db.subasta.activa;
  const tiene = new Set(N.propios(u));
  for (const n of negocios) {
    if (tiene.has(n.id)) res.ya.push(n);
    else if (n.tipo === 'exclusiva' && ((activa && activa.id === n.id) || (unicas[n.id] && unicas[n.id] !== llave))) { res.copias.push(n); res.dados.push(n); } // PARCHE-COPIAS: copia, el dueño original no pierde nada
    else res.dados.push(n);
  }
  if (res.dados.length) {
    N.fijar(db, u, ahora);
    u.negocios = [...N.propios(u), ...res.dados.map((n) => n.id)];
    const niveles = { ...(u.negocioNiveles || {}) };
    const esCopia = new Set(res.copias.map((n) => n.id)), copias = new Set(Array.isArray(u.negocioCopias) ? u.negocioCopias : []);
    for (const n of res.dados) { niveles[n.id] = maximo ? n.maxNivel : 0; if (n.tipo === 'exclusiva') { if (esCopia.has(n.id)) copias.add(n.id); else unicas[n.id] = llave; } }
    u.negocioNiveles = niveles;
    u.negocioCopias = [...copias];
  }
  if (maximo) {
    const subir = res.ya.filter((n) => N.nivelDe(u, n.id) < n.maxNivel);
    if (subir.length) {
      if (!res.dados.length) N.fijar(db, u, ahora);
      const nv = { ...(u.negocioNiveles || {}) };
      for (const n of subir) nv[n.id] = n.maxNivel;
      u.negocioNiveles = nv;
      res.mejoradas = subir;
    }
  }
  return res;
}

// Quita propiedades. Las exclusivas quedan libres para otra subasta.
function quitar(db, u, llave, negocios, ahora = Date.now()) {
  const res = { quitados: [], no: [] };
  const unicas = db.propiedadesUnicas || {};
  const tiene = new Set(N.propios(u));
  for (const n of negocios) (tiene.has(n.id) || (n.tipo === 'exclusiva' && unicas[n.id] === llave) ? res.quitados : res.no).push(n);
  if (res.quitados.length) {
    N.fijar(db, u, ahora);
    const ids = new Set(res.quitados.map((n) => n.id));
    u.negocios = N.propios(u).filter((id) => !ids.has(id));
    const niveles = { ...(u.negocioNiveles || {}) };
    for (const n of res.quitados) { delete niveles[n.id]; if (n.tipo === 'exclusiva' && unicas[n.id] === llave) delete unicas[n.id]; }
    u.negocioNiveles = niveles;
    if (Array.isArray(u.negocioCopias)) u.negocioCopias = u.negocioCopias.filter((id) => !ids.has(id));
  }
  return res;
}

// modo: 'dar' | 'quitar'. resolverReceptor es el de darmoney (para guardar en la misma cartera que el dinero).
async function ejecutar(modo, sock, jid, msg, { texto = '', prefix = '.', resolverReceptor }) {
  const comando = modo === 'dar' ? 'darnegocio' : 'quitarnegocio';
  const config = leerConfig();
  if (!(await esOwnerBot(sock, config, msg))) {
    return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: ESTILO }) });
  }

  const info = msg.message?.extendedTextMessage?.contextInfo;
  const objetivo = info?.mentionedJid?.[0] || info?.participant;
  const consulta = String(texto).trim().split(/\s+/).slice(1).filter((p) => !p.startsWith('@')).join(' ');
  const ayuda = (titulo) => sock.sendMessage(jid, {
    text: advertencia([
      `Uso: ${prefix}${comando} <propiedad o categoría> (mencionando o respondiendo a alguien)`,
      `Ej: ${prefix}${comando} tacos  ·  ${prefix}${comando} 12  ·  ${prefix}${comando} comida  ·  ${prefix}${comando} todo`,
      `Categorías: ${N.CATEGORIAS.map((c) => N.sinAcentos(c.id)).join(', ')}`
    ].join('\n'), { titulo, estilo: ESTILO })
  });

  if (!objetivo) return ayuda('FALTA EL USUARIO');
  const pedido = entender(consulta);
  if (!pedido) return ayuda(consulta ? 'NO ENCONTRÉ ESO' : 'FALTA LA PROPIEDAD');
  const negocios = pedido.todos ? N.NEGOCIOS.slice() : pedido.negocio ? [pedido.negocio] : N.NEGOCIOS.filter((n) => n.cat === pedido.categoria.id);
  const que = pedido.todos ? `🌎 TODAS las propiedades (${negocios.length})` : pedido.negocio ? `${pedido.negocio.emoji} ${pedido.negocio.nombre}` : `${pedido.categoria.emoji} categoría ${pedido.categoria.nombre} (${negocios.length})`;

  // El dinero y las propiedades de una persona van en la misma ficha: se busca igual que .darmoney
  const { clave, numeroReal } = await resolverReceptor(sock, jid, objetivo, leerDB());
  const db = leerDB(); // lectura fresca: lo de arriba pudo tardar y otros comandos guardan la base
  unirIdentidad(db, [objetivo, clave, numeroReal && `${numeroReal}@s.whatsapp.net`]);
  const u = getUsuario(db, clave);
  const llave = claveCanonica(db, clave);
  const quien = `@${numeroDe(objetivo)}`;

  const r = modo === 'dar' ? dar(db, u, llave, negocios, Date.now(), !!(pedido.todos || pedido.categoria)) /* PARCHE-MAXIMO-CAT */ : quitar(db, u, llave, negocios);
  guardarDB(db);
  const resumen = N.resumen(u, db);
  const ahora = `📈 Ahora tiene ${resumen.cantidad} propiedad${resumen.cantidad === 1 ? '' : 'es'} y gana ${dinero(resumen.porHora)} por hora`;
  const opciones = (titulo) => ({ titulo, estilo: ESTILO });
  const enviar = (texto_) => sock.sendMessage(jid, { text: texto_, mentions: [objetivo] });

  if (modo === 'dar') {
    const notas = [];
    if (r.ya.length) notas.push(`ℹ️ Ya las tenía: ${r.ya.map((n) => n.nombre).slice(0, 8).join(', ')}${r.ya.length > 8 ? '…' : ''}`);
    if (r.ocupadas.length) notas.push(`🔒 Ya tienen dueño (quítaselas con ${prefix}quitarnegocio): ${r.ocupadas.map((n) => n.nombre).join(', ')}`);
    if (r.enSubasta.length) notas.push(`🔨 Están en subasta ahora: ${r.enSubasta.map((n) => n.nombre).join(', ')}`);
    if (r.copias.length) notas.push(`📄 Copias (el dueño original las conserva): ${r.copias.map((n) => n.nombre).join(', ')}`);
    if (pedido.todos || pedido.categoria) notas.unshift(`🔼 Todas al nivel máximo${r.mejoradas.length ? ` (se mejoraron ${r.mejoradas.length} que ya tenía)` : ''}`);
    if (!r.dados.length && !r.mejoradas.length) return enviar(advertencia([`No se le dio nada a ${quien}:`, que, '', ...notas].join('\n'), opciones('SIN CAMBIOS')));
    return enviar(exito([`Le diste a ${quien}:`, ...lista(r.dados, 25), '', ahora, ...(notas.length ? ['', ...notas] : [])].join('\n'), opciones('PROPIEDADES ENTREGADAS')));
  }

  if (!r.quitados.length) return enviar(advertencia([`${quien} no tiene:`, que].join('\n'), opciones('SIN CAMBIOS')));
  const exclusivas = r.quitados.some((n) => n.tipo === 'exclusiva');
  return enviar(exito([
    `Le quitaste a ${quien}:`, ...lista(r.quitados, 25), '', ahora,
    ...(exclusivas ? ['', '👑 Las exclusivas quedaron libres para otra subasta.'] : [])
  ].join('\n'), opciones('PROPIEDADES QUITADAS')));
}

module.exports = { ejecutar, entender, dar, quitar };
