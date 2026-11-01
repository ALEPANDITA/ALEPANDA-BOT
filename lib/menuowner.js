// Reparte los comandos entre el menu normal (.menu) y el menu del owner (.menuowner).
//
// Un comando es "de owner" si esta en la categoria 'owner' o si lleva menuOwner: true
// (para los que viven en otra categoria pero solo los puede usar un owner, ej. .unmuteall).
// Esos comandos NO salen en .menu; solo aparecen en .menuowner.

// Secciones del menu owner. Los comandos nuevos que no esten aqui caen solos en "Otros".
const SECCIONES = [
  { emoji: '🧠', titulo: 'COMANDOS Y CODIGO', comandos: ['crearcmd', 'arreglarcmd', 'adaptarcmd', 'repararcmd', 'addcmd', 'delcmd', 'cmd'] },
  { emoji: '🔑', titulo: 'APIS E IA', comandos: ['setapikey', 'delapikey', 'apistatus', 'apistatustest'] },
  { emoji: '🖥️', titulo: 'BOT Y SERVIDOR', comandos: ['restart', 'update', 'subircambios', 'sv', 'exec', 'eval', 'modoprivado'] },
  { emoji: '🤖', titulo: 'SUBBOTS', comandos: ['addsubbot', 'delsubbot', 'listsubbots', 'restartsubbots'] },
  { emoji: '🚫', titulo: 'GRUPOS Y USUARIOS', comandos: ['bloquear', 'desbloquear', 'bloqueados', 'apagar', 'encender', 'unmuteall', 'vozunica', 'verconfesion'] },
  { emoji: '🏅', titulo: 'NIVELES, DINERO Y GACHA', comandos: ['setnivel', 'resetniveles', 'darmoney', 'resetgacha'] },
  { emoji: '👑', titulo: 'OWNERS', comandos: ['owners', 'setowner', 'delowner'] },
  { emoji: '🎨', titulo: 'MENU Y ESTILO', comandos: ['setmenuimg', 'setmenuvideo', 'delmenuimg', 'delmenuvideo', 'emojimenu', 'halloween'] },
  { emoji: '🎵', titulo: 'DESCARGAS Y PELIS', comandos: ['cachemusica', 'limpiarcache', 'pelischeck', 'setpelisgrupo'] }
];

const SECCION_OTROS = { emoji: '🧰', titulo: 'OTROS' };

function esComandoOwner(comando) {
  return comando?.category === 'owner' || comando?.menuOwner === true;
}

// comandos: el Map (nombre/alias -> comando) que recibe execute. Devuelve
// [{ emoji, titulo, lista: [comando, ...] }, ...] sin secciones vacias.
function seccionesOwner(comandos) {
  const unicos = new Map(); // nombre -> comando (el Map trae un comando por cada alias)
  for (const c of comandos.values()) {
    if (!esComandoOwner(c) || c.name === 'menuowner') continue;
    if (!unicos.has(c.name)) unicos.set(c.name, c);
  }

  const secciones = SECCIONES.map((s) => ({ emoji: s.emoji, titulo: s.titulo, lista: [] }));
  const otros = { ...SECCION_OTROS, lista: [] };

  for (const c of unicos.values()) {
    const i = SECCIONES.findIndex((s) => s.comandos.includes(c.name));
    (i === -1 ? otros : secciones[i]).lista.push(c);
  }

  // dentro de cada seccion, en el orden en que esta escrita arriba (y los nuevos al final)
  secciones.forEach((sec, i) => {
    const orden = SECCIONES[i].comandos;
    sec.lista.sort((a, b) => orden.indexOf(a.name) - orden.indexOf(b.name));
  });
  otros.lista.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return [...secciones, otros].filter((s) => s.lista.length > 0);
}

module.exports = { esComandoOwner, seccionesOwner };
