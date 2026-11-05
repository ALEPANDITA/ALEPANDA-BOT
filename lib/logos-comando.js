// Fabrica de comandos de logo (imagen o video) a partir de una lista de disenos de ephoto360.
// La usan commands/logo/logos.js (imagenes) y commands/logo/logosvideo.js (videos / animaciones).
//
//   crearComandoLogo({ name, description, efectos: [url, ...] }, { video: false })
//
// Cada comando acepta ".logoX [1-N] <texto>": sin numero sale un diseno al azar; con numero, ese diseno.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { generarLogoVariado } = require('./logomaker');
const { leerConfig } = require('./config');
const { esOwnerBot } = require('./permisos');
const { advertencia, exito, error: cajaError } = require('./estilo');

// Convierte un gif/webm a mp4 con ffmpeg (WhatsApp solo reproduce mp4). Devuelve null si no se pudo.
function convertirAMp4(buffer, extension) {
  return new Promise((resolve) => {
    const base = path.join(os.tmpdir(), `logo-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const entrada = `${base}.${extension}`;
    const salida = `${base}.mp4`;
    const limpiar = () => { for (const f of [entrada, salida]) fs.unlink(f, () => {}); };
    try { fs.writeFileSync(entrada, buffer); } catch (_) { return resolve(null); }
    execFile('ffmpeg', ['-y', '-i', entrada, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', salida], { timeout: 60000 }, (err) => {
      let resultado = null;
      if (!err) { try { resultado = fs.readFileSync(salida); } catch (_) { resultado = null; } }
      limpiar();
      resolve(resultado && resultado.length > 1000 ? resultado : null);
    });
  });
}

// Manda lo que salio segun su tipo: imagen, video mp4, o gif/webm (convertido a mp4; si no se puede, como archivo).
async function enviarResultado(sock, jid, msg, resultado, caption) {
  const { buffer, tipo } = resultado;
  if (tipo === 'video' || tipo === 'gif') {
    const esMp4 = buffer.toString('ascii', 4, 8) === 'ftyp';
    const mp4 = esMp4 ? buffer : await convertirAMp4(buffer, tipo === 'gif' ? 'gif' : 'webm');
    if (mp4) {
      return sock.sendMessage(jid, { video: mp4, mimetype: 'video/mp4', caption, gifPlayback: tipo === 'gif' }, { quoted: msg });
    }
    // Sin ffmpeg (o fallo la conversion): se manda tal cual como archivo para no perder el logo
    return sock.sendMessage(jid, { document: buffer, mimetype: tipo === 'gif' ? 'image/gif' : 'video/webm', fileName: `logo.${tipo === 'gif' ? 'gif' : 'webm'}`, caption }, { quoted: msg });
  }
  return sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
}

function crearComandoLogo(logo, { video = false, categoria = video ? 'logovideo' : 'logo' } = {}) {
  return {
    name: logo.name,
    category: categoria,
    _efectos: logo.efectos,
    _video: video,
    description: logo.description + (logo.efectos.length > 1
      ? `. Uso: .${logo.name} [1-${logo.efectos.length}] <texto> (el numero elige el diseño; sin numero sale uno al azar)`
      : `. Uso: .${logo.name} <texto>`),
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
          text: advertencia(`Escribe el texto para tu logo.\nEjemplo: ${prefix}${logo.name} Panda${total > 1 ? `\nPara elegir el diseño (1 al ${total}): ${prefix}${logo.name} 2 Panda` : ''}`, { titulo: 'FALTA EL TEXTO', estilo: 'neon' })
        }, { quoted: msg });
      }
      if (contenido.length > 40) {
        return sock.sendMessage(jid, {
          text: advertencia('El texto es muy largo (maximo 40 caracteres).', { titulo: 'TEXTO LARGO', estilo: 'neon' })
        }, { quoted: msg });
      }

      try {
        await sock.sendMessage(jid, { react: { text: video ? '🎬' : '🎨', key: msg.key } });
        if (video) {
          await sock.sendMessage(jid, { text: '🎬 Generando tu logo animado... puede tardar hasta un minuto.' }, { quoted: msg });
        }
        // Cada vez sale uno de los disenos del tema (al azar); si uno falla se prueba otro
        const resultado = await generarLogoVariado(contenido, logo.efectos, { preferido, video });
        let etiqueta = total > 1 ? `${video ? 'Logo animado' : 'Logo generado'} · diseño ${resultado.numero}/${total}` : (video ? 'Logo animado' : 'Logo generado');
        if (preferido && resultado.numero !== preferido) etiqueta += ` (el ${preferido} no estuvo disponible)`;
        await enviarResultado(sock, jid, msg, resultado, exito(etiqueta, { titulo: video ? 'LOGO VIDEO' : 'LOGO', estilo: 'neon' }));
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
          text: cajaError(`No pude generar el logo${video ? ' animado' : ''} ahorita. Intenta con otro texto o mas tarde.` + detalle, { estilo: 'neon' })
        }, { quoted: msg });
      }
    }
  };
}

module.exports = { crearComandoLogo, enviarResultado, convertirAMp4 };
