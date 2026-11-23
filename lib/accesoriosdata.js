// Catalogo de accesorios de perfil. Precios de $1,000 a $100,000,000.
// Cada accesorio ocupa UN espacio (slot) fijo del perfil: solo puedes llevar uno por espacio,
// y en el perfil siempre salen en el mismo orden (el de SLOTS), asi nada se mueve ni cambia de tamano.
// Para agregar accesorios nuevos: anadelos AL FINAL (asi los numeros de la tienda no cambian).

const SLOTS = [
  { id: 'cabeza',  etiqueta: '👑 Cabeza' },
  { id: 'cara',    etiqueta: '😎 Cara' },
  { id: 'cuello',  etiqueta: '📿 Cuello' },
  { id: 'mano',    etiqueta: '🪄 Mano' },
  { id: 'mascota', etiqueta: '🐾 Mascota' },
  { id: 'aura',    etiqueta: '🌈 Aura' },
  { id: 'titulo',  etiqueta: '🏷️ Titulo' }
];

const ACCESORIOS = [
  // ---- CABEZA ----
  { id: 'gorrito_bambu',   slot: 'cabeza', emoji: '🎋', nombre: 'Gorrito de bambu',          precio: 1000 },
  { id: 'diadema_flores',  slot: 'cabeza', emoji: '🌸', nombre: 'Diadema de flores',         precio: 12000 },
  { id: 'gorro_panda',     slot: 'cabeza', emoji: '🐼', nombre: 'Gorro de panda',            precio: 45000 },
  { id: 'sombrero_mago',   slot: 'cabeza', emoji: '🧙', nombre: 'Sombrero de mago',          precio: 250000 },
  { id: 'casco_astro',     slot: 'cabeza', emoji: '🧑‍🚀', nombre: 'Casco de astronauta',     precio: 3000000 },
  { id: 'corona_oro',      slot: 'cabeza', emoji: '👑', nombre: 'Corona de oro macizo',      precio: 25000000 },
  { id: 'corona_emperador',slot: 'cabeza', emoji: '🔱', nombre: 'Corona del Emperador Panda', precio: 100000000 },
  // ---- CARA ----
  { id: 'lentes_sol',      slot: 'cara', emoji: '😎', nombre: 'Lentes de sol',               precio: 2000 },
  { id: 'bigote',          slot: 'cara', emoji: '🥸', nombre: 'Bigote de caballero',         precio: 6000 },
  { id: 'antifaz_zorro',   slot: 'cara', emoji: '🦊', nombre: 'Antifaz de zorro',            precio: 80000 },
  { id: 'monoculo_oro',    slot: 'cara', emoji: '🧐', nombre: 'Monoculo de oro',             precio: 1200000 },
  { id: 'mascara_dragon',  slot: 'cara', emoji: '🐲', nombre: 'Mascara de dragon',           precio: 18000000 },
  // ---- CUELLO ----
  { id: 'collar_cuentas',  slot: 'cuello', emoji: '📿', nombre: 'Collar de cuentas',         precio: 3000 },
  { id: 'bufanda_roja',    slot: 'cuello', emoji: '🧣', nombre: 'Bufanda roja',              precio: 15000 },
  { id: 'medalla_campeon', slot: 'cuello', emoji: '🥇', nombre: 'Medalla de campeon',        precio: 400000 },
  { id: 'collar_perlas',   slot: 'cuello', emoji: '🦪', nombre: 'Collar de perlas',          precio: 2000000 },
  { id: 'colgante_diamante', slot: 'cuello', emoji: '💎', nombre: 'Colgante de diamante',    precio: 40000000 },
  // ---- MANO ----
  { id: 'paleta_helado',   slot: 'mano', emoji: '🍦', nombre: 'Helado eterno',               precio: 1500 },
  { id: 'abanico',         slot: 'mano', emoji: '🪭', nombre: 'Abanico de seda',             precio: 20000 },
  { id: 'espada_bambu',    slot: 'mano', emoji: '⚔️', nombre: 'Espada de bambu',             precio: 100000 },
  { id: 'varita_estrellas',slot: 'mano', emoji: '🪄', nombre: 'Varita de estrellas',         precio: 900000 },
  { id: 'baston_oro',      slot: 'mano', emoji: '🦯', nombre: 'Baston de oro',               precio: 8000000 },
  { id: 'cetro_rey',       slot: 'mano', emoji: '🔮', nombre: 'Cetro del Rey Panda',         precio: 60000000 },
  // ---- MASCOTA ----
  { id: 'pollito',         slot: 'mascota', emoji: '🐥', nombre: 'Pollito saltarin',         precio: 5000 },
  { id: 'gatito',          slot: 'mascota', emoji: '🐱', nombre: 'Gatito travieso',          precio: 30000 },
  { id: 'zorrito',         slot: 'mascota', emoji: '🦊', nombre: 'Zorrito de nieve',         precio: 500000 },
  { id: 'dragon_bebe',     slot: 'mascota', emoji: '🐉', nombre: 'Dragon bebe',              precio: 5000000 },
  { id: 'fenix',           slot: 'mascota', emoji: '🔥', nombre: 'Fenix inmortal',           precio: 70000000 },
  // ---- AURA ----
  { id: 'brillitos',       slot: 'aura', emoji: '✨', nombre: 'Lluvia de brillitos',         precio: 10000 },
  { id: 'aura_fuego',      slot: 'aura', emoji: '🔥', nombre: 'Aura ignea',                  precio: 700000 },
  { id: 'aura_rayos',      slot: 'aura', emoji: '⚡', nombre: 'Aura de rayos',               precio: 6000000 },
  { id: 'aura_galaxia',    slot: 'aura', emoji: '🌌', nombre: 'Aura galactica',              precio: 35000000 },
  // ---- TITULO ----
  { id: 'titulo_novato',   slot: 'titulo', emoji: '🐾', nombre: 'Panda Novato',              precio: 2500 },
  { id: 'titulo_cazador',  slot: 'titulo', emoji: '🎋', nombre: 'Cazador de Bambu',          precio: 50000 },
  { id: 'titulo_leyenda',  slot: 'titulo', emoji: '🌟', nombre: 'Leyenda Viviente',          precio: 5000000 },
  { id: 'titulo_rey',      slot: 'titulo', emoji: '🏆', nombre: 'Rey del Bambu',             precio: 90000000 }
];

module.exports = { SLOTS, ACCESORIOS };
