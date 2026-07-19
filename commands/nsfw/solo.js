const { fetchJson, elegirAleatorio } = require('../../lib/reactions');

module.exports = {
  name: 'solo',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const autor = msg.key.participant || msg.key.remoteJid;
    const json = await fetchJson('https://api.delirius.store/reactions/solo');

    if (!json?.status || !json?.data?.url) {
      throw new Error('La API no devolvio una URL valida');
    }

    const mediaUrl = json.data.url;
    const tagAutor = `@${autor.split('@')[0]}`;

    const frases = [
      `${tagAutor} se puso a masturbarse como un poseso hasta correrse en su propia mano. 🔥`,
      `${tagAutor} se agarró la verga/coño y se folló a sí mismo hasta no poder más. 😈`,
      `${tagAutor} se tocó sin vergüenza hasta que su semen/leche salió disparado por doquier. 🖤`,
      `${tagAutor} se corrió tan fuerte que manchó todo de su propia mierda caliente. 💦`,
      `${tagAutor} se folló la mano como si fuera el último coño/culo del mundo. 🥵`,
      `${tagAutor} se metió los dedos hasta el fondo y se corrió gritando como un puto/a. 💋`,
      `${tagAutor} se masturbó hasta dejar su verga/coño rojo y hinchado de tanto frotar. 😏`,
      `${tagAutor} se corrió en la cama y luego se lamió toda su mierda como un cerdo. 🔞`,
      `${tagAutor} se folló un dildo y se corrió tan fuerte que casi se desmaya de placer. 😮‍💨`,
      `${tagAutor} se masturbó hasta quedar seco/a y luego se bebió su propia semen/leche. 🌙`
    ];

    const caption = elegirAleatorio(frases);
    const lower = mediaUrl.toLowerCase();

    if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
      return sock.sendMessage(
        jid,
        {
          video: { url: mediaUrl },
          caption,
          mentions: [autor],
          gifPlayback: true
        },
        { quoted: msg }
      );
    }

    return sock.sendMessage(
      jid,
      {
        image: { url: mediaUrl },
        caption,
        mentions: [autor]
      },
      { quoted: msg }
    );
  }
};
