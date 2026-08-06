const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const IMAGES_PATH = join(__dirname, '../../database/rule34_images.json');
const STATE_PATH = join(__dirname, '../../database/rule34_state.json');

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

module.exports = {
  name: 'rule34',
  category: 'animeimg',
  description: 'Imágenes Rule34 por grupo (ej: .rule34, .rule34 on/off/add/del/list/clear)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    const sub = (args[0] || '').toLowerCase();
    
    // Validar permisos de administrador o owner
    const sender = msg.key.participant || msg.key.remoteJid;
    const groupMetadata = jid.endsWith('@g.us') ? await sock.groupMetadata(jid).catch(() => null) : null;
    const isAdmin = groupMetadata ? groupMetadata.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')) : false;
    const isOwner = global.owner?.some(o => sender.includes(o[0])) || false;

    const images = loadImages();
    const state = loadState();

    if (sub === 'on') {
      if (!isAdmin && !isOwner) {
        return sock.sendMessage(jid, { text: '❌ Solo los administradores o el owner pueden activar esto.' }, { quoted: msg });
      }
      state[jid] = true;
      saveState(state);
      return sock.sendMessage(jid, { text: '✅ Rule34 ACTIVADO en este grupo.' }, { quoted: msg });
    }

    if (sub === 'off') {
      if (!isAdmin && !isOwner) {
        return sock.sendMessage(jid, { text: '❌ Solo los administradores o el owner pueden desactivar esto.' }, { quoted: msg });
      }
      state[jid] = false;
      saveState(state);
      return sock.sendMessage(jid, { text: '🔴 Rule34 DESACTIVADO en este grupo.' }, { quoted: msg });
    }

    if (sub === 'add') {
      if (!isAdmin && !isOwner) {
        return sock.sendMessage(jid, { text: '❌ Solo los administradores o el owner pueden agregar imágenes.' }, { quoted: msg });
      }
      const url = args[1];
      if (!url || !isValidImageUrl(url)) {
        return sock.sendMessage(jid, { text: `⚠️ URL inválida o faltante.\nUso: ${prefix}rule34 add <url>` }, { quoted: msg });
      }
      if (images.includes(url)) {
        return sock.sendMessage(jid, { text: '⚠️ Esa imagen ya está en la lista.' }, { quoted: msg });
      }
      images.push(url);
      saveImages(images);
      return sock.sendMessage(jid, { text: `✅ Imagen agregada correctamente.\n📦 Total: ${images.length} imágenes` }, { quoted: msg });
    }

    if (sub === 'del' || sub === 'eliminar') {
      if (!isAdmin && !isOwner) {
        return sock.sendMessage(jid, { text: '❌ Solo los administradores o el owner pueden eliminar imágenes.' }, { quoted: msg });
      }
      const url = args[1];
      if (!url) {
        return sock.sendMessage(jid, { text: `⚠️ Faltó la URL.\nUso: ${prefix}rule34 del <url>` }, { quoted: msg });
      }
      const index = images.indexOf(url);
      if (index === -1) {
        return sock.sendMessage(jid, { text: '⚠️ La imagen no se encuentra en la lista.' }, { quoted: msg });
      }
      images.splice(index, 1);
      saveImages(images);
      return sock.sendMessage(jid, { text: `✅ Imagen eliminada correctamente.\n📦 Total restante: ${images.length} imágenes` }, { quoted: msg });
    }

    if (sub === 'clear') {
      if (!isOwner) {
        return sock.sendMessage(jid, { text: '❌ Solo el owner puede vaciar la lista de imágenes.' }, { quoted: msg });
      }
      saveImages([]);
      return sock.sendMessage(jid, { text: '🧹 Lista de imágenes limpiada por completo.' }, { quoted: msg });
    }

    if (sub === 'list') {
      return sock.sendMessage(jid, { text: `📦 Imágenes en lista: ${images.length}\n🔴/✅ Estado aquí: ${state[jid] ? 'ACTIVO' : 'INACTIVO'}` }, { quoted: msg });
    }

    if (sub === '') {
      if (!state[jid]) {
        return sock.sendMessage(jid, { text: `🔴 Rule34 está desactivado en este grupo.\nUn admin puede activarlo con: ${prefix}rule34 on` }, { quoted: msg });
      }
      if (images.length === 0) {
        return sock.sendMessage(jid, { text: `⚠️ No hay imágenes en la lista. Agrega con ${prefix}rule34 add <url>` }, { quoted: msg });
      }

      try {
        const imgUrl = randomImage(images);
        const res = await fetch(imgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
          caption: `🔞 Rule34\n📦 Pool: ${images.length} imágenes`
        }, { quoted: msg });
      } catch (e) {
        console.error(e);
        return sock.sendMessage(jid, { text: '❌ No se pudo cargar la imagen.' }, { quoted: msg });
      }
      return;
    }

    return sock.sendMessage(jid, { text: `📋 Comandos Rule34:\n- ${prefix}rule34\n- ${prefix}rule34 on/off\n- ${prefix}rule34 add <url>\n- ${prefix}rule34 del <url>\n- ${prefix}rule34 list\n- ${prefix}rule34 clear (solo owner)` }, { quoted: msg });
  }
};