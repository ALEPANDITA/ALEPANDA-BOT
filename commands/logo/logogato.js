// LOGOGATO: 6 gatitos (hoja en assets/gato/hoja.png, 3 columnas x 2 filas). Igual que .logokoala:
// GPT-4 diseña las letras al azar y el bot las pone en el letrero / nube / corazon del gato.
//   .logogato <texto>   .logogato 3 <texto> (del 1 al 6)   .logogatovideo <texto>
// Gatos: 1 negro con ovalo morado · 2 naranja con madera · 3 blanco con nube · 4 gamer neon · 5 calico con corona y corazon · 6 siames dormido
// Si falta la imagen: responde a la hoja de gatos con  .guardarhoja gato
const { crearComandosLogo } = require('../../lib/logoletras');

// caja = donde va el texto, en pixeles de un gato de 512x512: centro (cx, cy), ancho w y alto h
module.exports = crearComandosLogo({
  name: 'logogato',
  aliases: ['gatologo'],
  videoName: 'logogatovideo',
  videoAliases: ['gatovideo'],
  carpeta: 'gato',
  etiqueta: 'gato',
  emoji: '🐱',
  ejemplo: 'Michi',
  cols: 3,
  filas: 2,
  fondo: '#ffffff',
  plantillas: [
    { nombre: 'negro ovalo', caja: { cx: 272, cy: 392, w: 190, h: 56 } },
    { nombre: 'naranja madera', caja: { cx: 262, cy: 395, w: 230, h: 52 } },
    { nombre: 'blanco nube', caja: { cx: 258, cy: 400, w: 270, h: 62 } },
    { nombre: 'gamer neon', caja: { cx: 215, cy: 372, w: 320, h: 56 } },
    { nombre: 'calico corazon', caja: { cx: 262, cy: 388, w: 230, h: 70 } },
    { nombre: 'siames pergamino', caja: { cx: 258, cy: 365, w: 280, h: 58 } }
  ]
});
