function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function numeroRaro(segmentos, digitosMax) {
  const partes = [];
  for (let i = 0; i < segmentos; i++) {
    const digitos = Math.floor(Math.random() * digitosMax) + 2;
    let n = '';
    for (let j = 0; j < digitos; j++) n += Math.floor(Math.random() * 10);
    partes.push(n);
  }
  return partes.join('.');
}

function hexRaro(bloques) {
  const chars = '0123456789ABCDEFTACOÑ';
  const partes = [];
  for (let i = 0; i < bloques; i++) {
    let b = '';
    for (let j = 0; j < 4; j++) b += chars[Math.floor(Math.random() * chars.length)];
    partes.push(b);
  }
  return partes.join(':');
}

module.exports = {
  name: 'doxeo',
  category: 'fun',
  description: 'Genera un reporte falso y absurdo de "hackeo" de alguien, solo de broma (menciona o responde a la persona)',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;

    const objetivo = mencionado || citado || remitente;
    const numero = objetivo.split('@')[0];

    const marco = (contenido) =>
      `࿇ ══━━━✥◈✥━━━══ ࿇\n    🐼 ᴀʟᴇᴘᴀɴᴅᴀ ʙᴏᴛ\n࿇ ══━━━✥◈✥━━━══ ࿇\n\n${contenido}`;

    const pasos = [
      '𖣔 ɪɴɪᴄɪᴀɴᴅᴏ ᴘʀᴏᴛᴏᴄᴏʟᴏ ˚ʚ♡ɞ˚\n❧ 🔍 Analizando objetivo (con cariño)...',
      '𖣔 ɪɴɪᴄɪᴀɴᴅᴏ ᴘʀᴏᴛᴏᴄᴏʟᴏ ˚ʚ♡ɞ˚\n❧ 🔍 Analizando objetivo (con cariño)...\n❧ 📡 Preguntandole al router si sabe algo...',
      '𖣔 ɪɴɪᴄɪᴀɴᴅᴏ ᴘʀᴏᴛᴏᴄᴏʟᴏ ˚ʚ♡ɞ˚\n❧ 🔍 Analizando objetivo (con cariño)...\n❧ 📡 Preguntandole al router si sabe algo...\n❧ 🛰 Localizando... por el ruidito del celular...',
      '𖣔 ɪɴɪᴄɪᴀɴᴅᴏ ᴘʀᴏᴛᴏᴄᴏʟᴏ ˚ʚ♡ɞ˚\n❧ 🔍 Analizando objetivo (con cariño)...\n❧ 📡 Preguntandole al router si sabe algo...\n❧ 🛰 Localizando... por el ruidito del celular...\n❧ 🔓 Descifrando memes guardados...',
      '𖣔 ɪɴɪᴄɪᴀɴᴅᴏ ᴘʀᴏᴛᴏᴄᴏʟᴏ ˚ʚ♡ɞ˚\n❧ 🔍 Analizando objetivo (con cariño)...\n❧ 📡 Preguntandole al router si sabe algo...\n❧ 🛰 Localizando... por el ruidito del celular...\n❧ 🔓 Descifrando memes guardados...\n❧ 💾 Compilando puro invento...'
    ];

    // Mensaje inicial que se va a ir editando
    const scanMsg = await sock.sendMessage(jid, { text: marco(pasos[0]), mentions: [objetivo] });

    for (let i = 1; i < pasos.length; i++) {
      await esperar(1200);
      try {
        await sock.sendMessage(jid, { text: marco(pasos[i]), edit: scanMsg.key });
      } catch (err) {
        console.error('No se pudo editar el mensaje:', err);
      }
    }

    await esperar(1500);

    const reporte = marco(
`𖣔 ɪᴅᴇɴᴛɪꜰɪᴄᴀᴄɪᴏ́ɴ ˚ʚ♡ɞ˚
❧ Número
> +${numero}
❧ Nivel de sospecha
> ${Math.floor(Math.random() * 100)}% (osea, ninguno, es broma)

𖣔 ɴᴇᴛᴡᴏʀᴋ ˚ʚ♡ɞ˚
❧ IP Pública
> ${numeroRaro(4, 4)}
❧ IPv6 (inventadisima)
> ${numeroRaro(6, 5)}
❧ ISP
> Internet de la Tiendita S.A.
❧ VPN
> Sí, la del vecino

𖣔 ʟᴏᴄᴀʟɪᴢᴀᴄɪᴏ́ɴ ˚ʚ♡ɞ˚
❧ Ciudad
> Debajo de tu cama
❧ Coordenadas
> ${numeroRaro(2, 5)}° rumbo a la nevera
❧ Código postal
> TACO-${Math.floor(Math.random() * 9999)}

𖣔 ᴅɪsᴘᴏsɪᴛɪᴠᴏ ˚ʚ♡ɞ˚
❧ Marca
> PandaPhone 9000
❧ Batería
> ${Math.floor(Math.random() * 100)}% (o tal vez menos, quien sabe)
❧ Estado
> Viendo memes en visto

𖣔 ɪᴅᴇɴᴛɪꜰɪᴄᴀᴅᴏʀᴇs ˚ʚ♡ɞ˚
❧ IMEI
> ${numeroRaro(3, 6)}
❧ MAC Address
> ${hexRaro(4)}
❧ UUID
> PANDA-${numeroRaro(3, 4)}-BROMA

𖣔 ʀᴇsᴜʟᴛᴀᴅᴏ ˚ʚ♡ɞ˚
❧ Conclusión
> Nada de esto es real, es puro chiste 😂

⸻⸻⸻⸻⸻⸻
𖣔 ᴄʀᴇᴀᴅᴏʀᴇs ˚ʚ♡ɞ˚
❧ ALEPANDA
࿇ ══━━━✥◈✥━━━══ ࿇`
    );

    try {
      await sock.sendMessage(jid, { text: reporte, edit: scanMsg.key, mentions: [objetivo] });
    } catch (err) {
      console.error('No se pudo editar el mensaje final, se manda uno nuevo:', err);
      await sock.sendMessage(jid, { text: reporte, mentions: [objetivo] });
    }
  }
};
