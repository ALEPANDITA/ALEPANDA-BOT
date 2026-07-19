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
      `${tagAutor} decidio complacerse a solas y subir la temperatura sin ayuda de nadie. 🔥`,
      `${tagAutor} se monto su propio espectaculo privado y dejo a todos imaginando demasiado. 😈`,
      `${tagAutor} se dejo llevar por el placer en solitario como si nadie estuviera mirando. 🖤`,
      `${tagAutor} se encerro en su fantasia y convirtio el momento en puro vicio. 💦`,
      `${tagAutor} empezo a jugar consigo mismo y el ambiente se puso peligrosamente caliente. 🥵`,
      `${tagAutor} se regalo un momento demasiado intimo y demasiado delicioso para ocultarlo. 💋`,
      `${tagAutor} decidio perderse en su propio placer sin pedir permiso a nadie. 😏`,
      `${tagAutor} se puso comodo, se dejo llevar y termino armando un show bastante atrevido. 🔞`,
      `${tagAutor} prefirio entretenerse solo y vaya que supo hacerlo de la forma mas sucia. 😮‍💨`,
      `${tagAutor} se abandono al deseo y disfruto a solas hasta encender todo el chat. 🌙`
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
