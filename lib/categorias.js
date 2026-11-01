// Categorias = carpetas de commands/ (sin las que empiezan con _). Sirve para que
// .repararcmd / .arreglarcmd entiendan "logos", "Logo", "économia", etc.
const fs = require('fs');
const path = require('path');

const CARPETA_COMANDOS = path.join(__dirname, '..', 'commands');

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// logos -> logo, animes -> anime (singular/plural no importa)
const base = (texto) => texto.replace(/s$/, '');

function listarCategorias() {
  return fs.readdirSync(CARPETA_COMANDOS)
    .filter((n) => !n.startsWith('_') && fs.statSync(path.join(CARPETA_COMANDOS, n)).isDirectory())
    .sort();
}

// Devuelve el nombre REAL de la carpeta (ej. "logo") o null. Nunca devuelve algo que no exista en disco.
function resolverCategoria(nombre) {
  const buscado = normalizar(nombre);
  if (!buscado) return null;
  const categorias = listarCategorias().map((c) => [c, normalizar(c)]);
  const exacta = categorias.find(([, n]) => n === buscado);
  if (exacta) return exacta[0];
  const parecida = categorias.find(([, n]) => base(n) === base(buscado));
  return parecida ? parecida[0] : null;
}

module.exports = { resolverCategoria, listarCategorias, CARPETA_COMANDOS };
