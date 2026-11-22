// Negocios de la economía (.negocio y .recolectar). Cada negocio que compras gana dinero SOLO mientras no estás;
// se junta hasta 24 horas y se cobra con .recolectar.
//
// En la ficha del usuario se guarda:
//   negocios: ['tacos', ...]      los que tiene
//   negocioCobro: ms              desde cuándo se está juntando lo que ganan
//   negocioPendiente: número      lo ya juntado antes de comprar otro negocio (para no perderlo)

const NEGOCIOS = [
  { id: 'tacos', emoji: '🌮', nombre: 'Puesto de tacos', precio: 1500, hora: 50 },
  { id: 'cafeteria', emoji: '☕', nombre: 'Cafetería', precio: 6000, hora: 210 },
  { id: 'gimnasio', emoji: '🏋️', nombre: 'Gimnasio', precio: 15000, hora: 560 },
  { id: 'gasolinera', emoji: '⛽', nombre: 'Gasolinera', precio: 40000, hora: 1550 },
  { id: 'hotel', emoji: '🏨', nombre: 'Hotel', precio: 100000, hora: 4100 }
];
const MAX_HORAS = 24;

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const propios = (u) => (Array.isArray(u.negocios) ? u.negocios.filter((id) => NEGOCIOS.some((n) => n.id === id)) : []);
const ingresoPorHora = (u) => propios(u).reduce((suma, id) => suma + NEGOCIOS.find((n) => n.id === id).hora, 0);

// Lo que hay por cobrar ahora mismo
function porCobrar(u, ahora = Date.now()) {
  const desde = Number(u.negocioCobro) || ahora;
  const horas = Math.min(MAX_HORAS, Math.max(0, (ahora - desde) / 3600000));
  return Math.floor((Number(u.negocioPendiente) || 0) + horas * ingresoPorHora(u));
}

// "2", "cafeteria", "tacos"... -> el negocio (o null)
function buscarNegocio(texto) {
  const t = sinAcentos(texto);
  if (!t) return null;
  if (/^\d+$/.test(t)) return NEGOCIOS[Number(t) - 1] || null;
  return NEGOCIOS.find((n) => n.id === t || sinAcentos(n.nombre) === t) || NEGOCIOS.find((n) => sinAcentos(n.nombre).includes(t)) || null;
}

module.exports = { NEGOCIOS, MAX_HORAS, propios, ingresoPorHora, porCobrar, buscarNegocio };
