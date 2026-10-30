// Imagen/video del .menu.
// - Dentro de un grupo, .setmenuimg / .setmenuvideo solo cambian el menu de ESE grupo
//   (se guarda en assets/menu-grupos/<grupo>.jpg|.mp4).
// - En privado cambian el menu general (assets/menu.jpg|.mp4), que usan los chats y
//   los grupos que no tengan uno propio.
// - Orden al mostrar el menu: video del grupo > imagen del grupo > video general > imagen general.
// - Lo ultimo que se pone en un lugar manda: poner una imagen quita el video de ese mismo lugar, y viceversa.

const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const DIR_GRUPOS = path.join(ASSETS, 'menu-grupos');
const GENERAL = { img: path.join(ASSETS, 'menu.jpg'), vid: path.join(ASSETS, 'menu.mp4') };

function esGrupo(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function rutasDe(jid) {
  if (!esGrupo(jid)) return { ...GENERAL, deGrupo: false };
  const base = jid.replace(/[^0-9A-Za-z-]/g, '_');
  return { img: path.join(DIR_GRUPOS, `${base}.jpg`), vid: path.join(DIR_GRUPOS, `${base}.mp4`), deGrupo: true };
}

// Ruta del archivo que debe mostrar el menu en este chat, o null si no hay ninguno
function rutaParaMenu(jid) {
  const g = rutasDe(jid);
  const candidatas = g.deGrupo ? [g.vid, g.img, GENERAL.vid, GENERAL.img] : [GENERAL.vid, GENERAL.img];
  return candidatas.find((r) => fs.existsSync(r)) || null;
}

function esVideo(ruta) {
  return ruta === GENERAL.vid || ruta.endsWith('.mp4');
}

// tipo: 'img' | 'vid'. Guarda el archivo en el lugar de este chat y quita el otro tipo de ese mismo lugar.
function guardarMenu(jid, tipo, buffer) {
  const r = rutasDe(jid);
  if (r.deGrupo) fs.mkdirSync(DIR_GRUPOS, { recursive: true });
  fs.writeFileSync(r[tipo], buffer);
  const otro = tipo === 'img' ? 'vid' : 'img';
  if (fs.existsSync(r[otro])) fs.unlinkSync(r[otro]);
  return r.deGrupo;
}

// Borra el archivo de este lugar (grupo o general). Devuelve true si habia algo que borrar.
function borrarMenu(jid, tipo) {
  const r = rutasDe(jid);
  if (!fs.existsSync(r[tipo])) return { borrado: false, deGrupo: r.deGrupo };
  fs.unlinkSync(r[tipo]);
  return { borrado: true, deGrupo: r.deGrupo };
}

module.exports = { rutaParaMenu, esVideo, guardarMenu, borrarMenu, esGrupo };
