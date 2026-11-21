const fs = require('fs');
const path = require('path');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const TEMAS = { rosa: '🌸', azul: '💙', morado: '💜', verde: '💚', rojo: '❤️', dorado: '✨', negro: '🖤', naranja: '🧡', amarillo: '💛' };
const MARCOS = ['circulo', 'cuadrado', 'hexagono', 'diamante', 'corazon', 'estrella'];
const EMOJI = /^[\p{Extended_Pictographic}\u200d\ufe0f]{1,8}$/u;
const CARPETA_FOTOS = path.join(__dirname, '..', '..', 'database', 'perfil-fotos');
const num = (j) => String(j || '').split('@')[0].split(':')[0];

function desenvolver(m) {
  if (!m) return null;
  return m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message || m;
}
function imagenDelMensaje(msg) {
  const propio = desenvolver(msg.message);
  if (propio?.imageMessage) return propio;
  const ci = propio?.extendedTextMessage?.contextInfo || propio?.imageMessage?.contextInfo;
  const citado = desenvolver(ci?.quotedMessage);
  if (citado?.imageMessage) return citado;
  return null;
}

module.exports = {
  name: 'editarperfil',
  aliases: ['setperfil'],
  category: 'perfil',
  description: 'Personaliza tu perfil: tema, titulo, emoji, nombre, foto y marco. Uso: .editarperfil foto | nombre Panda | marco corazon',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = String(texto || '').trim().split(/\s+/).slice(1);
    const opcion = (partes[0] || '').toLowerCase();
    const valor = partes.slice(1).join(' ').trim();
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const quitar = /^(quitar|borrar|reset|restaurar)$/i;

    if (opcion === 'tema' || opcion === 'color') {
      const t = valor.toLowerCase();
      if (!TEMAS[t]) return responder('Elige un color: ' + Object.keys(TEMAS).join(', ') + '\nEj: ' + prefix + 'editarperfil tema rosa');
      usuario.perfilTema = t;
      guardarDB(db);
      return responder(TEMAS[t] + ' Tema de tu perfil cambiado a *' + t + '*. Míralo con ' + prefix + 'perfil');
    }
    if (opcion === 'titulo' || opcion === 'título') {
      if (!valor || quitar.test(valor)) {
        usuario.perfilTitulo = null;
        guardarDB(db);
        return responder('🏷️ Título quitado de tu perfil.');
      }
      if (valor.length > 30) return responder('El título es muy largo (máximo 30 caracteres).');
      usuario.perfilTitulo = valor;
      guardarDB(db);
      return responder('🏷️ Título guardado: *' + valor + '*. Míralo con ' + prefix + 'perfil');
    }
    if (opcion === 'emoji') {
      if (quitar.test(valor)) {
        usuario.perfilEmoji = null;
        guardarDB(db);
        return responder('Emoji quitado de tu perfil.');
      }
      if (!EMOJI.test(valor)) return responder('Manda un solo emoji.\nEj: ' + prefix + 'editarperfil emoji 🐼');
      usuario.perfilEmoji = valor;
      guardarDB(db);
      return responder(valor + ' Emoji de tu perfil guardado. Míralo con ' + prefix + 'perfil');
    }
    if (opcion === 'nombre') {
      if (!valor || quitar.test(valor)) {
        usuario.perfilNombre = null;
        guardarDB(db);
        return responder('✏️ Nombre personalizado quitado. Se usará tu nombre normal.');
      }
      if (valor.length > 25) return responder('El nombre es muy largo (máximo 25 caracteres).');
      usuario.perfilNombre = valor;
      guardarDB(db);
      return responder('✏️ Tu perfil ahora se llama *' + valor + '*. Míralo con ' + prefix + 'perfil');
    }
    if (opcion === 'marco' || opcion === 'forma') {
      const m = valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (quitar.test(m)) {
        usuario.perfilMarco = null;
        guardarDB(db);
        return responder('🖼️ Marco restaurado a circulo.');
      }
      if (!MARCOS.includes(m)) return responder('🖼️ Elige un marco: ' + MARCOS.join(', ') + '\nEj: ' + prefix + 'editarperfil marco corazon');
      usuario.perfilMarco = m;
      guardarDB(db);
      return responder('🖼️ Marco de tu foto: *' + m + '*. Míralo con ' + prefix + 'perfil');
    }
    if (opcion === 'banner' || opcion === 'portada' || opcion === 'fondo') {
      if (quitar.test(valor)) {
        try { if (usuario.perfilBanner) fs.unlinkSync(path.join(CARPETA_FOTOS, usuario.perfilBanner)); } catch (_) {}
        usuario.perfilBanner = null;
        guardarDB(db);
        return responder('🖼️ Banner quitado de tu perfil.');
      }
      const fuenteB = imagenDelMensaje(msg);
      if (!fuenteB) return responder('🖼️ Envía una imagen con el comando en el pie de foto, o responde a una imagen con *' + prefix + 'editarperfil banner*.\n_Será el fondo de toda tu tarjeta (va mejor una imagen vertical o cuadrada)._\nPara quitarlo: ' + prefix + 'editarperfil banner quitar');
      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const bufferB = await downloadMediaMessage({ message: fuenteB }, 'buffer', {});
        const Jimp = require('jimp');
        const imgB = await Jimp.read(bufferB);
        imgB.scaleToFit(1400, 1400).quality(85);
        const salidaB = await imgB.getBufferAsync(Jimp.MIME_JPEG);
        fs.mkdirSync(CARPETA_FOTOS, { recursive: true });
        const archivoB = 'banner-' + num(remitente) + '.jpg';
        fs.writeFileSync(path.join(CARPETA_FOTOS, archivoB), salidaB);
        usuario.perfilBanner = archivoB;
        guardarDB(db);
        return responder('🖼️ Banner guardado. Míralo con ' + prefix + 'perfil');
      } catch (err) {
        console.error('[editarperfil banner]', err && err.message ? err.message : err);
        return responder('No pude guardar el banner. Prueba con otra imagen.');
      }
    }
    if (opcion === 'foto' || opcion === 'imagen') {
      if (quitar.test(valor)) {
        try { if (usuario.perfilFoto) fs.unlinkSync(path.join(CARPETA_FOTOS, usuario.perfilFoto)); } catch (_) {}
        usuario.perfilFoto = null;
        guardarDB(db);
        return responder('📷 Foto personalizada quitada. Se usará tu foto de WhatsApp.');
      }
      const fuente = imagenDelMensaje(msg);
      if (!fuente) return responder('📷 Envía una imagen con el comando en el pie de foto, o responde a una imagen con *' + prefix + 'editarperfil foto*.\nPara volver a tu foto de WhatsApp: ' + prefix + 'editarperfil foto quitar');
      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const buffer = await downloadMediaMessage({ message: fuente }, 'buffer', {});
        const Jimp = require('jimp');
        const img = await Jimp.read(buffer);
        img.cover(512, 512).quality(88);
        const salida = await img.getBufferAsync(Jimp.MIME_JPEG);
        fs.mkdirSync(CARPETA_FOTOS, { recursive: true });
        const archivo = num(remitente) + '.jpg';
        fs.writeFileSync(path.join(CARPETA_FOTOS, archivo), salida);
        usuario.perfilFoto = archivo;
        guardarDB(db);
        return responder('📷 Foto de perfil guardada. Míralo con ' + prefix + 'perfil');
      } catch (err) {
        console.error('[editarperfil foto]', err && err.message ? err.message : err);
        return responder('No pude guardar la foto. Prueba con otra imagen.');
      }
    }

    return responder(
      '🎨 *EDITAR PERFIL*\n\n' +
      '• ' + prefix + 'editarperfil foto\n   _Envía o responde a una imagen. "quitar" vuelve a tu foto de WhatsApp_\n' +
      '• ' + prefix + 'editarperfil nombre <texto>\n   _El nombre que sale en tu tarjeta (máx. 25)_\n' +
      '• ' + prefix + 'editarperfil banner\n   _Envía o responde a una imagen: será el fondo de tu tarjeta. "quitar" la borra_\n' +
      '• ' + prefix + 'editarperfil marco <forma>\n   _Formas: ' + MARCOS.join(', ') + '_\n' +
      '• ' + prefix + 'editarperfil tema <color>\n   _Colores: ' + Object.keys(TEMAS).join(', ') + '_\n' +
      '• ' + prefix + 'editarperfil titulo <texto>\n   _Un título debajo de tu nombre (máx. 30)_\n' +
      '• ' + prefix + 'editarperfil emoji <emoji>\n\n' +
      'También: ' + prefix + 'setdesc, ' + prefix + 'setgenre y ' + prefix + 'setbirth.\n\n' +
      'Ahora: tema *' + (usuario.perfilTema || 'rosa') + '* · marco *' + (usuario.perfilMarco || 'circulo') + '*' +
      (usuario.perfilNombre ? ' · nombre *' + usuario.perfilNombre + '*' : '') +
      (usuario.perfilFoto ? ' · foto propia' : '') +
      (usuario.perfilBanner ? ' · banner' : '') +
      (usuario.perfilTitulo ? ' · título *' + usuario.perfilTitulo + '*' : '') +
      (usuario.perfilEmoji ? ' · emoji ' + usuario.perfilEmoji : '')
    );
  }
};
