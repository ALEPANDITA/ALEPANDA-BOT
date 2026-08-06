const { caja, exito, error: cajaError, advertencia } = require('../../lib/estilo');

// Almacenamiento en memoria para imágenes y videos (global del módulo)
const images = [];
const videos = [];
const state = {};

module.exports = [
  {
    name: 'rule34',
    category: 'nsfw',
    description: 'Imágenes Rule34 aleatorias (ej: .rule34, .rule34 on/off/add/del/list)',
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const args = texto.trim().split(/\s+/).slice(1);
      const sub = (args[0] || '').toLowerCase();
      const senderNum = msg.key?.participant || msg.key?.remoteJid || msg.participant || '';

      let canManage = false;
      if (jid.endsWith('@g.us')) {
        try {
          const groupMetadata = await sock.groupMetadata(jid);
          const participants = groupMetadata.participants || [];
          const participant = participants.find(p => p.id.replace(/@.+/, '') === senderNum.replace(/@.+/, ''));
          if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            canManage = true;
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      const AUTHORIZED = ['573225814649', '573225396540'];
      if (AUTHORIZED.some(num => senderNum.includes(num))) {
        canManage = true;
      }

      const userJid = msg.key?.participant || msg.key?.remoteJid || msg.participant;
      const userMention = userJid ? `@${userJid.split('@')[0]}` : '@usuario';

      if (sub === 'on') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para activar esto.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        state[jid] = true;
        return sock.sendMessage(jid, { text: exito(`Rule34 ACTIVADO en este grupo.`, { titulo: 'EXITO' }) }, { quoted: msg });
      }

      if (sub === 'off') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para desactivar esto.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        state[jid] = false;
        return sock.sendMessage(jid, { text: exito(`Rule34 DESACTIVADO en este grupo.`, { titulo: 'EXITO' }) }, { quoted: msg });
      }

      if (sub === 'add') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para agregar imágenes.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        const url = args[1];
        if (!url) {
          return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}rule34 add <url>`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          images.push(url);
          return sock.sendMessage(jid, { text: exito(`Imagen agregada correctamente. Total: ${images.length}`, { titulo: 'EXITO' }) }, { quoted: msg });
        } catch (err) {
          return sock.sendMessage(jid, { text: cajaError(`Error al agregar la imagen: ${err.message}`, { titulo: 'ERROR' }) }, { quoted: msg });
        }
      }

      if (sub === 'del') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para eliminar imágenes.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        const url = args[1];
        if (!url) {
          return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}rule34 del <url>`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        try {
          const index = images.indexOf(url);
          if (index === -1) throw new Error(`Imagen no encontrada`);
          images.splice(index, 1);
          return sock.sendMessage(jid, { text: exito(`Imagen eliminada correctamente.`, { titulo: 'EXITO' }) }, { quoted: msg });
        } catch (err) {
          return sock.sendMessage(jid, { text: cajaError(`Error al eliminar la imagen: ${err.message}`, { titulo: 'ERROR' }) }, { quoted: msg });
        }
      }

      if (sub === 'list') {
        return sock.sendMessage(jid, { text: caja(`Total de imágenes guardadas: ${images.length}`, { titulo: 'INFORMACION' }) }, { quoted: msg });
      }

      if (sub === '') {
        const isEnabled = state[jid] !== undefined ? state[jid] : true;
        if (!isEnabled) {
          return sock.sendMessage(jid, { text: advertencia(`Rule34 está desactivado en este grupo.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }

        if (images.length === 0) {
          return sock.sendMessage(jid, { text: advertencia(`No hay imágenes en la lista. Usa ${prefix}rule34 add <url> para agregar algunas.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }

        let intentos = 0;
        let enviado = false;

        while (intentos < 3 && !enviado) {
          const imgUrl = images[Math.floor(Math.random() * images.length)];
          try {
            const res = await fetch(imgUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
                `╭━━⬣ *RULE34* 🔞\n` +
                `│\n` +
                `│ 👤 Solicitada por ${userMention}\n` +
                `│ 📦 Total: ${images.length} imágenes\n` +
                `│\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━⬣`,
              mentions: userJid ? [userJid] : []
            }, { quoted: msg });

            enviado = true;
          } catch (e) {
            intentos++;
          }
        }

        if (!enviado) {
          return sock.sendMessage(jid, { text: cajaError(`No se pudo cargar la imagen después de varios intentos.`, { titulo: 'ERROR' }) }, { quoted: msg });
        }

        return;
      }

      return sock.sendMessage(jid, {
        text:
          `╭━━⬣ *RULE34* 🔞\n` +
          `│\n` +
          `│ 📋 *Comandos disponibles:*\n` +
          `│\n` +
          `│ *.rule34*           → imagen aleatoria\n` +
          `│ *.rule34 on*        → activar en grupo\n` +
          `│ *.rule34 off*       → desactivar en grupo\n` +
          `│ *.rule34 add <url>* → agregar imagen\n` +
          `│ *.rule34 del <url>* → eliminar imagen\n` +
          `│ *.rule34 list*      → ver total\n` +
          `│\n` +
          `│ ⚠️ _on/off/add/del requiere admin_\n` +
          `│\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: msg });
    }
  },
  {
    name: 'rulevid',
    aliases: ['rule'],
    category: 'nsfw',
    description: 'Videos Rule34 convertidos en gif (ej: .rulevid, .rulevid on/off/add/del/list)',
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const args = texto.trim().split(/\s+/).slice(1);
      const sub = (args[0] || '').toLowerCase();
      const senderNum = msg.key?.participant || msg.key?.remoteJid || msg.participant || '';

      let canManage = false;
      if (jid.endsWith('@g.us')) {
        try {
          const groupMetadata = await sock.groupMetadata(jid);
          const participants = groupMetadata.participants || [];
          const participant = participants.find(p => p.id.replace(/@.+/, '') === senderNum.replace(/@.+/, ''));
          if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            canManage = true;
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      const AUTHORIZED = ['573225814649', '573225396540'];
      if (AUTHORIZED.some(num => senderNum.includes(num))) {
        canManage = true;
      }

      const userJid = msg.key?.participant || msg.key?.remoteJid || msg.participant;
      const userMention = userJid ? `@${userJid.split('@')[0]}` : '@usuario';

      if (sub === 'on') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para activar esto.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        state[jid + '_vid'] = true;
        return sock.sendMessage(jid, { text: exito(`RuleVid (GIFs) ACTIVADO en este grupo.`, { titulo: 'EXITO' }) }, { quoted: msg });
      }

      if (sub === 'off') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para desactivar esto.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        state[jid + '_vid'] = false;
        return sock.sendMessage(jid, { text: exito(`RuleVid (GIFs) DESACTIVADO en este grupo.`, { titulo: 'EXITO' }) }, { quoted: msg });
      }

      if (sub === 'add') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para agregar videos.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        const url = args[1];
        if (!url) {
          return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}rulevid add <url>`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          videos.push(url);
          return sock.sendMessage(jid, { text: exito(`Video agregado correctamente. Total: ${videos.length}`, { titulo: 'EXITO' }) }, { quoted: msg });
        } catch (err) {
          return sock.sendMessage(jid, { text: cajaError(`Error al agregar el video: ${err.message}`, { titulo: 'ERROR' }) }, { quoted: msg });
        }
      }

      if (sub === 'del') {
        if (!canManage) {
          return sock.sendMessage(jid, { text: advertencia(`No tienes permisos de administrador para eliminar videos.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        const url = args[1];
        if (!url) {
          return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}rulevid del <url>`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }
        try {
          const index = videos.indexOf(url);
          if (index === -1) throw new Error(`Video no encontrado`);
          videos.splice(index, 1);
          return sock.sendMessage(jid, { text: exito(`Video eliminado correctamente.`, { titulo: 'EXITO' }) }, { quoted: msg });
        } catch (err) {
          return sock.sendMessage(jid, { text: cajaError(`Error al eliminar el video: ${err.message}`, { titulo: 'ERROR' }) }, { quoted: msg });
        }
      }

      if (sub === 'list') {
        return sock.sendMessage(jid, { text: caja(`Total de videos guardados: ${videos.length}`, { titulo: 'INFORMACION' }) }, { quoted: msg });
      }

      if (sub === '') {
        const isEnabled = state[jid + '_vid'] !== undefined ? state[jid + '_vid'] : true;
        if (!isEnabled) {
          return sock.sendMessage(jid, { text: advertencia(`RuleVid está desactivado en este grupo.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }

        if (videos.length === 0) {
          return sock.sendMessage(jid, { text: advertencia(`No hay videos en la lista. Usa ${prefix}rulevid add <url> para agregar algunos.`, { titulo: 'FALTA INFORMACION' }) }, { quoted: msg });
        }

        let intentos = 0;
        let enviado = false;

        while (intentos < 3 && !enviado) {
          const vidUrl = videos[Math.floor(Math.random() * videos.length)];
          try {
            const res = await fetch(vidUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const arrayBuf = await res.arrayBuffer();
            const vidBuf = Buffer.from(arrayBuf);

            await sock.sendMessage(jid, {
              video: vidBuf,
              gifPlayback: true,
              caption:
                `╭━━⬣ *RULEVID* 🔞\n` +
                `│\n` +
                `│ 👤 Solicitada por ${userMention}\n` +
                `│ 📦 Total: ${videos.length} GIFs\n` +
                `│\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━⬣`,
              mentions: userJid ? [userJid] : []
            }, { quoted: msg });

            enviado = true;
          } catch (e) {
            intentos++;
          }
        }

        if (!enviado) {
          return sock.sendMessage(jid, { text: cajaError(`No se pudo cargar el video/gif después de varios intentos.`, { titulo: 'ERROR' }) }, { quoted: msg });
        }

        return;
      }

      return sock.sendMessage(jid, {
        text:
          `╭━━⬣ *RULEVID (GIF)* 🔞\n` +
          `│\n` +
          `│ 📋 *Comandos disponibles:*\n` +
          `│\n` +
          `│ *.rulevid*          → gif aleatorio\n` +
          `│ *.rulevid on*       → activar en grupo\n` +
          `│ *.rulevid off*      → desactivar en grupo\n` +
          `│ *.rulevid add <url>*→ agregar video\n` +
          `│ *.rulevid del <url>*→ eliminar video\n` +
          `│ *.rulevid list*     → ver total\n` +
          `│\n` +
          `│ ⚠️ _on/off/add/del requiere admin_\n` +
          `│\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: msg });
    }
  }
];