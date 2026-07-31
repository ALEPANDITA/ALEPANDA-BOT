const fs = require('fs');
const path = require('path');
const { leerDB, guardarDB, getGrupo } = require('../../lib/db');

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

async function esAdmin(sock, jid, msg) {
  const metadata = await sock.groupMetadata(jid);
  const remitente = msg.key.participant;
  return !!metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;
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

function comandoMulti(tipo) {
  const nombre = tipo === 'welcome' ? 'welcomemulti' : 'byemulti';
  const etiqueta = tipo === 'welcome' ? 'bienvenida' : 'despedida';

  return {
    name: nombre,
    category: 'admin',
    description: `Configura la imagen/video/gif de ${etiqueta}. Responde a la media con este comando, usa ${nombre} texto para quitarla, o ${nombre} auto para volver al generador automatico con foto+datos.`,
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdmin(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const argumento = texto.slice((prefix + nombre).length).trim().toLowerCase();

      if (argumento === 'auto' || argumento === 'default') {
        const ruta = rutaMedia(tipo, jid);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

        const db = leerDB();
        const grupo = getGrupo(db, jid);
        if (tipo === 'welcome') delete grupo.welcomeMediaType;
        else delete grupo.byeMediaType;
        guardarDB(db);

        return sock.sendMessage(jid, { text: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} puesta de vuelta en modo automatico (imagen con foto de perfil, miembros, fecha y hora).` });
      }

      if (argumento === 'texto') {
        const ruta = rutaMedia(tipo, jid);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

        const db = leerDB();
        const grupo = getGrupo(db, jid);
        if (tipo === 'welcome') grupo.welcomeMediaType = 'texto';
        else grupo.byeMediaType = 'texto';
        guardarDB(db);

        return sock.sendMessage(jid, { text: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} puesta en solo texto.` });
      }

      if (argumento === 'default' || argumento === 'original') {
        const ruta = rutaMedia(tipo, jid);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

        const db = leerDB();
        const grupo = getGrupo(db, jid);
        if (tipo === 'welcome') delete grupo.welcomeMediaType;
        else delete grupo.byeMediaType;
        guardarDB(db);

        return sock.sendMessage(jid, { text: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} restaurada a la imagen original de fabrica (bosque de bambu).` });
      }

      const media = obtenerMediaCitada(msg);
      if (!media) {
        return sock.sendMessage(jid, {
          text: `Responde (o envia junto) una imagen, video o gif con ${prefix}${nombre}\nUsa ${prefix}${nombre} texto para quitar la media.\nUsa ${prefix}${nombre} auto para volver a la imagen automatica con foto de perfil, miembros, fecha y hora.`
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

        await sock.sendMessage(jid, { text: `✅ Media de ${etiqueta} guardada (tipo: ${media.tipo}).` });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo guardar la media. Intenta de nuevo.' });
      }
    }
  };
}

function comandoTexto(tipo) {
  const nombre = tipo === 'welcome' ? 'setwelcome' : 'setbye';
  const etiqueta = tipo === 'welcome' ? 'bienvenida' : 'despedida';

  return {
    name: nombre,
    category: 'admin',
    description: `Cambia el texto de ${etiqueta}. Usa #numberuser# #decgrupo# #namegp# #hora# #numerobot# #prefijo#`,
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdmin(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const nuevoTexto = texto.slice((prefix + nombre + ' ').length).trim();
      if (!nuevoTexto) {
        return sock.sendMessage(jid, {
          text: `Uso: ${prefix}${nombre} <texto>\nPlaceholders: #numberuser# #decgrupo# #namegp# #hora# #numerobot# #prefijo#\nEjemplo: ${prefix}${nombre} 🐼 #numberuser# llego al clan de #namegp#`
        });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);
      if (tipo === 'welcome') grupo.textoBienvenida = nuevoTexto;
      else grupo.textoDespedida = nuevoTexto;
      guardarDB(db);

      await sock.sendMessage(jid, { text: `Texto de ${etiqueta} actualizado.` });
    }
  };
}

module.exports = [
  {
    name: 'welcome',
    category: 'admin',
    description: 'Activa (on) o desactiva (off) bienvenida y despedida juntas. Uso: .welcome on / .welcome off',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      if (!(await esAdmin(sock, jid, msg))) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const valor = texto.slice((prefix + 'welcome ').length).trim().toLowerCase();
      if (valor !== 'on' && valor !== 'off') {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}welcome on (activar) / ${prefix}welcome off (desactivar)` });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);
      grupo.bienvenida = valor === 'on';
      grupo.despedida = valor === 'on';
      guardarDB(db);

      await sock.sendMessage(jid, { text: valor === 'on' ? '✅ Bienvenida y despedida activadas.' : '❌ Bienvenida y despedida desactivadas.' });
    }
  },

  comandoTexto('welcome'),
  comandoMulti('welcome'),

  comandoTexto('bye'),
  comandoMulti('bye')
];
