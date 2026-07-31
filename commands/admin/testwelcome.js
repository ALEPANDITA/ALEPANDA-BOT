const { leerConfig } = require('../../lib/config');
const { leerDB, getGrupo } = require('../../lib/db');
const { construirTexto, construirPayloadEnvio, obtenerMediaGuardada, obtenerFotoPerfilSegura } = require('../../lib/bienvenidapro');

async function esAdmin(sock, jid, msg) {
  const metadata = await sock.groupMetadata(jid);
  const remitente = msg.key.participant || msg.key.remoteJid;
  return !!metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;
}

module.exports = {
  name: 'testwelcome',
  category: 'admin',
  description: 'Simula un mensaje de bienvenida con tus propios datos, para ver como se ve sin que nadie tenga que entrar de verdad.',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    if (!(await esAdmin(sock, jid, msg))) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const inicio = Date.now();
    const remitente = msg.key.participant || msg.key.remoteJid;

    let metadata;
    try {
      metadata = await sock.groupMetadata(jid);
    } catch (err) {
      return sock.sendMessage(jid, { text: 'No pude leer la info del grupo, intenta de nuevo.' });
    }

    let numero = remitente.split('@')[0];
    if (!remitente.endsWith('@s.whatsapp.net')) {
      const info = metadata.participants.find(p => p.id === remitente || p.lid === remitente);
      const real = info?.phoneNumber || info?.id;
      if (real) numero = real.split('@')[0];
    }
    const tMetadata = Date.now();

    const config = leerConfig();
    const db = leerDB();
    const grupo = getGrupo(db, jid);

    const plantilla = grupo.textoBienvenida || 'Bienvenido/a {user} al grupo {group}!';
    const texto = construirTexto(plantilla, { numero, metadata, sock, prefix: config.prefix });

    const fotoBuffer = await obtenerFotoPerfilSegura(sock, remitente);
    const tFoto = Date.now();

    const { buffer, tipoMedia } = await obtenerMediaGuardada('welcome', jid, grupo, {
      fotoBuffer,
      nombreGrupo: metadata.subject,
      totalMiembros: metadata.participants.length,
      numero
    });
    const tGenerar = Date.now();

    const payload = construirPayloadEnvio(tipoMedia, buffer, texto);
    await sock.sendMessage(jid, { ...payload, mentions: [remitente] });
    const tEnvio = Date.now();

    console.log(
      `[testwelcome] metadata grupo: ${tMetadata - inicio}ms | ` +
      `foto de perfil (con timeout): ${tFoto - tMetadata}ms | ` +
      `generar imagen: ${tGenerar - tFoto}ms | ` +
      `enviar a WhatsApp: ${tEnvio - tGenerar}ms | ` +
      `TOTAL: ${tEnvio - inicio}ms`
    );
  }
};
