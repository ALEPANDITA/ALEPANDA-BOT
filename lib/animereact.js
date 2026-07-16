// Respaldo de gifs directos (sin depender de ninguna API) por si nekos.best falla.
const RESPALDO = {
  kiss: [
    'https://media.tenor.com/sbMBW4a-VN4AAAAM/anime-kiss.gif',
    'https://media.tenor.com/lJPu85pBQLEAAAAM/kiss.gif',
    'https://media.tenor.com/HdnsMy2ELv8AAAAM/kiss.gif',
    'https://media.tenor.com/YHxJ9NvLYKsAAAAM/anime-kiss.gif'
  ],
  hug: [
    'https://telegra.ph/file/6a3aa01fabb95e3558eec.mp4',
    'https://telegra.ph/file/0e5b24907be34da0cbe84.mp4',
    'https://telegra.ph/file/3e443a3363a90906220d8.mp4',
    'https://telegra.ph/file/436624e53c5f041bfd597.mp4'
  ],
  pat: [
    'https://media.tenor.com/Zm71HaIh7wwAAAAM/pat-pat.gif',
    'https://media.tenor.com/Z-28SFKJaIsAAAAM/anime-pat.gif',
    'https://media.tenor.com/mecnd_qE8p8AAAAM/anime-pat.gif',
    'https://media.tenor.com/mYzBXEhbbvgAAAAM/anime-pat.gif'
  ],
  slap: [
    'https://media.tenor.com/Ws6Dm1ZW_vMAAAAM/girl-slap.gif',
    'https://media.tenor.com/ZozZrvtEdAkAAAAM/slap.gif',
    'https://media.tenor.com/yJmrNruFNtEAAAAM/slap.gif',
    'https://media.tenor.com/XiYuU9h44-AAAAAM/anime-slap-mad.gif'
  ]
};

async function obtenerReaccion(tipo) {
  try {
    const res = await fetch(`https://nekos.best/api/v2/${tipo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const resultado = data?.results?.[0];
    if (resultado?.url) return resultado;
    throw new Error('Respuesta vacia de nekos.best');
  } catch (err) {
    console.warn(`nekos.best fallo para "${tipo}", usando respaldo:`, err.message);

    const lista = RESPALDO[tipo];
    if (lista?.length) {
      return { url: lista[Math.floor(Math.random() * lista.length)] };
    }

    throw new Error('No se pudo obtener la imagen (API y respaldo fallaron).');
  }
}

module.exports = { obtenerReaccion };
