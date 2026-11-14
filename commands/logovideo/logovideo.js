const { crearComandoLogo } = require('../../lib/logos-comando');

// Logos en VIDEO / animados (efectos de ephoto360 que solo piden texto). Funcionan igual que los logos de imagen:
//   .logovideo Panda      -> un diseño al azar      .logovideo 2 Panda -> el diseño 2
// En los de intro/giro, el animal o simbolo del logo (toro, dragon, aguila, leon, tigre...) sale al azar.
// Solo se usan efectos que NO piden subir una foto; para sumar otro: agregar su URL a "efectos".
const E = (slug) => `https://en.ephoto360.com/${slug}.html`;

const VIDEOS = [
  {
    name: 'logovideo',
    description: 'Crea un logo en VIDEO estilo intro (1 intro con animal, 2 logo giratorio elegante, 3 rayos PUBG, 4 tigre digital con sonido)',
    efectos: [
      E('free-logo-intro-video-maker-online-558'),
      E('create-elegant-rotation-logo-online-586'),
      E('lightning-pubg-video-logo-maker-online-615'),
      E('create-digital-tiger-logo-video-effect-723')
    ]
  },
  {
    name: 'logooso',
    description: 'Crea una animación divertida de un oso viajero con tu texto',
    efectos: [E('create-funny-animations-of-a-traveling-bear-701')]
  }
];

module.exports = VIDEOS.map((v) => crearComandoLogo(v, { video: true }));
module.exports.VIDEOS = VIDEOS;
