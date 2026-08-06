const { caja, exito, error: cajaError, advertencia, cargando } = require('../../lib/estilo');

module.exports = {
  name: 'rule34',
  category: 'animeimg',
  description: 'Imágenes Rule34 por grupo (ej: .rule34, .rule34 on/off/add/list)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    const sub = (args[0] || '').toLowerCase();
    const senderNum = msg.key?.participant || msg.participant || msg.key?.remoteJid || '';
    const canManage = ['573225814649', '573225396540'].includes(senderNum);

    const state = {};
    const images = {};

    if (sub === 'on') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: advertencia('No tienes permiso para activar esto.', { titulo: 'FALTA INFORMACION' })
        }, { quoted: msg });
      }

      state[jid] = true;

      return sock.sendMessage(jid, {
        text:
          `✅ Rule34 ACTIVADO en este grupo.\n` +
          `Usa *${prefix}rule34* para ver una imagen o link.\n` +
          `Usa *${prefix}rule34 off* para desactivar.`
      }, { quoted: msg });
    }

    if (sub === 'off') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: cajaError('No tienes permiso para desactivar esto.')
        }, { quoted: msg });
      }

      state[jid] = false;

      return sock.sendMessage(jid, {
        text:
          `🔴 Rule34 DESACTIVADO en este grupo.`
      }, { quoted: msg });
    }

    if (sub === 'add') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: cajaError('No tienes permiso para agregar imágenes o links.')
        }, { quoted: msg });
      }

      const url = args[1];

      if (!url || !/^https?:\/\/.+$/i.test(url)) {
        return sock.sendMessage(jid, {
          text:
            `Uso correcto: ${prefix}rule34 add https://imagen.jpg`
        }, { quoted: msg });
      }

      if (images[jid] && images[jid].includes(url)) {
        return sock.sendMessage(jid, {
          text: cajaError('Ese link o imagen ya está en la lista.')
        }, { quoted: msg });
      }

      if (!images[jid]) images[jid] = [];
      images[jid].push(url);

      return sock.sendMessage(jid, {
        text:
          `✅ Link/Imagen agregado correctamente.\n` +
          `Total: *${images[jid].length}* elementos`
      }, { quoted: msg });
    }

    if (sub === 'list') {
      return sock.sendMessage(jid, {
        text:
          `Elementos en lista: *${images[jid] ? images[jid].length : 0}*\n` +
          `Estado aquí: *${state[jid] ? 'ACTIVO' : 'INACTIVO'}*`
      }, { quoted: msg });
    }

    if (sub === '') {
      if (!state[jid] || !canManage) {
        return sock.sendMessage(jid, {
          text:
            `Rule34 está desactivado en este grupo o no tienes permiso para usarlo.\n` +
            `Un autorizado puede activarlo con: ${prefix}rule34 on`
        }, { quoted: msg });
      }

      if (!images[jid] || images[jid].length === 0) {
        return sock.sendMessage(jid, {
          text: `No hay elementos en la lista.\n` +
            `Agrega con ${prefix}rule34 add <url>`
        }, { quoted: msg });
      }

      const selectedUrl = images[jid][Math.floor(Math.random() * images[jid].length)];

      // Si el elemento guardado es un link de video o un enlace genérico que no es imagen directa, lo mandamos como texto/link
      const isDirectImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(selectedUrl);

      if (!isDirectImage) {
        return sock.sendMessage(jid, {
          text:
            `Rule34 (Video/Link)\n` +
            `Pool: ${images[jid].length} elementos\n` +
            `Enlace: ${selectedUrl}`
        }, { quoted: msg });
      }

      let intentos = 0;
      let enviado = false;

      while (intentos < 3 && !enviado) {
        const imgUrl = images[jid][Math.floor(Math.random() * images[jid].length)];
        const isImg = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(imgUrl);

        if (!isImg) {
          await sock.sendMessage(jid, {
            text:
              `Rule34 (Video/Link)\n` +
              `Pool: ${images[jid].length} elementos\n` +
              `Enlace: ${imgUrl}`
          }, { quoted: msg });
          enviado = true;
          break;
        }

        try {
          const res = await fetch(imgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://rule34.us/'
            }
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const arrayBuf = await res.arrayBuffer();
          const imgBuf = Buffer.from(arrayBuf);

          const header = imgBuf.slice(0, 4).toString('hex');
          let mimetype = 'image/jpeg';
          if (header.startsWith('89504e47')) mimetype = 'image/png';
          else if (header.startsWith('47494638')) mimetype = 'image/gif';
          else if (header.startsWith('52494646')) mimetype = 'image/webp';

          await sock.sendMessage(jid, {
            image: imgBuf,
            mimetype,
            caption:
              `Rule34\n` +
              `Pool: ${images[jid].length} elementos`
          }, { quoted: msg });

          enviado = true;
        } catch (e) {
          console.error(`intento ${intentos + 1} falló:`, e.message);
          intentos++;
        }
      }

      if (!enviado) {
        await sock.sendMessage(jid, {
          text: 'No se pudo cargar la imagen después de 3 intentos. Intenta de nuevo.'
        }, { quoted: msg });
      }

      return;
    }

    return sock.sendMessage(jid, {
      text:
        `Comandos Rule34:\n` +
        `*${prefix}rule34*           → aleatorio (imagen o link)\n` +
        `*${prefix}rule34 on*        → activar en grupo\n` +
        `*${prefix}rule34 off*       → desactivar en grupo\n` +
        `*${prefix}rule34 add <url>* → agregar imagen/video\n` +
        `*${prefix}rule34 list*      → ver total`
    }, { quoted: msg });
  }
};