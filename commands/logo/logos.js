const { crearComandoLogo } = require('../../lib/logos-comando');

// Cada logo es un comando: .logoneon <texto>. "efectos" = paginas de ephoto360 del MISMO tema (la primera es la
// base); en cada uso sale una al azar, o la que se pida con .logoneon 2 <texto>. De 1 a 5 disenos por logo, solo de
// su propio tema y sin repetir ninguno en otro comando. Para agregar mas basta con sumar otro E('slug-del-efecto').
const E = (slug) => `https://en.ephoto360.com/${slug}.html`;

const LOGOS = [
  // ---------- los de siempre (cada uno solo con disenos de su propio tema) ----------
  { name: 'logoalas', description: 'Crea un logo con efecto de alas galácticas y de neón', efectos: [E('the-effect-of-galaxy-angel-wings-289'), E('wings-galaxy-206'), E('neon-devil-wings-text-effect-online-683')] },
  { name: 'logoamongus', description: 'Crea un logo estilo Among Us', efectos: [E('create-a-cover-image-for-the-game-among-us-online-762'), E('create-a-banner-game-among-us-with-your-name-763')] },
  { name: 'logoangel', description: 'Crea un logo con efecto de alas de ángel', efectos: [E('angel-wing-effect-329'), E('wings-text-effect-176')] },
  { name: 'logoarmy', description: 'Crea un logo de estilo militar y FPS gaming', efectos: [E('free-gaming-logo-maker-for-fps-game-team-546'), E('create-call-of-duty-warzone-youtube-banner-online-548'), E('1917-style-text-effect-523'), E('create-valorant-banner-youtube-online-588')] },
  { name: 'logochicagamer', description: 'Crea un logo de mascota gamer', efectos: [E('create-cute-girl-gamer-mascot-logo-online-687'), E('create-a-gaming-mascot-logo-free-560'), E('create-a-circle-mascot-team-logo-483')] },
  { name: 'logochristmas', description: 'Crea un logo con efecto navideño', efectos: [E('christmas-effect-by-name-376'), E('christmas-snow-text-effect-online-631'), E('create-sparkles-3d-christmas-text-effect-online-727'), E('create-a-frozen-christmas-text-effect-online-792'), E('create-a-beautiful-3d-christmas-snow-text-effect-793')] },
  { name: 'logocielo', description: 'Crea un logo con efecto de nubes en el cielo', efectos: [E('create-a-cloud-text-effect-in-the-sky-618'), E('write-text-effect-clouds-in-the-sky-online-619')] },
  { name: 'logocorazon', description: 'Crea un logo con efecto de corazón y linterna', efectos: [E('text-heart-flashlight-188'), E('red-heart-effect-27'), E('double-heart-effect-16')] },
  { name: 'logodragonball', description: 'Crea un logo con efecto de texto estilo Dragon Ball', efectos: [E('create-dragon-ball-style-text-effects-online-809'), E('free-online-dragon-ball-facebook-cover-photos-maker-443')] },
  { name: 'logofuturista', description: 'Crea un logo con efecto de luz tecnológica futurista', efectos: [E('light-text-effect-futuristic-technology-style-648'), E('free-create-a-3d-hologram-text-effect-441'), E('create-a-awesome-logo-sci-fi-effects-492'), E('plasma-text-effects-online-71')] },
  { name: 'logogaming', description: 'Crea un logo de equipo de esports y gaming', efectos: [E('make-team-logo-online-free-432'), E('create-logo-team-logo-gaming-assassin-style-574'), E('create-an-online-team-logo-in-black-and-white-style-689')] },
  { name: 'logogatito', description: 'Crea un logo con texto escrito en vidrio empañado', efectos: [E('handwritten-text-on-foggy-glass-online-680'), E('create-drop-water-on-window-effect-online-746')] },
  { name: 'logoglitch', description: 'Crea un logo con efecto de texto glitch digital', efectos: [E('create-digital-glitch-text-effects-online-767'), E('create-pixel-glitch-text-effect-online-769'), E('tik-tok-text-effects-online-generator-485')] },
  { name: 'logograffiti3d', description: 'Crea un logo con efecto de graffiti', efectos: [E('text-graffiti-3d-208'), E('graffiti-text-3-179'), E('create-a-cartoon-style-graffiti-text-effect-online-668'), E('create-a-graffiti-text-effect-on-the-wall-online-665'), E('graffiti-color-199')] },
  { name: 'logohorror', description: 'Crea un logo con efecto de escritura de sangre y terror', efectos: [E('blood-writing-text-online-77'), E('write-blood-text-on-the-wall-264'), E('writing-horror-text-online-266'), E('writing-horror-letters-on-metal-plates-265'), E('write-your-name-on-horror-cemetery-gate-597')] },
  { name: 'logolol', description: 'Crea un logo estilo League of Legends', efectos: [E('make-your-own-league-of-legends-wallpaper-full-hd-442'), E('create-the-league-of-legends-wallpaper-for-mobile-315'), E('create-youtube-banner-league-of-legends-online-428'), E('generate-banner-game-lol-with-rank-boders-439')] },
  { name: 'logomatrix', description: 'Crea un logo con efecto de código Matrix', efectos: [E('matrix-text-effect-154')] },
  { name: 'logonaruto', description: 'Crea un logo con estilo de texto Naruto Shippuden', efectos: [E('naruto-shippuden-logo-style-text-effect-online-808')] },
  { name: 'logoneon', description: 'Crea un logo con efecto de neón', efectos: [E('create-impressive-neon-glitch-text-effects-online-768'), E('create-colorful-neon-light-text-effects-online-797'), E('neon-text-effect-light-200'), E('neon-text-effect-68')] },
  { name: 'logonube', description: 'Crea un logo con efecto de texto en las nubes', efectos: [E('cloud-text-effect-139'), E('cloud-effect-132'), E('create-realistic-cloud-text-effect-606')] },
  { name: 'logopareja', description: 'Crea un logo con efecto de sombra y luz solar', efectos: [E('sunlight-shadow-text-204'), E('create-sunset-light-text-effects-online-807')] },
  { name: 'logopubg', description: 'Crea un logo estilo PUBG con personaje tierno', efectos: [E('pubg-logo-maker-cute-character-online-617'), E('free-pubg-logo-maker-online-609'), E('colorful-pubg-logo-maker-online-613'), E('black-white-pubg-logo-for-esports-gaming-610')] },
  { name: 'logopubgfem', description: 'Crea un logo mascota PUBG para equipos de esports', efectos: [E('pubg-mascot-logo-maker-for-an-esports-team-612')] },
  { name: 'logosad', description: 'Crea un logo con texto escrito en vidrio mojado', efectos: [E('write-text-on-wet-glass-online-589'), E('foggy-rainy-text-effect-75')] },
  { name: 'logosolitario', description: 'Crea un logo con efecto tipográfico sobre pavimento', efectos: [E('create-typography-text-effect-on-pavement-online-774'), E('road-paint-text-effect-70')] },

  // ---------- logos nuevos ----------
  { name: 'logooro', description: 'Crea un logo con texto dorado de lujo', efectos: [E('create-a-luxury-gold-text-effect-online-594'), E('write-gold-letters-online-285'), E('gold-text-effect-style-272'), E('gold-text-effect-158'), E('beautiful-gold-text-effect-122')] },
  { name: 'logometal', description: 'Crea un logo con texto de metal y cromo 3D', efectos: [E('create-a-3d-shiny-metallic-text-effect-online-685'), E('impressive-decorative-3d-metal-text-effect-798'), E('metal-text-effect-online-new-305'), E('text-metal-3d-277'), E('glossy-chrome-text-effect-online-424')] },
  { name: 'logogalaxia', description: 'Crea un logo con texto de galaxia y espacio', efectos: [E('create-galaxy-style-free-name-logo-438'), E('galaxy-text-effect-new-258'), E('galaxy-text-effect-116'), E('write-galaxy-online-18'), E('making-neon-light-text-effect-with-galaxy-style-521')] },
  { name: 'logoagua', description: 'Crea un logo con texto de agua y bajo el mar', efectos: [E('create-water-effect-text-online-295'), E('water-3d-text-effect-online-126'), E('water-text-effects-online-106'), E('underwater-text-73'), E('3d-underwater-text-effect-online-682')] },
  { name: 'logofuego', description: 'Crea un logo con texto en llamas', efectos: [E('halloween-fire-text-effect-online-369'), E('halloween-fire-text-online-83'), E('dragon-fire-text-effect-111')] },
  { name: 'logonieve', description: 'Crea un logo con texto cubierto de nieve', efectos: [E('create-a-snow-3d-text-effect-free-online-621'), E('snow-on-text-online-107')] },
  { name: 'logocomic', description: 'Crea un logo con texto estilo cómic', efectos: [E('create-online-3d-comic-style-text-effects-817'), E('boom-text-comic-style-text-effect-675')] },
  { name: 'logoheroe', description: 'Crea un logo estilo superhéroes (Marvel, Avengers, Thor, Deadpool, Capitán América)', efectos: [E('create-marvel-s-style-logo-419'), E('create-logo-3d-style-avengers-online-427'), E('create-thor-logo-style-text-effects-online-for-free-796'), E('create-text-effects-in-the-style-of-the-deadpool-logo-818'), E('create-a-cinematic-captain-america-text-effect-online-715')] },
  { name: 'logoblackpink', description: 'Crea un logo estilo BLACKPINK', efectos: [E('create-a-blackpink-style-logo-with-members-signatures-810'), E('create-blackpink-s-born-pink-album-logo-online-779'), E('online-blackpink-style-logo-maker-effect-711'), E('create-blackpink-logo-online-free-607')] },
  { name: 'logoplaya', description: 'Crea un logo con texto escrito en la arena de la playa', efectos: [E('create-3d-text-effect-on-the-beach-online-688'), E('write-in-sand-summer-beach-online-free-595'), E('write-in-sand-summer-beach-online-576')] },
  { name: 'logomadera', description: 'Crea un logo con texto de madera 3D', efectos: [E('create-3d-wood-text-effects-online-free-705'), E('wooden-3d-text-effect-59'), E('3d-wooden-text-effects-online-104'), E('logo-viettel-156')] },
  { name: 'logopastel', description: 'Crea un logo con texto escrito en un pastel', efectos: [E('writing-on-the-cakes-127'), E('text-cake-90'), E('cake-text-effect-online-103'), E('milk-cake-text-effects-102'), E('cake-text-60')] },
  { name: 'logopizarra', description: 'Crea un logo con texto escrito con tiza en el pizarrón', efectos: [E('writing-chalk-on-the-blackboard-61'), E('writing-chalk-on-the-blackboard-30')] },
  { name: 'logomascota', description: 'Crea un logo de mascota para tu equipo o clan', efectos: [E('metal-mascots-logo-maker-486'), E('create-mascot-logo-astronaut-space-galaxy-online-free-437'), E('free-bear-logo-maker-online-673'), E('create-mascot-shield-logo-online-for-free-758')] },
  { name: 'logopapel', description: 'Crea un logo con texto de papel recortado', efectos: [E('multicolor-3d-paper-cut-style-text-effect-658'), E('free-online-art-paper-cut-text-effects-695')] },
  { name: 'logogema', description: 'Crea un logo con texto de diamantes y piedras preciosas', efectos: [E('diamond-text-95'), E('gemstone-text-effect-283'), E('3d-ruby-stone-text-281'), E('jewel-text-effect-275')] },
  { name: 'logobrillo', description: 'Crea un logo con texto de luz y brillo', efectos: [E('create-glowing-text-effects-online-706'), E('advanced-glow-effects-74'), E('colorful-glowing-text-effect-69')] },
  { name: 'logoretro', description: 'Crea un logo con texto estilo retro', efectos: [E('free-retro-neon-text-effect-online-538'), E('retro-text-effect-67')] }
];

module.exports = LOGOS.map((logo) => crearComandoLogo(logo));
module.exports.LOGOS = LOGOS;
