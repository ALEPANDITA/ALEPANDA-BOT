const { leerDB, guardarDB, getGrupo } = require('../../lib/db');

module.exports = [
  {
    name: 'bienvenida',
    category: 'general',
    description: 'Activa/desactiva bienvenida (ej: .bienvenida on/off)',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const valor = texto.slice((prefix + 'bienvenida ').length).trim().toLowerCase();
      const db = leerDB();
      const grupo = getGrupo(db, jid);

      if (valor === 'on') {
        grupo.bienvenida = true;
        guardarDB(db);
        return sock.sendMessage(jid, { text: 'Bienvenida activada.' });
      }
      if (valor === 'off') {
        grupo.bienvenida = false;
        guardarDB(db);
        return sock.sendMessage(jid, { text: 'Bienvenida desactivada.' });
      }

      await sock.sendMessage(jid, { text: `Uso: ${prefix}bienvenida on/off` });
    }
  },
  {
    name: 'setbienvenida',
    category: 'general',
    description: 'Cambia el texto de bienvenida. Usa {user} {group} {desc}',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const nuevoTexto = texto.slice((prefix + 'setbienvenida ').length).trim();
      if (!nuevoTexto) {
        return sock.sendMessage(jid, {
          text: `Uso: ${prefix}setbienvenida <texto>\nPlaceholders: {user} {group} {desc}\nEjemplo: ${prefix}setbienvenida Bienvenido {user} a {group}!`
        });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);
      grupo.textoBienvenida = nuevoTexto;
      guardarDB(db);

      await sock.sendMessage(jid, { text: 'Texto de bienvenida actualizado.' });
    }
  },
  {
    name: 'setbienvenidaimg',
    category: 'general',
    description: 'Cambia la imagen de bienvenida (responde a una imagen)',
    groupOnly: true,
    execute: async (sock, jid, msg) => {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const fs = require('fs');
      const path = require('path');

      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;

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
        const imgPath = path.join(__dirname, '..', '..', 'assets', 'bienvenida', `${jid.replace('@g.us', '')}.jpg`);
        fs.writeFileSync(imgPath, buffer);
        await sock.sendMessage(jid, { text: 'Imagen de bienvenida guardada.' });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo guardar la imagen.' });
      }
    }
  },
  {
    name: 'delbienvenidaimg',
    category: 'general',
    description: 'Elimina la imagen de bienvenida configurada',
    groupOnly: true,
    execute: async (sock, jid, msg) => {
      const fs = require('fs');
      const path = require('path');

      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const imgPath = path.join(__dirname, '..', '..', 'assets', 'bienvenida', `${jid.replace('@g.us', '')}.jpg`);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
        return sock.sendMessage(jid, { text: 'Imagen de bienvenida eliminada.' });
      }

      await sock.sendMessage(jid, { text: 'No hay ninguna imagen configurada.' });
    }
  },
  {
    name: 'desc',
    category: 'general',
    description: 'Activa/desactiva el uso de la descripcion del grupo en la bienvenida',
    groupOnly: true,
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const metadata = await sock.groupMetadata(jid);
      const remitente = msg.key.participant;
      const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;

      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
      }

      const valor = texto.slice((prefix + 'desc ').length).trim().toLowerCase();
      const db = leerDB();
      const grupo = getGrupo(db, jid);

      if (valor === 'on') {
        grupo.usarDescripcion = true;
        guardarDB(db);
        return sock.sendMessage(jid, { text: 'La descripcion del grupo se incluira en la bienvenida.' });
      }
      if (valor === 'off') {
        grupo.usarDescripcion = false;
        guardarDB(db);
        return sock.sendMessage(jid, { text: 'La descripcion del grupo ya no se incluira en la bienvenida.' });
      }

      await sock.sendMessage(jid, { text: `Uso: ${prefix}desc on/off` });
    }
  }
];
