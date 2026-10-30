const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const FRASES = [
  'Se acabó el cuento de hadas, ahora sí a vivir en paz. 🕊️',
  'Libres como el viento y con el WiFi solo para uno. 📶',
  'Uno más para el club de los solteros felices. 🥂',
  'Dicen que lo bueno dura poco... esto ni eso. ⏳',
  'El amor se fue, pero los memes quedan. 🤡',
  'Que alguien le avise al sofá que ya no hay que compartirlo. 🛋️',
  'Fue bonito mientras duró (nadie dijo cuánto). 💅',
  'A llorar a la regadera y mañana a ligar de nuevo. 🚿',
  'Y colorín colorado, este matrimonio se ha acabado. 📖',
  'Ni el algoritmo los pudo salvar. 🤖'
];

const MOTIVOS = [
  'Diferencias irreconciliables con el control de la tele',
  'Alguien dejó la tapa del baño arriba',
  'Falta de respuesta en los chats (visto desde hace 3 días)',
  'Uno quería pizza y el otro también, pero no se pusieron de acuerdo',
  'Se enteró de que el otro roncaba',
  'Ghosting en pleno aniversario',
  'Una discusión sobre piña en la pizza',
  'Mucha gente metida en el grupo opinando',
  'Simplemente ya no había química (ni ganas)'
];

const PENSIONES = [
  '3 memes diarios y un sticker de consuelo',
  'La mitad del WiFi y el 100% de los recuerdos',
  'Un helado de consolación (sabor a elegir)',
  'Visitas guiadas al perro los fines de semana',
  'Un audio de 5 minutos explicando todo (nadie lo escucha)',
  'La custodia compartida del grupo de WhatsApp'
];

const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

module.exports = {
  name: 'divorcio',
  aliases: ['divorciar', 'separar'],
  category: 'perfil',
  description: 'Termina tu matrimonio actual.',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    if (!perfil.pareja) {
      return sock.sendMessage(jid, {
        text: '🤷 *Ni casado/a estás* y ya quieres divorciarte.\nPrimero consigue pareja con *.casar @usuario*. 💍'
      }, { quoted: msg });
    }

    const parejaId = perfil.pareja;
    const perfilPareja = getUsuario(db, parejaId);

    perfil.pareja = null;
    perfilPareja.pareja = null;
    guardarDB(db);

    const a = remitente.split('@')[0];
    const b = parejaId.split('@')[0];

    const texto =
      '💔━━━━━━━━━━━━━━━━💔\n' +
      '   ⚖️ *DIVORCIO OFICIAL* ⚖️\n' +
      '💔━━━━━━━━━━━━━━━━💔\n\n' +
      `📜 @${a} y @${b}\n` +
      '🔓 ya no son pareja.\n\n' +
      '🪦 Su matrimonio descansa en paz.\n\n' +
      `🔨 *Motivo oficial:*\n   ${elegir(MOTIVOS)}\n\n` +
      `💸 *Pensión alimenticia:*\n   ${elegir(PENSIONES)}\n\n` +
      '━━━━━━━━━━━━━━━━━━\n' +
      `${elegir(FRASES)}`;

    await sock.sendMessage(jid, { text: texto, mentions: [remitente, parejaId] }, { quoted: msg });
  }
};
