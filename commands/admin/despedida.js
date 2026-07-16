const { leerDB, guardarDB, getGrupo } = require('../../lib/db');

module.exports = [
  {
    name: 'despedida',
    category: 'admin',
    description: 'Activa/desactiva despedida (ej: .despedida on/off)',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const valor = texto.slice((prefix + 'despedida ').length).trim().toLowerCase();
      const db = leerDB();
      const grupo = getGrupo(db, jid);

      if (valor === 'on') {
        grupo.despedida = true;
        guardarDB(db);
        return sock.sendMessage(jid, { text: 'Despedida activada.' });
      }
      if (valor === 'off') {
        grupo.despedida = false;
        guardarDB(db);
        return sock.sendMessage(jid, { text: 'Despedida desactivada.' });
      }

      await sock.sendMessage(jid, { text: `Uso: ${prefix}despedida on/off` });
    }
  },
  {
    name: 'setdespedida',
    category: 'admin',
    description: 'Cambia el texto de despedida. Usa {user} {group}',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const nuevoTexto = texto.slice((prefix + 'setdespedida ').length).trim();
      if (!nuevoTexto) {
        return sock.sendMessage(jid, {
          text: `Uso: ${prefix}setdespedida <texto>\nPlaceholders: {user} {group}\nEjemplo: ${prefix}setdespedida {user} se fue de {group}`
        });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);
      grupo.textoDespedida = nuevoTexto;
      guardarDB(db);

      await sock.sendMessage(jid, { text: 'Texto de despedida actualizado.' });
    }
  },
  {
    name: 'setdespedidaimg',
    category: 'admin',
    description: 'Cambia la imagen de despedida (responde a una imagen)',
    groupOnly: true,
    execute: async (sock, jid, msg) => {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const fs = require('fs');
      const path = require('path');

      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const mensajeConImagen = citado?.imageMessage ? { message: citado } : msg.message.imageMessage ? msg : null;

      if (!mensajeConImagen) {
        return sock.sendMessage(jid, { text: 'Responde a una imagen con este comando.' });
      }

      try {
        const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
        const imgPath = path.join(__dirname, '..', '..', 'assets', 'despedida', `${jid.replace('@g.us', '')}.jpg`);
        fs.writeFileSync(imgPath, buffer);
        await sock.sendMessage(jid, { text: 'Imagen de despedida guardada.' });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo guardar la imagen.' });
      }
    }
  },
  {
    name: 'deldespedidaimg',
    category: 'admin',
    description: 'Elimina la imagen de despedida configurada',
    groupOnly: true,
    execute: async (sock, jid, msg) => {
      const fs = require('fs');
      const path = require('path');

      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const imgPath = path.join(__dirname, '..', '..', 'assets', 'despedida', `${jid.replace('@g.us', '')}.jpg`);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
        return sock.sendMessage(jid, { text: 'Imagen de despedida eliminada.' });
      }

      await sock.sendMessage(jid, { text: 'No hay ninguna imagen configurada.' });
    }
  }
];
