const fs = require('fs');
const path = require('path');
const { leerDB, guardarDB, getGrupo } = require('../../lib/db');

const TIPOS_VALIDOS = ['texto', 'imagen', 'video', 'gif', 'audio', 'sticker'];
const LIMITE_VIDEO_GIF = 10;
const LIMITE_AUDIO = 40;

function carpetaMedia(tipo) {
  const carpeta = path.join(__dirname, '..', '..', 'assets', tipo === 'welcome' ? 'bienvenida' : 'despedida');
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
  return carpeta;
}

function rutaMedia(tipo, jid) {
  return path.join(carpetaMedia(tipo), `${jid.replace('@g.us', '')}.media`);
}

async function esAdminOChecker(sock, jid, msg) {
  const metadata = await sock.groupMetadata(jid);
  const remitente = msg.key.participant;
  return !!metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;
}

function construirTexto(plantilla, { numero, metadata, sock, prefix }) {
  const numerobot = (sock.user?.id || '').split(':')[0].split('@')[0];
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return String(plantilla)
    .replace(/#hora#/g, hora)
    .replace(/#namegp#/g, metadata.subject || '')
    .replace(/#numberuser#/g, `@${numero}`)
    .replace(/#numerobot#/g, numerobot)
    .replace(/#prefijo#/g, prefix)
    .replace(/#decgrupo#/g, metadata.desc || '')
    .replace(/\{user\}/g, `@${numero}`)
    .replace(/\{group\}/g, metadata.subject || '')
    .replace(/\{desc\}/g, metadata.desc || '');
}

function obtenerMediaCitada(msg) {
  const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const fuente = citado || msg.message;
  if (!fuente) return null;

  if (fuente.imageMessage) return { tipo: 'imagen', mensaje: fuente, seconds: null };
  if (fuente.videoMessage) {
    const esGif = !!fuente.videoMessage.gifPlayback;
    return { tipo: esGif ? 'gif' : 'video', mensaje: fuente, seconds: fuente.videoMessage.seconds || 0 };
  }
  if (fuente.audioMessage) return { tipo: 'audio', mensaje: fuente, seconds: fuente.audioMessage.seconds || 0 };
  if (fuente.stickerMessage) return { tipo: 'sticker', mensaje: fuente, seconds: null };
  return null;
}

function comandoSetMedia(tipo) {
  const nombre = tipo === 'welcome' ? 'setwelcome' : 'setbye';
  return {
    name: nombre,
    category: 'admin',
    description: `Guarda la media (imagen/video/gif/audio/sticker) de ${tipo === 'welcome' ? 'bienvenida' : 'despedida'}. Responde a la media con este comando.`,
    groupOnly: true,
    execute: async (sock, jid, msg, { prefix }) => {
      if (!(await esAdminOChecker(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const media = obtenerMediaCitada(msg);
      if (!media) {
        return sock.sendMessage(jid, {
          text: `Responde (o envia junto) una imagen, video, gif, audio o sticker con el comando ${prefix}${nombre}`
        });
      }

      if ((media.tipo === 'video' || media.tipo === 'gif') && media.seconds > LIMITE_VIDEO_GIF) {
        return sock.sendMessage(jid, { text: `⚠️ El video/gif dura ${media.seconds}s, el maximo permitido es ${LIMITE_VIDEO_GIF}s.` });
      }
      if (media.tipo === 'audio' && media.seconds > LIMITE_AUDIO) {
        return sock.sendMessage(jid, { text: `⚠️ El audio dura ${media.seconds}s, el maximo permitido es ${LIMITE_AUDIO}s.` });
      }

      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      try {
        const buffer = await downloadMediaMessage({ message: media.mensaje }, 'buffer', {});
        fs.writeFileSync(rutaMedia(tipo, jid), buffer);

        const db = leerDB();
        const grupo = getGrupo(db, jid);
        if (tipo === 'welcome') grupo.welcomeMediaType = media.tipo;
        else grupo.byeMediaType = media.tipo;
        guardarDB(db);

        await sock.sendMessage(jid, {
          text: `✅ Media de ${tipo === 'welcome' ? 'bienvenida' : 'despedida'} guardada (tipo detectado: ${media.tipo}).\nSi quieres forzar otro tipo usa ${prefix}${tipo === 'welcome' ? 'tipowelcome' : 'tipobye'} <tipo>.`
        });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo guardar la media. Intenta de nuevo.' });
      }
    }
  };
}

function comandoTipoMedia(tipo) {
  const nombre = tipo === 'welcome' ? 'tipowelcome' : 'tipobye';
  const nombreSet = tipo === 'welcome' ? 'setwelcome' : 'setbye';
  return {
    name: nombre,
    category: 'admin',
    description: `Declara el tipo de media de ${tipo === 'welcome' ? 'bienvenida' : 'despedida'} (debe coincidir con lo guardado en ${nombreSet}), o pon "texto" para volver a solo texto.`,
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdminOChecker(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const valor = texto.slice((prefix + nombre + ' ').length).trim().toLowerCase();
      if (!TIPOS_VALIDOS.includes(valor)) {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}${nombre} <${TIPOS_VALIDOS.join('/')}>` });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);

      if (valor === 'texto') {
        const ruta = rutaMedia(tipo, jid);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      }

      if (tipo === 'welcome') grupo.welcomeMediaType = valor;
      else grupo.byeMediaType = valor;
      guardarDB(db);

      await sock.sendMessage(jid, { text: `Tipo de ${tipo === 'welcome' ? 'bienvenida' : 'despedida'} puesto en: ${valor}` });
    }
  };
}

function comandoTexto(tipo) {
  const nombre = tipo === 'welcome' ? 'textwelcome' : 'textbye';
  return {
    name: nombre,
    category: 'admin',
    description: `Cambia el texto de ${tipo === 'welcome' ? 'bienvenida' : 'despedida'}. Usa #hora# #namegp# #numberuser# #numerobot# #prefijo# #decgrupo#`,
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdminOChecker(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const nuevoTexto = texto.slice((prefix + nombre + ' ').length).trim();
      if (!nuevoTexto) {
        return sock.sendMessage(jid, {
          text: `Uso: ${prefix}${nombre} <texto>\nParametros: #hora# #namegp# #numberuser# #numerobot# #prefijo# #decgrupo#\nEjemplo: ${prefix}${nombre} 👋 Hola #numberuser# bienvenido a #namegp#`
        });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);
      if (tipo === 'welcome') grupo.textoBienvenida = nuevoTexto;
      else grupo.textoDespedida = nuevoTexto;
      guardarDB(db);

      await sock.sendMessage(jid, { text: `Texto de ${tipo === 'welcome' ? 'bienvenida' : 'despedida'} actualizado.` });
    }
  };
}

module.exports = [
  {
    name: 'welcome',
    category: 'admin',
    description: 'Activa (1) o desactiva (0) bienvenida Y despedida juntas. Uso: .welcome 1 / .welcome 0',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdminOChecker(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const valor = texto.slice((prefix + 'welcome ').length).trim();
      if (valor !== '1' && valor !== '0') {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}welcome 1 (activar) / ${prefix}welcome 0 (desactivar)` });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);
      grupo.bienvenida = valor === '1';
      grupo.despedida = valor === '1';
      guardarDB(db);

      await sock.sendMessage(jid, { text: valor === '1' ? '✅ Bienvenida y despedida activadas.' : '❌ Bienvenida y despedida desactivadas.' });
    }
  },

  comandoSetMedia('welcome'),
  comandoTipoMedia('welcome'),
  comandoTexto('welcome'),

  comandoSetMedia('bye'),
  comandoTipoMedia('bye'),
  comandoTexto('bye'),

  {
    name: 'infowelcome',
    category: 'admin',
    description: 'Muestra la guia completa del sistema de bienvenida/despedida.',
    execute: async (sock, jid, msg, { prefix }) => {
      const guia = `╭───〔 🚀 SISTEMA DE BIENVENIDA PRO 〕───╮

🧑‍🚀 Aqui aprendes a configurar bienvenida y despedida.

➤ Activar/desactivar ambas a la vez:
➜ ${prefix}welcome 1  (activa)
➜ ${prefix}welcome 0  (desactiva)

━━━━━━━━━━━━━━━━━━
🖼️ CONFIGURAR MEDIA (AUTO)
━━━━━━━━━━━━━━━━━━
➤ Responde a cualquier media con:
➜ ${prefix}setwelcome   (para bienvenida)
➜ ${prefix}setbye       (para despedida)

✅ Detecta automaticamente: imagen, video, gif, audio, sticker

⚠️ LIMITES:
✦ Video/GIF → maximo ${LIMITE_VIDEO_GIF} segundos
✦ Audio → maximo ${LIMITE_AUDIO} segundos

👀 Luego de guardar la media, declara el tipo con:
➜ ${prefix}tipowelcome <tipo>
➜ ${prefix}tipobye <tipo>
(tipos: ${TIPOS_VALIDOS.join(', ')})

Si el tipo declarado no coincide con la media guardada, el envio puede fallar.

➤ Volver a solo texto (borra la media guardada):
➜ ${prefix}tipowelcome texto
➜ ${prefix}tipobye texto

━━━━━━━━━━━━━━━━━━
✍️ CAMBIAR TEXTO
━━━━━━━━━━━━━━━━━━
➜ ${prefix}textwelcome tu mensaje
➜ ${prefix}textbye tu mensaje

✅ Imagen/video/gif → el texto se muestra como caption
✅ Audio/sticker → no incluyen texto (solo se envia la media)

━━━━━━━━━━━━━━━━━━
🔧 PARAMETROS DINAMICOS
━━━━━━━━━━━━━━━━━━
✦ #hora# → hora actual
✦ #namegp# → nombre del grupo
✦ #numberuser# → usuario que entra/sale
✦ #numerobot# → numero del bot
✦ #prefijo# → prefijo actual
✦ #decgrupo# → descripcion del grupo

🧠 Ejemplo:
${prefix}textwelcome 👋 Hola #numberuser# bienvenido a #namegp#

💡 Consejo: usa un GIF corto + texto, o una imagen llamativa, para mas impacto 🚀`;

      await sock.sendMessage(jid, { text: guia });
    }
  }
];
