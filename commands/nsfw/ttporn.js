const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const execPromise = util.promisify(exec);
const { advertencia, error: cajaError } = require('../../lib/estilo');

let lastIds = [];

// Helper to run promises with a concurrency limit
async function limitedAll(promises, limit = 5) {
  const results = [];
  const executing = [];
  for (const p of promises) {
    const execPromise = Promise.resolve().then(() => p);
    results.push(execPromise);
    if (limit <= promises.length) {
      const e = execPromise.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) await Promise.race(executing);
    }
  }
  return Promise.allSettled(results);
}

// Obtiene sinónimos (datamuse) y palabras auxiliares
async function getSinonimos(query) {
  const base = [query];
  try {
    const r1 = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(query)}&max=12`, { timeout: 8000 });
    const data1 = await r1.json();
    for (const w of data1) if (w.word && !base.includes(w.word)) base.push(w.word);
    const r2 = await fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(query)}&max=8`, { timeout: 8000 });
    const data2 = await r2.json();
    for (const w of data2) if (w.word && !base.includes(w.word)) base.push(w.word);
  } catch (e) {
    console.log('[ttporn] sin sinonimos auto', e.message);
  }
  for (const w of query.split(' ')) if (w.length > 3 && !base.includes(w)) base.push(w);
  if (query.endsWith('s')) base.push(query.slice(0, -1));
  console.log('[ttporn] sinonimos auto para', query, ':', base.join(', '));
  return base.slice(0, 15);
}

// Busca posts usando una palabra clave (sinónimos, categorías o tags)
async function buscarPostsPorPalabra(palabra) {
  const headers = { 'User-Agent': 'Mozilla/5.0' };
  const urlBase = `https://fyptt.to/wp-json/wp/v2`;
  const posts = [];

  // búsqueda directa
  try {
    const r = await fetch(`${urlBase}/posts?per_page=100&search=${encodeURIComponent(palabra)}&_fields=id,title,content,link`, { headers, timeout: 15000 });
    const data = await r.json();
    posts.push(...data);
  } catch {}

  // categorías
  try {
    const catRes = await fetch(`${urlBase}/categories?search=${encodeURIComponent(palabra)}&per_page=100`, { headers, timeout: 15000 });
    const cats = await catRes.json();
    for (const cat of cats) {
      const r = await fetch(`${urlBase}/posts?categories=${cat.id}&per_page=100&_fields=id,title,content,link`, { headers, timeout: 15000 });
      const data = await r.json();
      posts.push(...data);
    }
  } catch {}

  // tags
  try {
    const tagRes = await fetch(`${urlBase}/tags?search=${encodeURIComponent(palabra)}&per_page=100`, { headers, timeout: 15000 });
    const tags = await tagRes.json();
    for (const tag of tags) {
      const r = await fetch(`${urlBase}/posts?tags=${tag.id}&per_page=100&_fields=id,title,content,link`, { headers, timeout: 15000 });
      const data = await r.json();
      posts.push(...data);
    }
  } catch {}

  return posts;
}

// Busca posts aleatorios (limitado a 10 páginas)
async function buscarPostsRandom(pages = 10) {
  const headers = { 'User-Agent': 'Mozilla/5.0' };
  const urlBase = `https://fyptt.to/wp-json/wp/v2`;
  const all = [];
  for (let i = 0; i < pages; i++) {
    const page = Math.floor(Math.random() * 20) + 1;
    try {
      const r = await fetch(`${urlBase}/posts?per_page=100&page=${page}&_fields=id,title,content,link`, { headers, timeout: 15000 });
      const data = await r.json();
      all.push(...data);
    } catch {}
  }
  return all;
}

// Extrae video URL y título de un post
async function extraerVideo(post) {
  const html = post.content?.rendered || '';
  const mFile = html.match(/fypttstr\.php\?fileid=([^&"']+)/);
  if (!mFile) return null;
  const fileid = mFile[1];
  const titulo = (post.title?.rendered || '').replace(/<[^>]+>/g, '').trim();
  const mainurl = encodeURIComponent(post.link.replace('https://fyptt.to/', ''));
  try {
    const h2Res = await fetch(`https://fyptt.to/fypttstr.php?fileid=${fileid}&mainurl=${mainurl}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: post.link },
      timeout: 15000
    });
    const h2 = await h2Res.text();
    const m2 = typeof h2 === 'string' ? h2.match(/https:\/\/[^"'\\ ]+\.(mp4|m3u8)[^"'\\ ]*/) : null;
    if (m2) {
      return { videoUrl: m2[0].replace(/\\\//g, '/'), titulo, fileid };
    }
  } catch {}
  return null;
}

module.exports = {
  name: 'ttporn',
  aliases: ['fyptt', 'porn'],
  category: 'nsfw',
  description: 'Manda un video random o por búsqueda de fyptt.to. Uso: .ttporn <texto>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const body = texto || '';
    const query = body.split(' ').slice(1).join(' ').trim();
    const q = query.toLowerCase();

    await sock.sendMessage(jid, {
      text: query
        ? `> *_🔎 BUSCANDO TTPORN: ${query}_*\n> ⏳ Por favor espera...`
        : `> *_🔎 BUSCANDO TTPORN_*\n> ⏳ Por favor espera...`
    }, { quoted: msg });

    try {
      let posts = [];

      if (query) {
        const sinonimos = await getSinonimos(q);
        // Búsqueda paralela por sinónimos (máx 5 concurrentes)
        const promesas = sinonimos.map(p => buscarPostsPorPalabra(p));
        const resultados = await limitedAll(promesas, 5);
        for (const r of resultados) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            for (const p of r.value) if (!posts.find(x => x.id === p.id)) posts.push(p);
          }
        }

        // Si pocos resultados, buscar aleatorios (máx 10 páginas)
        if (posts.length < 5) {
          await sock.sendMessage(jid, { text: `> 📉 Hay pocos de *${query}*, buscando parecidos...` }, { quoted: msg });
          const randomPosts = await buscarPostsRandom(10);
          for (const p of randomPosts) {
            const title = (p.title?.rendered || '').toLowerCase();
            if (sinonimos.some(w => title.includes(w)) && !posts.find(x => x.id === p.id)) posts.push(p);
            if (posts.length >= 20) break;
          }
        }
      } else {
        // Sin query: solo aleatorio
        posts = await buscarPostsRandom(5);
      }

      // Si aún nada, fallback a random
      if (query && posts.length === 0) {
        posts = await buscarPostsRandom(5);
        await sock.sendMessage(jid, { text: `> ⚠️ No encontré nada de *${query}*, te mando uno random` }, { quoted: msg });
      }

      // Barajar y extraer videos (máx 15 candidatos)
      posts = posts.sort(() => Math.random() - 0.5);
      const candidatos = [];
      for (const p of posts) {
        if (candidatos.length >= 15) break;
        const vid = await extraerVideo(p);
        if (vid) candidatos.push(vid);
      }

      if (candidatos.length === 0) throw new Error('sin videos fyptt');

      // Evitar repetir IDs recientes
      let nuevos = candidatos.filter(c => !lastIds.includes(c.fileid));
      if (nuevos.length === 0) nuevos = candidatos;
      const elegido = nuevos[Math.floor(Math.random() * nuevos.length)];
      lastIds.push(elegido.fileid);
      if (lastIds.length > 30) lastIds.shift();

      const tmpFile = `/tmp/ttporn_${Date.now()}.mp4`;
      await execPromise(`ffmpeg -y -user_agent "Mozilla/5.0" -headers "Referer: https://fyptt.to/\\r\\nUser-Agent: Mozilla/5.0\\r\\n" -i "${elegido.videoUrl}" -c copy -movflags +faststart ${tmpFile} -loglevel error`);

      await sock.sendMessage(jid, {
        video: fs.readFileSync(tmpFile),
        caption: `> *_📹 TTPORN_*\n> \`${elegido.titulo}\`${query ? `\n> 🔎 Búsqueda: ${query}` : ''}`,
        mimetype: 'video/mp4'
      }, { quoted: msg });

      fs.unlinkSync(tmpFile);
    } catch (e) {
      console.log('[ttporn] ERROR:', e.message);
      await sock.sendMessage(jid, { text: cajaError('No pude sacar video, intenta de nuevo con `.ttporn`') }, { quoted: msg });
    }
  }
};