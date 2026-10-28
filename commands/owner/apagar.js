const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, error: cajaError } = require('../../lib/estilo');
const apagados = require('../../lib/apagados');

function codigoDeLink(texto) {
  const m = /chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,32})/i.exec(String(texto || ''));
  return m ? m[1] : null;
}

// Devuelve { id, nombre } del grupo indicado por link, o el grupo actual si no hay link.
// Si no se puede, ya responde el error y devuelve null.
async function resolverGrupo(sock, jid, msg, texto) {
  const codigo = codigoDeLink(texto);

  if (!codigo) {
    if (jid.endsWith('@g.us')) {
      let nombre = '';
      try { nombre = (await sock.groupMetadata(jid)).subject || ''; } catch (_) {}
      return { id: jid, nombre };
    }
    return { faltaLink: true };
  }

  try {
    const info = await sock.groupGetInviteInfo(codigo);
    return { id: info.id, nombre: info.subject || '' };
  } catch (err) {
    await sock.sendMessage(jid, {
      text: cajaError('No pude abrir ese link. Revisa que sea del grupo y que no este vencido o reseteado.')
    }, { quoted: msg });
    return null;
  }
}

async function soloOwner(sock, jid, msg) {
  const ok = await esOwnerBot(sock, leerConfig(), msg);
  if (!ok) await sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) }, { quoted: msg });
  return ok;
}

const apagar = {
  name: 'apagar',
  aliases: ['apagargrupo', 'silenciarbot'],
  category: 'owner',
  description: 'Apaga el bot en un grupo: ahi no responde a nadie. Uso: .apagar <link del grupo> (o sin link, dentro del grupo). Se enciende con .encender (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    if (!(await soloOwner(sock, jid, msg))) return;

    const grupo = await resolverGrupo(sock, jid, msg, texto);
    if (!grupo) return;
    if (grupo.faltaLink) {
      return sock.sendMessage(jid, {
        text: advertencia(`Pasame el link del grupo.\nEjemplo: ${prefix}apagar https://chat.whatsapp.com/XXXXXXXX\n(o escribe ${prefix}apagar dentro del grupo)`, { titulo: 'FALTA EL LINK', estilo: 'neon' })
      }, { quoted: msg });
    }

    // Aviso de que el bot no esta en ese grupo (igual se guarda por si entra despues)
    let aviso = '';
    try {
      const todos = await sock.groupFetchAllParticipating();
      if (!todos[grupo.id]) aviso = '\n⚠️ Ojo: el bot no esta en ese grupo ahorita.';
    } catch (_) {}

    apagados.apagar(grupo.id, { nombre: grupo.nombre, por: (msg.key.participant || msg.key.remoteJid || '').split('@')[0] });

    const nombre = grupo.nombre ? `*${grupo.nombre}*` : 'ese grupo';
    const esteGrupo = grupo.id === jid;
    await sock.sendMessage(jid, {
      text: esteGrupo
        ? `🔇 Bot apagado en este grupo. No voy a responder a nadie aqui.\nUn owner me enciende con *${prefix}encender* (aqui mismo o con el link del grupo).`
        : `🔇 Apague el bot en ${nombre}. Ahi no responde a nadie.${aviso}\nPara encenderlo: *${prefix}encender <link del grupo>*`
    }, { quoted: msg });
  }
};

const encender = {
  name: 'encender',
  aliases: ['prender', 'encendergrupo', 'activargrupo'],
  category: 'owner',
  permiteApagado: true, // unico comando que se atiende en un grupo apagado
  description: 'Vuelve a encender el bot en un grupo que apagaste con .apagar. Uso: .encender <link del grupo> (o sin link, dentro del grupo) (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    if (!(await soloOwner(sock, jid, msg))) return;

    const grupo = await resolverGrupo(sock, jid, msg, texto);
    if (!grupo) return;
    if (grupo.faltaLink) {
      return sock.sendMessage(jid, {
        text: advertencia(`Pasame el link del grupo.\nEjemplo: ${prefix}encender https://chat.whatsapp.com/XXXXXXXX\n(o escribe ${prefix}encender dentro del grupo)`, { titulo: 'FALTA EL LINK', estilo: 'neon' })
      }, { quoted: msg });
    }

    const estaba = apagados.encender(grupo.id);
    const nombre = grupo.nombre ? `*${grupo.nombre}*` : 'ese grupo';
    await sock.sendMessage(jid, {
      text: estaba
        ? `🔊 Bot encendido en ${nombre}. Ya vuelvo a responder ahi.`
        : `ℹ️ El bot no estaba apagado en ${nombre}.`
    }, { quoted: msg });
  }
};

module.exports = [apagar, encender];
