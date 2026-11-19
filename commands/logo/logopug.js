// LOGOPUG: 6 pugs (hoja en assets/pug/hoja.jpg, 3 columnas x 2 filas). Igual que .logogato.
//   .logopug <texto>   .logopug 3 <texto> (del 1 al 6)   .logopugvideo <texto>
// Pugs: 1 aviador madera · 2 negro hueso · 3 chef plato · 4 astronauta neon · 5 flores corazon · 6 dormilon hueso
// Si falta la imagen: responde a la hoja de pugs con  .guardarhoja pug
const { crearComandosLogo } = require('../../lib/logoletras');

module.exports = crearComandosLogo({
  name: 'logopug',
  aliases: ['pugologo', 'logoperro'],
  videoName: 'logopugvideo',
  videoAliases: ['pugvideo', 'logoperrovideo'],
  carpeta: 'pug',
  etiqueta: 'pug',
  emoji: '🐶',
  ejemplo: 'Pugcito',
  cols: 3,
  filas: 2,
  fondo: '#ffffff',
  plantillas: [
    { nombre: 'aviador madera', caja: { cx: 265, cy: 375, w: 250, h: 70 } },
    { nombre: 'negro hueso', caja: { cx: 278, cy: 362, w: 255, h: 66 } },
    { nombre: 'chef plato', caja: { cx: 266, cy: 378, w: 290, h: 68 } },
    { nombre: 'astronauta neon', caja: { cx: 215, cy: 380, w: 320, h: 58 } },
    { nombre: 'flores corazon', caja: { cx: 296, cy: 355, w: 250, h: 64 } },
    { nombre: 'dormilon hueso', caja: { cx: 272, cy: 378, w: 300, h: 56 } }
  ]
});
