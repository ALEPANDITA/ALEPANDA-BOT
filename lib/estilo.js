// Estilo visual centralizado de ALEPANDA BOT.
// Soporta varios "temas" de decoracion distintos que puedes elegir por comando.

const MARCA = 'ALEPANDA BOT';

const TEMAS = {
  clasico: {
    arriba: (t) => t ? `╭━━━〔 🐼 *${t}* 🐼 〕━━━⬣` : '╭━━━━━━━━━━━━━━━━━━━━━━⬣',
    linea: (l) => `┃ ${l}`,
    medio: '┣━━━━━━━━━━━━━━━━━━━━━━⬣',
    abajo: (pie) => [`┃ 🐾 ${pie}`, '╰━━━━━━━━━━━━━━━━━━━━━━⬣']
  },
  neon: {
    arriba: (t) => t ? `⚡『 *${t}* 』⚡` : '⚡━━━━━━━━━━━━━━━━━━━━━⚡',
    linea: (l) => `▸ ${l}`,
    medio: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    abajo: (pie) => [`✦ ${pie} ✦`, '⚡━━━━━━━━━━━━━━━━━━━━━⚡']
  },
  kawaii: {
    arriba: (t) => t ? `♡｡°✩ *${t}* ✩°｡♡` : '｡°✩━━━━━━━━━━━━━━✩°｡',
    linea: (l) => `🌸 ${l}`,
    medio: '˚ ༘ ೀ⋆｡˚ ⋆',
    abajo: (pie) => [`♡ ${pie} ♡`, '｡°✩━━━━━━━━━━━━━━✩°｡']
  },
  gamer: {
    arriba: (t) => t ? `[ ▮▮ *${t}* ▮▮ ]` : '[ ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ ]',
    linea: (l) => `> ${l}`,
    medio: '----------------------',
    abajo: (pie) => [`[SYSTEM] ${pie}`, '[ ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ ]']
  },
  minimal: {
    arriba: (t) => t ? `— ${t} —` : '',
    linea: (l) => l,
    medio: '',
    abajo: (pie) => [`— ${pie} —`]
  }
};

function caja(lineas = [], { titulo, pie = MARCA, estilo = 'clasico' } = {}) {
  const tema = TEMAS[estilo] || TEMAS.clasico;
  const partes = [];

  const encabezado = tema.arriba(titulo);
  if (encabezado) partes.push(encabezado);

  for (const linea of lineas) {
    partes.push(tema.linea(linea));
  }

  if (tema.medio) partes.push(tema.medio);
  partes.push(...tema.abajo(pie));

  return partes.filter(Boolean).join('\n');
}

function temaAleatorio() {
  const claves = Object.keys(TEMAS);
  return claves[Math.floor(Math.random() * claves.length)];
}

const TEMA_POR_CATEGORIA = {
  casino: 'gamer',
  gacha: 'kawaii',
  fun: 'kawaii',
  admin: 'clasico',
  owner: 'neon',
  economia: 'clasico',
  general: 'minimal',
  download: 'clasico',
  perfil: 'kawaii'
};

function porCategoria(categoria) {
  return TEMA_POR_CATEGORIA[categoria] || 'clasico';
}

function exito(mensaje, opciones = {}) {
  return caja([`✅ ${mensaje}`], { titulo: opciones.titulo || 'LISTO', ...opciones });
}

function error(mensaje, opciones = {}) {
  return caja([`❌ ${mensaje}`], { titulo: opciones.titulo || 'ERROR', ...opciones });
}

function info(mensaje, opciones = {}) {
  return caja([`ℹ️ ${mensaje}`], { titulo: opciones.titulo || 'INFO', ...opciones });
}

function cargando(mensaje, opciones = {}) {
  return caja([`⏳ ${mensaje}`], { titulo: opciones.titulo || 'PROCESANDO', ...opciones });
}

function advertencia(mensaje, opciones = {}) {
  return caja([`⚠️ ${mensaje}`], { titulo: opciones.titulo || 'ATENCION', ...opciones });
}

function lista(titulo, items = [], opciones = {}) {
  const lineas = items.map(item => `▸ ${item}`);
  return caja(lineas, { titulo, ...opciones });
}

module.exports = { caja, exito, error, info, cargando, advertencia, lista, temaAleatorio, porCategoria, TEMAS, MARCA };
