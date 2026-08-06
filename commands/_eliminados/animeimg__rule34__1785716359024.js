const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const IMAGES_PATH = join(__dirname, 'rule34_images.json');
const STATE_PATH  = join(__dirname, 'rule34_state.json');

function loadImages() {
  if (!existsSync(IMAGES_PATH)) {
    const defaultImages = [
      "https://img2.rule34.us/thumbnails/3e/01/thumbnail_3e01548ad9e74921325e90bfaad8d6cd.jpg",
      "https://img2.rule34.us/thumbnails/80/14/thumbnail_80146a6325a1602f3e9e1a24c5a322d4.jpg",
      "https://img2.rule34.us/thumbnails/29/49/thumbnail_2949fbeb431437d9d210dfb13fc2624e.jpg",
      "https://img2.rule34.us/thumbnails/e5/f1/thumbnail_e5f1dc47aed2ab8a2455596e115d5b18.jpg",
      "https://img2.rule34.us/thumbnails/2d/f4/thumbnail_2df44cc78eb33cb700a8b70de30b8422.jpg",
      "https://img2.rule34.us/thumbnails/67/02/thumbnail_67028ef6ee302f751d7ecf0a7f0f46d5.jpg",
      "https://img2.rule34.us/thumbnails/a9/96/thumbnail_a99660e2f8867a681143768739a968ad.jpg",
      "https://img2.rule34.us/thumbnails/c3/6f/thumbnail_c36f839642b2c00ec9ba0a1604b338e2.jpg",
      "https://img2.rule34.us/thumbnails/6c/d1/thumbnail_6cd15b32c2e385090639e6e792bbe671.jpg",
      "https://img2.rule34.us/thumbnails/d5/ad/thumbnail_d5ad60f4fefa2950c915c01fa631c2b8.jpg",
      "https://img2.rule34.us/thumbnails/07/05/thumbnail_0705f2364081caf1a3ff77f9a9f2025c.jpg",
      "https://img2.rule34.us/thumbnails/e2/a1/thumbnail_e2a1476de5b53b6f9b9b4c213e56a419.jpg",
      "https://img2.rule34.us/thumbnails/ee/bc/thumbnail_eebc49270a5fac36f8572c7fbadc9ac8.jpg",
      "https://img2.rule34.us/thumbnails/8d/ec/thumbnail_8decad08e7231f450279e1f8bec3a504.jpg",
      "https://img2.rule34.us/thumbnails/0d/7c/thumbnail_0d7ccc334bd98267048621a0bd1af0ce.jpg",
      "https://img2.rule34.us/thumbnails/8b/91/thumbnail_8b91d63833184f3bb3c46056036e55ac.jpg",
      "https://img2.rule34.us/thumbnails/ab/4a/thumbnail_ab4ae0e5b1d8b4df92466a09f66e788d.jpg",
      "https://img2.rule34.us/thumbnails/f7/ff/thumbnail_f7ffaa835af290232cc9244091b6a5f2.jpg",
      "https://img2.rule34.us/thumbnails/95/51/thumbnail_9551194bc3ce073d51b33d253edecd64.jpg",
      "https://img2.rule34.us/thumbnails/bd/38/thumbnail_bd38c56e352157a2e104e2317b2f0488.jpg",
      "https://img2.rule34.us/thumbnails/6c/a7/thumbnail_6ca762717ee60b93183af57000ed9f87.jpg"
    ];
    saveImages(defaultImages);
    return defaultImages;
  }
  try {
    return JSON.parse(readFileSync(IMAGES_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveImages(images) {
  writeFileSync(IMAGES_PATH, JSON.stringify(images, null, 2), 'utf8');
}

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function randomImage(images) {
  return images[Math.floor(Math.random() * images.length)];
}

function isValidImageUrl(url) {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
}

function senderNumber(m) {
  const sender = m.key?.participant || m.participant || m.key?.remoteJid || '';
  return sender.replace(/@.+/, '');
}

async  function isGroupAdmin(sock, jid, senderJid) {
  try {
    if (!jid.endsWith('@g.us')) return false;
    const metadata = await sock.groupMetadata(jid);
    const participants = metadata.participants || [];
    const participant = participants.find(p => p.id === senderJid || p.id.replace(/@.+/, '') === senderJid.replace(/@.+/, ''));
    return participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false;
  } catch {
    return false;
  }
}

module.exports = {
  name: 'rule34',
  category: 'animeimg',
  description: 'Imágenes Rule34 por grupo (ej: .rule34 [on|off|add|clear|list])',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const cleanText = texto.trim();
    const withoutPrefix = cleanText.startsWith(prefix) ? cleanText.slice(prefix.length).trim() : cleanText;
    const parts = withoutPrefix.split(/\s+/);
    
    const cmdName = (parts[0] || '').toLowerCase();
    if (cmdName !== 'rule34') return;

    const sub = (parts[1] || '').toLowerCase();
    const senderNum = senderNumber(msg);
    const senderJid = msg.key?.participant || msg.participant || msg.key?.remoteJid || '';
    const isOwner = msg.key?.fromMe || false;
    const isAdmin = await isGroupAdmin(sock, jid, senderJid);
    const canManage = isOwner || isAdmin;

    const images = loadImages();
    const state = loadState();

    if (sub === 'on') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ No tienes permiso\n│ para activar esto (requiere ser admin u owner).\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      state[jid] = true;
      saveState(state);

      return sock.sendMessage(jid, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          '│ ✅ *Rule34 ACTIVADO* en este grupo.\n' +
          '│\n' +
          '│ Usa *.rule34* para ver una imagen.\n' +
          '│ Usa *.rule34 off* para desactivar.\n' +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: msg });
    }

    if (sub === 'off') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ No tienes permiso\n│ para desactivar esto (requiere ser admin u owner).\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      state[jid] = false;
      saveState(state);

      return sock.sendMessage(jid, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          '│ 🔴 *Rule34 DESACTIVADO* en este grupo.\n' +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: msg });
    }

    if (sub === 'add') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ No tienes permiso\n│ para agregar imágenes (requiere ser admin u owner).\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      const url = parts[2];

      if (!url || !isValidImageUrl(url)) {
        return sock.sendMessage(jid, {
          text:
            '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
            '│\n' +
            '│ ⚠️ URL inválida o faltante.\n' +
            '│\n' +
            '│ *Uso correcto:*\n' +
            '│ .rule34 add https://imagen.jpg\n' +
            '│\n' +
            '│ _Solo se aceptan .jpg .jpeg\n' +
            '│  .png .gif .webp_\n' +
            '│\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      if (images.includes(url)) {
        return sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ⚠️ Esa imagen ya está\n│ en la lista.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      images.push(url);
      saveImages(images);

      return sock.sendMessage(jid, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          `│ ✅ Imagen agregada correctamente.\n` +
          `│ 📦 Total: *${images.length}* imágenes\n` +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: msg });
    }

    if (sub === 'clear') {
      if (!canManage) {
        return sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ No tienes permiso\n│ para vaciar la lista (requiere ser admin u owner).\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      saveImages([]);

      return sock.sendMessage(jid, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          '│ 🗑️ Se han eliminado todos los links\n' +
          '│ de la lista de imágenes.\n' +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: msg });
    }

    if (sub === 'list') {
      return sock.sendMessage(jid, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          `│ 📦 Imágenes en lista: *${images.length}*\n` +
          `│ 🔴/✅ Estado aquí: *${state[jid] ? 'ACTIVO' : 'INACTIVO'}*\n` +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: msg });
    }

    if (sub === '') {
      if (!state[jid]) {
        return sock.sendMessage(jid, {
          text:
            '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
            '│\n' +
            '│ 🔴 Rule34 está *desactivado*\n' +
            '│ en este grupo.\n' +
            '│\n' +
            '│ Un admin puede activarlo con:\n' +
            '│ *.rule34 on*\n' +
            '│\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      if (images.length === 0) {
        return sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ⚠️ No hay imágenes en la lista.\n│ Agrega con *.rule34 add <url>*\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      let intentos = 0;
      let enviado = false;

      while (intentos < 3 && !enviado) {
        const imgUrl = randomImage(images);
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
              '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
              '│\n' +
              '│ 🔞 *Rule34*\n' +
              `│ 📦 Pool: ${images.length} imágenes\n` +
              '│\n' +
              '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
          }, { quoted: msg });

          enviado = true;
        } catch (e) {
          console.error(`[rule34] intento ${intentos + 1} falló:`, e.message);
          intentos++;
        }
      }

      if (!enviado) {
        await sock.sendMessage(jid, {
          text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ No se pudo cargar la imagen\n│ después de 3 intentos.\n│ Intenta de nuevo.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
        }, { quoted: msg });
      }

      return;
    }

    return sock.sendMessage(jid, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        '│ 📋 *Comandos Rule34:*\n' +
        '│\n' +
        '│ *.rule34*           → imagen aleatoria\n' +
        '│ *.rule34 on*        → activar en grupo\n' +
        '│ *.rule34 off*       → desactivar en grupo\n' +
        '│ *.rule34 add <url>* → agregar imagen\n' +
        '│ *.rule34 clear*     → eliminar todos los links\n' +
        '│ *.rule34 list*      → ver total\n' +
        '│\n' +
        '│ ⚠️ _on/off/add/clear requiere ser administrador u owner_\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: msg });
  }
};