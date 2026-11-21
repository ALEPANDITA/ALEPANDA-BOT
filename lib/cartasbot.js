'use strict';
// Logica compartida del gacha anime: precios del bot, inventario del bot y sobres de cartas.
const { ARQUETIPOS, tirarGachaAnime } = require('./gachaanime');

const PRECIO_SOBRE = 250;                       // lo que cuesta un sobre de 5 cartas
const CARTAS_POR_SOBRE = 5;
const COOLDOWN_SOBRE_MS = 30 * 60 * 1000;       // espera entre sobres
const TIEMPO_RECLAMO_SOBRE_MS = 15 * 60 * 1000; // tiempo para dar .claim al sobre
// El bot compra barato y vende mas caro: ir y venir nunca deja ganancia
const COMPRA_BOT = { comun: 10, rara: 40, epica: 120, legendaria: 400 };
const MULT_VENTA_BOT = 3;
const MAX_STOCK_BOT = 300;                      // maximo de cartas que guarda el bot (las mas viejas se descartan)
const ORDEN = { legendaria: 0, epica: 1, rara: 2, comun: 3 };
const NOMBRE_RAREZA = { legendaria: 'Legendaria', epica: 'Épica', rara: 'Rara', comun: 'Común' };

const precioCompraBot = (rareza) => COMPRA_BOT[rareza] || 10;
const precioVentaBot = (rareza) => precioCompraBot(rareza) * MULT_VENTA_BOT;
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Busca una carta por nombre sin importar mayusculas/acentos; acepta nombres parciales ("neko", "kitsune")
function buscarCarta(texto) {
  const q = norm(texto);
  if (!q) return null;
  const todas = Object.entries(ARQUETIPOS).map(([rareza, a]) => ({ ...a, rareza }));
  const exacta = todas.find((a) => norm(a.nombre) === q);
  if (exacta) return exacta;
  const parciales = todas.filter((a) => norm(a.nombre).includes(q));
  if (parciales.length === 1) return parciales[0];
  if (parciales.length > 1) return { ambiguo: parciales.map((a) => a.nombre) };
  return null;
}

function stockBot(db) {
  if (!db.mercadoAnime) db.mercadoAnime = { ventas: {}, subastas: {} };
  if (!db.mercadoAnime.bot) db.mercadoAnime.bot = { stock: [] };
  if (!Array.isArray(db.mercadoAnime.bot.stock)) db.mercadoAnime.bot.stock = [];
  return db.mercadoAnime.bot.stock;
}

function nuevoIdBot(stock) {
  let id;
  do { id = Math.floor(Math.random() * 46656).toString(36).padStart(3, '0'); } while (stock.some((c) => c.id === id));
  return id;
}

// El bot se queda con las cartas que le venden
function agregarAlBot(db, carta, cantidad, imagen) {
  const stock = stockBot(db);
  for (let k = 0; k < cantidad; k++) {
    stock.push({ id: nuevoIdBot(stock), nombre: carta.nombre, rareza: carta.rareza, emoji: carta.emoji, imagen: imagen || '', desde: Date.now() });
  }
  while (stock.length > MAX_STOCK_BOT) stock.shift();
}

// Sobre: 5 cartas; garantiza al menos una Rara o mejor
function armarSobre() {
  const cartas = Array.from({ length: CARTAS_POR_SOBRE }, () => tirarGachaAnime());
  if (!cartas.some((c) => c.rareza !== 'comun')) cartas[cartas.length - 1] = { ...ARQUETIPOS.rara, rareza: 'rara' };
  return cartas;
}

module.exports = {
  PRECIO_SOBRE, CARTAS_POR_SOBRE, COOLDOWN_SOBRE_MS, TIEMPO_RECLAMO_SOBRE_MS, COMPRA_BOT, ORDEN, NOMBRE_RAREZA,
  precioCompraBot, precioVentaBot, buscarCarta, stockBot, agregarAlBot, armarSobre
};
