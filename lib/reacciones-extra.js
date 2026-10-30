// Reacciones anime extra (.wave, .wink, .run, ...). Usan el mismo envio que el resto
// (enviarReaccion): gif/video + frase con @menciones. Fuentes del gif, en este orden:
//   1) nekos.best (si esa reaccion existe ahi)
//   2) api.stellarwa.xyz (cubre las que nekos.best no tiene)
const { enviarReaccion } = require('./animereact');

const STELLAR = 'https://api.stellarwa.xyz/sfw/interaction';

function elegir(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

async function urlsDeReaccion(tipoStellar, tipoNekos) {
  const urls = [];

  if (tipoNekos) {
    try {
      const res = await fetch(`https://nekos.best/api/v2/${tipoNekos}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const url = data?.results?.[0]?.url;
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) urls.push(url);
      }
    } catch (err) {
      console.warn(`[reacciones] nekos.best fallo para "${tipoNekos}": ${err.message}`);
    }
  }

  urls.push(`${STELLAR}?inter=${encodeURIComponent(tipoStellar)}&key=Midnight`);
  return urls;
}

// r: { names: [principal, ...alias], description, emoji, nekos, solo: [frases], juntos: [frases] }
function crearReaccion(r) {
  const [name, ...aliases] = r.names;
  return {
    name,
    aliases,
    category: 'anime',
    description: `${r.description}. Uso: .${name} [@usuario]`,
    execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
      tipo: name,
      emoji: r.emoji,
      obtener: async () => ({ respaldo: true, urls: await urlsDeReaccion(name, r.nekos) }),
      conObjetivo: (yo, el) => `@${yo} ${elegir(r.juntos)} @${el}`,
      sinObjetivo: (yo) => `@${yo} ${elegir(r.solo)}`
    })
  };
}

module.exports = { crearReaccion };
