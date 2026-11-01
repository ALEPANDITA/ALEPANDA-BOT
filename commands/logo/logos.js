const { generarLogoVariado } = require('../../lib/logomaker');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError } = require('../../lib/estilo');

// Cada logo es un comando: .logoneon <texto>. "efectos" = paginas de ephoto360 del mismo tema (la primera es la
// de siempre); en cada uso sale una al azar. Para agregar mas disenos basta con sumar otra URL a la lista.
const LOGOS = [
  { name: 'logoalas', description: 'Crea un logo con efecto de alas de ángel galácticas', efectos: ['https://en.ephoto360.com/the-effect-of-galaxy-angel-wings-289.html', 'https://en.ephoto360.com/wings-text-effect-176.html'] },
  { name: 'logoamongus', description: 'Crea un logo estilo Among Us', efectos: ['https://en.ephoto360.com/create-a-cover-image-for-the-game-among-us-online-762.html', 'https://en.ephoto360.com/create-a-banner-game-among-us-with-your-name-763.html'] },
  { name: 'logoangel', description: 'Crea un logo con efecto de alas de ángel', efectos: ['https://en.ephoto360.com/angel-wing-effect-329.html', 'https://en.ephoto360.com/create-colorful-angel-wing-avatars-731.html', 'https://en.ephoto360.com/wings-text-effect-176.html'] },
  { name: 'logoarmy', description: 'Crea un logo de estilo militar y FPS gaming', efectos: ['https://en.ephoto360.com/free-gaming-logo-maker-for-fps-game-team-546.html', 'https://en.ephoto360.com/create-logo-team-logo-gaming-assassin-style-574.html', 'https://en.ephoto360.com/create-an-online-team-logo-in-black-and-white-style-689.html'] },
  { name: 'logochicagamer', description: 'Crea un logo de mascota gamer femenina', efectos: ['https://en.ephoto360.com/create-cute-girl-gamer-mascot-logo-online-687.html', 'https://en.ephoto360.com/create-a-gaming-mascot-logo-free-560.html', 'https://en.ephoto360.com/create-a-circle-mascot-team-logo-483.html', 'https://en.ephoto360.com/create-mascot-logo-astronaut-space-galaxy-online-free-437.html', 'https://en.ephoto360.com/metal-mascots-logo-maker-486.html'] },
  { name: 'logochristmas', description: 'Crea un logo con efecto navideño', efectos: ['https://en.ephoto360.com/christmas-effect-by-name-376.html', 'https://en.ephoto360.com/christmas-snow-text-effect-online-631.html', 'https://en.ephoto360.com/create-sparkles-3d-christmas-text-effect-online-727.html', 'https://en.ephoto360.com/create-a-frozen-christmas-text-effect-online-792.html'] },
  { name: 'logocielo', description: 'Crea un logo con efecto de nubes en el cielo', efectos: ['https://en.ephoto360.com/create-a-cloud-text-effect-in-the-sky-618.html', 'https://en.ephoto360.com/write-text-effect-clouds-in-the-sky-online-619.html', 'https://en.ephoto360.com/create-realistic-cloud-text-effect-606.html'] },
  { name: 'logocorazon', description: 'Crea un logo con efecto de corazón y linterna', efectos: ['https://en.ephoto360.com/text-heart-flashlight-188.html', 'https://en.ephoto360.com/red-heart-effect-27.html'] },
  { name: 'logodragonball', description: 'Crea un logo con efecto de texto estilo Dragon Ball', efectos: ['https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html', 'https://en.ephoto360.com/free-online-dragon-ball-facebook-cover-photos-maker-443.html'] },
  { name: 'logofuturista', description: 'Crea un logo con efecto de luz tecnológica futurista', efectos: ['https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html', 'https://en.ephoto360.com/free-create-a-3d-hologram-text-effect-441.html', 'https://en.ephoto360.com/create-glowing-text-effects-online-706.html'] },
  { name: 'logogaming', description: 'Crea un logo de equipo de esports y gaming', efectos: ['https://en.ephoto360.com/make-team-logo-online-free-432.html', 'https://en.ephoto360.com/create-logo-team-logo-gaming-assassin-style-574.html', 'https://en.ephoto360.com/create-an-online-team-logo-in-black-and-white-style-689.html', 'https://en.ephoto360.com/create-a-circle-mascot-team-logo-483.html', 'https://en.ephoto360.com/create-logo-templates-according-to-online-icons-361.html'] },
  { name: 'logogatito', description: 'Crea un logo con texto escrito en vidrio empañado', efectos: ['https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html', 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html'] },
  { name: 'logoglitch', description: 'Crea un logo con efecto de texto glitch digital', efectos: ['https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html', 'https://en.ephoto360.com/create-impressive-neon-glitch-text-effects-online-768.html', 'https://en.ephoto360.com/tik-tok-text-effects-online-generator-485.html'] },
  { name: 'logograffiti3d', description: 'Crea un logo con efecto de graffiti 3D', efectos: ['https://en.ephoto360.com/text-graffiti-3d-208.html', 'https://en.ephoto360.com/graffiti-text-3-179.html', 'https://en.ephoto360.com/create-a-cartoon-style-graffiti-text-effect-online-668.html'] },
  { name: 'logohorror', description: 'Crea un logo con efecto de escritura de sangre', efectos: ['https://en.ephoto360.com/blood-writing-text-online-77.html', 'https://en.ephoto360.com/write-blood-text-on-the-wall-264.html', 'https://en.ephoto360.com/writing-horror-text-online-266.html', 'https://en.ephoto360.com/writing-horror-letters-on-metal-plates-265.html'] },
  { name: 'logolol', description: 'Crea un logo estilo League of Legends', efectos: ['https://en.ephoto360.com/make-your-own-league-of-legends-wallpaper-full-hd-442.html', 'https://en.ephoto360.com/create-the-league-of-legends-wallpaper-for-mobile-315.html'] },
  { name: 'logomatrix', description: 'Crea un logo con efecto de código Matrix', efectos: ['https://en.ephoto360.com/matrix-text-effect-154.html'] },
  { name: 'logonaruto', description: 'Crea un logo con estilo de texto Naruto Shippuden', efectos: ['https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html'] },
  { name: 'logoneon', description: 'Crea un logo con efecto de neón glitch', efectos: ['https://en.ephoto360.com/create-impressive-neon-glitch-text-effects-online-768.html', 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html', 'https://en.ephoto360.com/neon-text-effect-light-200.html', 'https://en.ephoto360.com/neon-text-effect-68.html', 'https://en.ephoto360.com/green-neon-text-effect-395.html'] },
  { name: 'logonube', description: 'Crea un logo con efecto de texto en las nubes', efectos: ['https://en.ephoto360.com/cloud-text-effect-139.html', 'https://en.ephoto360.com/create-realistic-cloud-text-effect-606.html', 'https://en.ephoto360.com/cloud-effect-132.html'] },
  { name: 'logopareja', description: 'Crea un logo con efecto de sombra y luz solar', efectos: ['https://en.ephoto360.com/sunlight-shadow-text-204.html', 'https://en.ephoto360.com/create-glowing-text-effects-online-706.html', 'https://en.ephoto360.com/create-sunset-light-text-effects-online-807.html'] },
  { name: 'logopubg', description: 'Crea un logo estilo PUBG con personaje tierno', efectos: ['https://en.ephoto360.com/pubg-logo-maker-cute-character-online-617.html', 'https://en.ephoto360.com/free-pubg-logo-maker-online-609.html', 'https://en.ephoto360.com/colorful-pubg-logo-maker-online-613.html', 'https://en.ephoto360.com/black-white-pubg-logo-for-esports-gaming-610.html'] },
  { name: 'logopubgfem', description: 'Crea un logo mascota PUBG para equipos de esports', efectos: ['https://en.ephoto360.com/pubg-mascot-logo-maker-for-an-esports-team-612.html', 'https://en.ephoto360.com/colorful-pubg-logo-maker-online-613.html', 'https://en.ephoto360.com/black-white-pubg-logo-for-esports-gaming-610.html', 'https://en.ephoto360.com/create-a-gaming-mascot-logo-free-560.html'] },
  { name: 'logosad', description: 'Crea un logo con texto escrito en vidrio mojado', efectos: ['https://en.ephoto360.com/write-text-on-wet-glass-online-589.html', 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html', 'https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html'] },
  { name: 'logosolitario', description: 'Crea un logo con efecto tipográfico sobre pavimento', efectos: ['https://en.ephoto360.com/create-typography-text-effect-on-pavement-online-774.html', 'https://en.ephoto360.com/road-paint-70.html', 'https://en.ephoto360.com/typography-maker-online-5-343.html'] }
];

function crearComando(logo) {
  return {
    name: logo.name,
    category: 'logo',
    _efectos: logo.efectos,
    description: logo.description + '. Uso: .' + logo.name + ' <texto>',
    execute: async (sock, jid, msg, { prefix, texto }) => {
      const contenido = texto.slice(prefix.length + logo.name.length).trim();

      if (!contenido) {
        return sock.sendMessage(jid, {
          text: advertencia(`Escribe el texto para tu logo.\nEjemplo: ${prefix}${logo.name} Panda`, { titulo: 'FALTA EL TEXTO', estilo: 'neon' })
        }, { quoted: msg });
      }
      if (contenido.length > 40) {
        return sock.sendMessage(jid, {
          text: advertencia('El texto es muy largo (maximo 40 caracteres).', { titulo: 'TEXTO LARGO', estilo: 'neon' })
        }, { quoted: msg });
      }

      try {
        await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } });
        // Cada vez sale uno de los disenos del tema (al azar); si uno falla se prueba otro
        const { buffer: imagen, numero, total } = await generarLogoVariado(contenido, logo.efectos);
        const etiqueta = total > 1 ? `Logo generado · diseño ${numero}/${total}` : 'Logo generado';
        await sock.sendMessage(jid, { image: imagen, caption: exito(etiqueta, { titulo: 'LOGO', estilo: 'neon' }) }, { quoted: msg });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      } catch (err) {
        console.error('[logo]', logo.name, err.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        // El owner ve ademas la causa tecnica (para saber que proveedor fallo); los demas solo el aviso normal
        let detalle = '';
        try {
          if (await esOwnerBot(sock, leerConfig(), msg)) detalle = `\n\n🔧 Detalle (solo owner): ${String(err.message).slice(0, 450)}`;
        } catch (_) { /* sin detalle */ }
        await sock.sendMessage(jid, {
          text: cajaError('No pude generar el logo ahorita. Intenta con otro texto o mas tarde.' + detalle, { estilo: 'neon' })
        }, { quoted: msg });
      }
    }
  };
}

module.exports = LOGOS.map(crearComando);
