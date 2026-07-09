const { leerConfig } = require('../../lib/config');

function normalizarJid(jid) {
  if (!jid) return jid;
  return jid.split(':')[0].replace(/@lid$/, '@s.whatsapp.net');
}

module.exports = {
  name: 'restart',
  category: 'owner',
  description: 'Reinicia el bot (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const remitenteRaw = msg.key.participant || msg.key.remoteJid;
    const remitente = normalizarJid(remitenteRaw);

    console.log('--- DEBUG OWNER CHECK ---');
    console.log('remitenteRaw:', remitenteRaw);
    console.log('remitente normalizado:', remitente);
    console.log('msg.key completo:', JSON.stringify(msg.key, null, 2));
    console.log('config.owners (raw):', config.owners);

    const owners = (config.owners || []).map(normalizarJid);
    console.log('owners normalizados:', owners);
    console.log('¿coincide?:', owners.includes(remitente));
    console.log('-------------------------');

    if (!owners.includes(remitente)) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    await sock.sendMessage(jid, { text: '✎ Reiniciando el bot...\n> Espera un momento...' });
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  }
};
