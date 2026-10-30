const { generarLogo } = require('../../lib/logomaker');
const { advertencia, exito, error: cajaError } = require('../../lib/estilo');

// Cada logo es un comando: .logoneon <texto>. Efectos de ephoto360.
const LOGOS = [
  { name: 'logoalas', description: 'Crea un logo con efecto de alas de ángel galácticas', efecto: 'https://en.ephoto360.com/the-effect-of-galaxy-angel-wings-289.html' },
  { name: 'logoamongus', description: 'Crea un logo estilo Among Us', efecto: 'https://en.ephoto360.com/create-a-cover-image-for-the-game-among-us-online-762.html' },
  { name: 'logoangel', description: 'Crea un logo con efecto de alas de ángel', efecto: 'https://en.ephoto360.com/angel-wing-effect-329.html' },
  { name: 'logoarmy', description: 'Crea un logo de estilo militar y FPS gaming', efecto: 'https://en.ephoto360.com/free-gaming-logo-maker-for-fps-game-team-546.html' },
  { name: 'logochicagamer', description: 'Crea un logo de mascota gamer femenina', efecto: 'https://en.ephoto360.com/create-cute-girl-gamer-mascot-logo-online-687.html' },
  { name: 'logochristmas', description: 'Crea un logo con efecto navideño', efecto: 'https://en.ephoto360.com/christmas-effect-by-name-376.html' },
  { name: 'logocielo', description: 'Crea un logo con efecto de nubes en el cielo', efecto: 'https://en.ephoto360.com/create-a-cloud-text-effect-in-the-sky-618.html' },
  { name: 'logocorazon', description: 'Crea un logo con efecto de corazón y linterna', efecto: 'https://en.ephoto360.com/text-heart-flashlight-188.html' },
  { name: 'logodragonball', description: 'Crea un logo con efecto de texto estilo Dragon Ball', efecto: 'https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html' },
  { name: 'logofuturista', description: 'Crea un logo con efecto de luz tecnológica futurista', efecto: 'https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html' },
  { name: 'logogaming', description: 'Crea un logo de equipo de esports y gaming', efecto: 'https://en.ephoto360.com/make-team-logo-online-free-432.html' },
  { name: 'logogatito', description: 'Crea un logo con texto escrito en vidrio empañado', efecto: 'https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html' },
  { name: 'logoglitch', description: 'Crea un logo con efecto de texto glitch digital', efecto: 'https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html' },
  { name: 'logograffiti3d', description: 'Crea un logo con efecto de graffiti 3D', efecto: 'https://en.ephoto360.com/text-graffiti-3d-208.html' },
  { name: 'logohorror', description: 'Crea un logo con efecto de escritura de sangre', efecto: 'https://en.ephoto360.com/blood-writing-text-online-77.html' },
  { name: 'logolol', description: 'Crea un logo estilo League of Legends', efecto: 'https://en.ephoto360.com/make-your-own-league-of-legends-wallpaper-full-hd-442.html' },
  { name: 'logomatrix', description: 'Crea un logo con efecto de código Matrix', efecto: 'https://en.ephoto360.com/matrix-text-effect-154.html' },
  { name: 'logonaruto', description: 'Crea un logo con estilo de texto Naruto Shippuden', efecto: 'https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html' },
  { name: 'logoneon', description: 'Crea un logo con efecto de neón glitch', efecto: 'https://en.ephoto360.com/create-impressive-neon-glitch-text-effects-online-768.html' },
  { name: 'logonube', description: 'Crea un logo con efecto de texto en las nubes', efecto: 'https://en.ephoto360.com/cloud-text-effect-139.html' },
  { name: 'logopareja', description: 'Crea un logo con efecto de sombra y luz solar', efecto: 'https://en.ephoto360.com/sunlight-shadow-text-204.html' },
  { name: 'logopubg', description: 'Crea un logo estilo PUBG con personaje tierno', efecto: 'https://en.ephoto360.com/pubg-logo-maker-cute-character-online-617.html' },
  { name: 'logopubgfem', description: 'Crea un logo mascota PUBG para equipos de esports', efecto: 'https://en.ephoto360.com/pubg-mascot-logo-maker-for-an-esports-team-612.html' },
  { name: 'logosad', description: 'Crea un logo con texto escrito en vidrio mojado', efecto: 'https://en.ephoto360.com/write-text-on-wet-glass-online-589.html' },
  { name: 'logosolitario', description: 'Crea un logo con efecto tipográfico sobre pavimento', efecto: 'https://en.ephoto360.com/create-typography-text-effect-on-pavement-online-774.html' }
];

function crearComando(logo) {
  return {
    name: logo.name,
    category: 'logo',
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
        const imagen = await generarLogo(contenido, logo.efecto);
        await sock.sendMessage(jid, { image: imagen, caption: exito('Logo generado', { titulo: 'LOGO', estilo: 'neon' }) }, { quoted: msg });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      } catch (err) {
        console.error('[logo]', logo.name, err.message);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(jid, {
          text: cajaError('No pude generar el logo ahorita. Intenta con otro texto o mas tarde.', { estilo: 'neon' })
        }, { quoted: msg });
      }
    }
  };
}

module.exports = LOGOS.map(crearComando);
