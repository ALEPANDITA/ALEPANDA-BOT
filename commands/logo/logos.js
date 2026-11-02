const { generarLogoVariado } = require('../../lib/logomaker');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError } = require('../../lib/estilo');

// Cada logo es un comando: .logoneon <texto>. "efectos" = paginas de ephoto360 del mismo tema (la primera es la
// de siempre); en cada uso sale una al azar. Para agregar mas disenos basta con sumar otra URL a la lista.
const LOGOS = [
  { name: 'logoalas', description: 'Crea un logo con efecto de alas de ángel galácticas', efectos: ['https://en.ephoto360.com/the-effect-of-galaxy-angel-wings-289.html', 'https://en.ephoto360.com/wings-text-effect-176.html', 'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html', 'https://en.ephoto360.com/galaxy-text-effect-116.html', 'https://en.ephoto360.com/making-neon-light-text-effect-with-galaxy-style-521.html'] },
  { name: 'logoamongus', description: 'Crea un logo estilo Among Us', efectos: ['https://en.ephoto360.com/create-a-cover-image-for-the-game-among-us-online-762.html', 'https://en.ephoto360.com/create-a-banner-game-among-us-with-your-name-763.html', 'https://en.ephoto360.com/create-free-fire-facebook-cover-online-567.html', 'https://en.ephoto360.com/create-overwatch-2-banner-for-the-online-youtube-channel-782.html', 'https://en.ephoto360.com/generate-banner-arena-of-valor-aov-with-name-440.html'] },
  { name: 'logoangel', description: 'Crea un logo con efecto de alas de ángel', efectos: ['https://en.ephoto360.com/angel-wing-effect-329.html', 'https://en.ephoto360.com/create-colorful-angel-wing-avatars-731.html', 'https://en.ephoto360.com/wings-text-effect-176.html', 'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html', 'https://en.ephoto360.com/the-effect-of-galaxy-angel-wings-289.html'] },
  { name: 'logoarmy', description: 'Crea un logo de estilo militar y FPS gaming', efectos: ['https://en.ephoto360.com/free-gaming-logo-maker-for-fps-game-team-546.html', 'https://en.ephoto360.com/create-logo-team-logo-gaming-assassin-style-574.html', 'https://en.ephoto360.com/create-call-of-duty-warzone-youtube-banner-online-548.html', 'https://en.ephoto360.com/1917-style-text-effect-523.html', 'https://en.ephoto360.com/create-valorant-banner-youtube-online-588.html'] },
  { name: 'logochicagamer', description: 'Crea un logo de mascota gamer femenina', efectos: ['https://en.ephoto360.com/create-cute-girl-gamer-mascot-logo-online-687.html', 'https://en.ephoto360.com/create-a-gaming-mascot-logo-free-560.html', 'https://en.ephoto360.com/create-a-circle-mascot-team-logo-483.html', 'https://en.ephoto360.com/create-mascot-logo-astronaut-space-galaxy-online-free-437.html', 'https://en.ephoto360.com/metal-mascots-logo-maker-486.html'] },
  { name: 'logochristmas', description: 'Crea un logo con efecto navideño', efectos: ['https://en.ephoto360.com/christmas-effect-by-name-376.html', 'https://en.ephoto360.com/christmas-snow-text-effect-online-631.html', 'https://en.ephoto360.com/create-sparkles-3d-christmas-text-effect-online-727.html', 'https://en.ephoto360.com/create-a-frozen-christmas-text-effect-online-792.html', 'https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html'] },
  { name: 'logocielo', description: 'Crea un logo con efecto de nubes en el cielo', efectos: ['https://en.ephoto360.com/create-a-cloud-text-effect-in-the-sky-618.html', 'https://en.ephoto360.com/write-text-effect-clouds-in-the-sky-online-619.html', 'https://en.ephoto360.com/create-realistic-cloud-text-effect-606.html', 'https://en.ephoto360.com/cloud-text-effect-139.html', 'https://en.ephoto360.com/cloud-effect-132.html'] },
  { name: 'logocorazon', description: 'Crea un logo con efecto de corazón y linterna', efectos: ['https://en.ephoto360.com/text-heart-flashlight-188.html', 'https://en.ephoto360.com/red-heart-effect-27.html', 'https://en.ephoto360.com/double-heart-effect-16.html', 'https://en.ephoto360.com/write-letters-on-the-balloons-love-189.html', 'https://en.ephoto360.com/love-card-187.html'] },
  { name: 'logodragonball', description: 'Crea un logo con efecto de texto estilo Dragon Ball', efectos: ['https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html', 'https://en.ephoto360.com/free-online-dragon-ball-facebook-cover-photos-maker-443.html', 'https://en.ephoto360.com/dragon-steel-text-effect-online-347.html', 'https://en.ephoto360.com/dragon-fire-text-effect-111.html', 'https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html'] },
  { name: 'logofuturista', description: 'Crea un logo con efecto de luz tecnológica futurista', efectos: ['https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html', 'https://en.ephoto360.com/free-create-a-3d-hologram-text-effect-441.html', 'https://en.ephoto360.com/create-a-awesome-logo-sci-fi-effects-492.html', 'https://en.ephoto360.com/plasma-text-effects-online-71.html', 'https://en.ephoto360.com/create-a-3d-shiny-metallic-text-effect-online-685.html'] },
  { name: 'logogaming', description: 'Crea un logo de equipo de esports y gaming', efectos: ['https://en.ephoto360.com/make-team-logo-online-free-432.html', 'https://en.ephoto360.com/create-logo-team-logo-gaming-assassin-style-574.html', 'https://en.ephoto360.com/create-an-online-team-logo-in-black-and-white-style-689.html', 'https://en.ephoto360.com/create-a-circle-mascot-team-logo-483.html', 'https://en.ephoto360.com/create-logo-templates-according-to-online-icons-361.html'] },
  { name: 'logogatito', description: 'Crea un logo con texto escrito en vidrio empañado', efectos: ['https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html', 'https://en.ephoto360.com/create-drop-water-on-window-effect-online-746.html', 'https://en.ephoto360.com/3d-underwater-text-effect-online-682.html', 'https://en.ephoto360.com/water-3d-text-effect-online-126.html', 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html'] },
  { name: 'logoglitch', description: 'Crea un logo con efecto de texto glitch digital', efectos: ['https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html', 'https://en.ephoto360.com/create-impressive-neon-glitch-text-effects-online-768.html', 'https://en.ephoto360.com/tik-tok-text-effects-online-generator-485.html', 'https://en.ephoto360.com/create-3d-crack-text-effect-online-704.html', 'https://en.ephoto360.com/retro-text-effect-67.html'] },
  { name: 'logograffiti3d', description: 'Crea un logo con efecto de graffiti 3D', efectos: ['https://en.ephoto360.com/text-graffiti-3d-208.html', 'https://en.ephoto360.com/graffiti-text-3-179.html', 'https://en.ephoto360.com/create-a-cartoon-style-graffiti-text-effect-online-668.html', 'https://en.ephoto360.com/create-a-graffiti-text-effect-on-the-wall-online-665.html', 'https://en.ephoto360.com/paint-splatter-text-effect-72.html'] },
  { name: 'logohorror', description: 'Crea un logo con efecto de escritura de sangre', efectos: ['https://en.ephoto360.com/blood-writing-text-online-77.html', 'https://en.ephoto360.com/write-blood-text-on-the-wall-264.html', 'https://en.ephoto360.com/writing-horror-text-online-266.html', 'https://en.ephoto360.com/writing-horror-letters-on-metal-plates-265.html', 'https://en.ephoto360.com/text-halloween-80.html'] },
  { name: 'logolol', description: 'Crea un logo estilo League of Legends', efectos: ['https://en.ephoto360.com/make-your-own-league-of-legends-wallpaper-full-hd-442.html', 'https://en.ephoto360.com/create-the-league-of-legends-wallpaper-for-mobile-315.html', 'https://en.ephoto360.com/create-youtube-banner-league-of-legends-online-428.html', 'https://en.ephoto360.com/generate-banner-game-lol-with-rank-boders-439.html', 'https://en.ephoto360.com/create-project-yasuo-logo-384.html'] },
  { name: 'logomatrix', description: 'Crea un logo con efecto de código Matrix', efectos: ['https://en.ephoto360.com/matrix-text-effect-154.html', 'https://en.ephoto360.com/green-neon-text-effect-395.html', 'https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html', 'https://en.ephoto360.com/making-neon-light-text-effect-with-galaxy-style-521.html', 'https://en.ephoto360.com/advanced-glow-effects-74.html'] },
  { name: 'logonaruto', description: 'Crea un logo con estilo de texto Naruto Shippuden', efectos: ['https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html', 'https://en.ephoto360.com/create-online-3d-comic-style-text-effects-817.html', 'https://en.ephoto360.com/create-text-effects-in-the-style-of-the-deadpool-logo-818.html', 'https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html', 'https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html'] },
  { name: 'logoneon', description: 'Crea un logo con efecto de neón glitch', efectos: ['https://en.ephoto360.com/create-impressive-neon-glitch-text-effects-online-768.html', 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html', 'https://en.ephoto360.com/neon-text-effect-light-200.html', 'https://en.ephoto360.com/neon-text-effect-68.html', 'https://en.ephoto360.com/green-neon-text-effect-395.html'] },
  { name: 'logonube', description: 'Crea un logo con efecto de texto en las nubes', efectos: ['https://en.ephoto360.com/cloud-text-effect-139.html', 'https://en.ephoto360.com/create-realistic-cloud-text-effect-606.html', 'https://en.ephoto360.com/cloud-effect-132.html', 'https://en.ephoto360.com/write-text-effect-clouds-in-the-sky-online-619.html', 'https://en.ephoto360.com/create-a-cloud-text-effect-in-the-sky-618.html'] },
  { name: 'logopareja', description: 'Crea un logo con efecto de sombra y luz solar', efectos: ['https://en.ephoto360.com/sunlight-shadow-text-204.html', 'https://en.ephoto360.com/create-glowing-text-effects-online-706.html', 'https://en.ephoto360.com/create-sunset-light-text-effects-online-807.html', 'https://en.ephoto360.com/advanced-glow-effects-74.html', 'https://en.ephoto360.com/bokeh-text-effect-86.html'] },
  { name: 'logopubg', description: 'Crea un logo estilo PUBG con personaje tierno', efectos: ['https://en.ephoto360.com/pubg-logo-maker-cute-character-online-617.html', 'https://en.ephoto360.com/free-pubg-logo-maker-online-609.html', 'https://en.ephoto360.com/colorful-pubg-logo-maker-online-613.html', 'https://en.ephoto360.com/black-white-pubg-logo-for-esports-gaming-610.html', 'https://en.ephoto360.com/pubg-mascot-logo-maker-for-an-esports-team-612.html'] },
  { name: 'logopubgfem', description: 'Crea un logo mascota PUBG para equipos de esports', efectos: ['https://en.ephoto360.com/pubg-mascot-logo-maker-for-an-esports-team-612.html', 'https://en.ephoto360.com/colorful-pubg-logo-maker-online-613.html', 'https://en.ephoto360.com/black-white-pubg-logo-for-esports-gaming-610.html', 'https://en.ephoto360.com/create-a-gaming-mascot-logo-free-560.html', 'https://en.ephoto360.com/create-mascot-shield-logo-online-for-free-758.html'] },
  { name: 'logosad', description: 'Crea un logo con texto escrito en vidrio mojado', efectos: ['https://en.ephoto360.com/write-text-on-wet-glass-online-589.html', 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html', 'https://en.ephoto360.com/create-drop-water-on-window-effect-online-746.html', 'https://en.ephoto360.com/water-3d-text-effect-online-126.html', 'https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html'] },
  { name: 'logosolitario', description: 'Crea un logo con efecto tipográfico sobre pavimento', efectos: ['https://en.ephoto360.com/create-typography-text-effect-on-pavement-online-774.html', 'https://en.ephoto360.com/road-paint-70.html', 'https://en.ephoto360.com/typography-maker-online-5-343.html', 'https://en.ephoto360.com/create-online-typography-art-effects-with-multiple-layers-811.html', 'https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html'] }
];

function crearComando(logo) {
  return {
    name: logo.name,
    category: 'logo',
    _efectos: logo.efectos,
    description: logo.description + `. Uso: .${logo.name} [1-${logo.efectos.length}] <texto> (el numero elige el diseño; sin numero sale uno al azar)`,
    execute: async (sock, jid, msg, { prefix, texto }) => {
      let contenido = texto.slice(prefix.length + logo.name.length).trim();
      const total = logo.efectos.length;

      // ".logocorazon 2 Panda" -> diseño 2 con el texto "Panda" (un solo digito, seguido del texto)
      let preferido = null;
      const eleccion = contenido.match(/^([1-9])\s+(\S[\s\S]*)$/);
      if (eleccion) {
        if (Number(eleccion[1]) > total) {
          return sock.sendMessage(jid, {
            text: advertencia(`Este logo tiene ${total} diseño${total === 1 ? '' : 's'} (del 1 al ${total}).\nEjemplo: ${prefix}${logo.name} ${total} Panda`, { titulo: 'DISEÑO NO EXISTE', estilo: 'neon' })
          }, { quoted: msg });
        }
        preferido = Number(eleccion[1]);
        contenido = eleccion[2].trim();
      }

      if (!contenido) {
        return sock.sendMessage(jid, {
          text: advertencia(`Escribe el texto para tu logo.\nEjemplo: ${prefix}${logo.name} Panda\nPara elegir el diseño (1 al ${total}): ${prefix}${logo.name} 2 Panda`, { titulo: 'FALTA EL TEXTO', estilo: 'neon' })
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
        const { buffer: imagen, numero } = await generarLogoVariado(contenido, logo.efectos, { preferido });
        let etiqueta = total > 1 ? `Logo generado · diseño ${numero}/${total}` : 'Logo generado';
        if (preferido && numero !== preferido) etiqueta += ` (el ${preferido} no estuvo disponible)`;
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
