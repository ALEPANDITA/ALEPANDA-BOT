// Arquetipos genericos de anime (sin nombres de personajes con copyright).
// Cada uno trae imagenes reales y aleatorias desde nekos.best al momento de tirar.
const ARQUETIPOS = {
  comun:      { nombre: 'Neko Callejera',    categoriaApi: 'neko',     emoji: '🐾' },
  rara:       { nombre: 'Waifu Misteriosa',  categoriaApi: 'waifu',    emoji: '🌸' },
  epica:      { nombre: 'Husbando Elegante', categoriaApi: 'husbando', emoji: '⚔️' },
  legendaria: { nombre: 'Kitsune Ancestral', categoriaApi: 'kitsune',  emoji: '🦊' }
};

const PROBABILIDADES = [
  { rareza: 'legendaria', peso: 3 },
  { rareza: 'epica', peso: 12 },
  { rareza: 'rara', peso: 25 },
  { rareza: 'comun', peso: 60 }
];

function elegirRareza() {
  const total = PROBABILIDADES.reduce((sum, p) => sum + p.peso, 0);
  let random = Math.random() * total;
  for (const p of PROBABILIDADES) {
    if (random < p.peso) return p.rareza;
    random -= p.peso;
  }
  return 'comun';
}

function tirarGachaAnime() {
  const rareza = elegirRareza();
  return { ...ARQUETIPOS[rareza], rareza };
}

function buscarArquetipo(nombre) {
  const buscado = String(nombre || '').trim().toLowerCase();
  for (const [rareza, a] of Object.entries(ARQUETIPOS)) {
    if (a.nombre.toLowerCase() === buscado) return { ...a, rareza };
  }
  return null;
}

const EMOJI_RAREZA = {
  comun: '⚪',
  rara: '🔵',
  epica: '🟣',
  legendaria: '🟡'
};

module.exports = { tirarGachaAnime, ARQUETIPOS, EMOJI_RAREZA, buscarArquetipo };
