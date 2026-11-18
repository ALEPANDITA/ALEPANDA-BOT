'use strict';
// Menu en panel deslizable (se ve dentro de WhatsApp, como un carrusel de tarjetas).
// Archivo NUEVO: no modifica ni reemplaza nada del .menu de siempre.
const crypto = require('crypto');
const fs = require('fs');

const POR_PAGINA = 20; // comandos por tarjeta (si una categoria tiene mas, se parte en 1/2, 2/2...)

const INFO = {
  general: ['🏠', 'General', 'Lo basico del bot'],
  subbot: ['🤖', 'Subbots', 'Conecta tu propio bot'],
  admin: ['🛡️', 'Administración', 'Herramientas para admins'],
  download: ['⬇️', 'Descargas', 'Descarga videos, música y fotos'],
  fun: ['🎉', 'Diversión', 'Juegos y bromas'],
  economia: ['💰', 'Economía & RPG', 'Economía, minería y RPG'],
  casino: ['🎲', 'Casino', 'Apuestas y suerte'],
  arcade: ['🕹️', 'Arcade', 'Juegos web de la manada'],
  gacha: ['🎁', 'Gacha', 'Ruleta de cartas'],
  'gacha-anime': ['🎴', 'Gacha Anime', 'Cartas de anime'],
  niveles: ['🏅', 'Niveles', 'Sube de nivel y rangos'],
  perfil: ['🪪', 'Perfil', 'Tu ficha de guerrero'],
  anime: ['🎌', 'Anime', 'Todo de anime'],
  interaction: ['🤝', 'Interacciones', 'Reacciones entre usuarios'],
  ia: ['🔮', 'Inteligencia Artificial', 'Pregunta y crea con IA'],
  tools: ['🧰', 'Herramientas', 'Utilidades varias'],
  logo: ['🎨', 'Logos', 'Taller de logos'],
  logovideo: ['🎬', 'Logos animados', 'Logos en video'],
  config: ['⚙️', 'Configuración', 'Ajustes del bot'],
  nsfw: ['🔞', 'NSFW', 'Solo adultos']
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// categorias: { cat: [comando, ...] } ya filtradas y ordenadas; orden: [cat, ...]
function armarPaginas(categorias, orden) {
  const paginas = [];
  for (const cat of orden) {
    const lista = (categorias[cat] || []).map((c) => c.name);
    if (!lista.length) continue;
    const [emoji, titulo, desc] = INFO[cat] || ['📜', cat.charAt(0).toUpperCase() + cat.slice(1), 'Comandos'];
    const partes = Math.ceil(lista.length / POR_PAGINA);
    for (let p = 0; p < partes; p++) {
      paginas.push({
        emoji, desc, total: lista.length,
        titulo: partes > 1 ? `${titulo} ${p + 1}/${partes}` : titulo,
        seccion: titulo.toUpperCase(),
        cmds: lista.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA)
      });
    }
  }
  return paginas;
}

function construirHTML({ paginas, prefix, nombreBot, imagen }) {
  const total = paginas.reduce((a, p) => a + p.cmds.length, 0);
  const tarjetas = paginas.map((p) => {
    const bloques = [p.cmds.slice(0, 12)];
    if (p.cmds.length > 12) bloques.push(p.cmds.slice(12));
    const secciones = bloques.map((b) =>
      `<div class="sec">${esc(p.seccion)}</div><div class="grid">${b.map((n) => `<div class="chip"><i>$</i>${esc(prefix + n)}</div>`).join('')}</div>`
    ).join('');
    return `<section class="pg"><div class="card">
      <div class="top"><div class="ico">${p.emoji}</div><div class="tt"><h2>${esc(p.titulo)}</h2><p>${esc(p.desc)}</p></div><div class="n">${p.total}<small>cmd</small></div></div>
      ${secciones}</div></section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#0b1316;color:#e6f1ee;font-family:ui-monospace,Menlo,Consolas,monospace;overflow:hidden}
.wrap{height:100%;display:flex;flex-direction:column;padding:10px}
.cover{width:100%;max-height:34%;object-fit:cover;border-radius:12px;margin-bottom:8px}
.trk{flex:1;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:0}
.trk::-webkit-scrollbar{display:none}
.pg{flex:0 0 100%;scroll-snap-align:center;overflow-y:auto;padding:2px}
.card{background:#0f1b1f;border:1px solid #1d3a3a;border-radius:16px;padding:12px;min-height:100%}
.top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.ico{width:50px;height:50px;border-radius:12px;background:#12302b;border:1px solid #1f5a4a;display:flex;align-items:center;justify-content:center;font-size:26px}
.tt{flex:1;min-width:0}.tt h2{font-size:17px;letter-spacing:.5px;text-transform:uppercase}.tt p{font-size:11px;color:#8fa9a4;margin-top:2px}
.n{font-size:13px;color:#3ddc97;border:1px solid #1f5a4a;border-radius:9px;padding:4px 8px;background:#0d2a25}.n small{font-size:10px}
.sec{font-size:11px;letter-spacing:2px;color:#2fbf86;margin:10px 0 6px;display:flex;align-items:center;gap:8px}
.sec:after{content:"";flex:1;height:1px;background:#1f5a4a}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.chip{background:#14232a;border:1px solid #24424a;border-radius:8px;padding:8px 9px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip i{color:#3ddc97;font-style:normal;margin-right:5px}
.foot{display:flex;align-items:center;gap:8px;padding:8px 4px 0}
.dots{flex:1;display:flex;gap:3px;min-width:0;overflow:hidden}.dots b{flex:0 0 5px;width:5px;height:5px;border-radius:50%;background:#2a3b3f}.dots b.on{flex:0 0 14px;width:14px;border-radius:4px;background:#3ddc97}
.cnt{font-size:10px;color:#8fa9a4;text-align:right}
.nav{background:#14232a;border:1px solid #24424a;color:#e6f1ee;border-radius:8px;width:30px;height:28px;font-size:14px}
</style></head><body><div class="wrap">
${imagen ? `<img class="cover" src="${imagen}">` : ''}
<div class="trk" id="t">${tarjetas}</div>
<div class="foot"><button class="nav" onclick="go(-1)">‹</button><div class="dots" id="d">${paginas.map(() => '<b></b>').join('')}</div><button class="nav" onclick="go(1)">›</button><div class="cnt"><span id="i">1</span> / ${paginas.length} · ${total} CMD</div></div>
</div>
<script>
var t=document.getElementById('t'),d=document.getElementById('d').children,i=document.getElementById('i');
function act(){var n=Math.round(t.scrollLeft/t.clientWidth);for(var k=0;k<d.length;k++)d[k].className=k===n?'on':'';i.textContent=n+1}
function go(s){t.scrollBy({left:s*t.clientWidth,behavior:'smooth'})}
t.addEventListener('scroll',act);act();
</script></body></html>`;
}

function construirContenido(titulo, html) {
  const unified = {
    response_id: crypto.randomUUID(),
    sections: [{
      __typename: 'GenAIUnifiedResponseSection',
      view_model: { __typename: 'GenAISingleLayoutViewModel', primitive: { __typename: 'GenAIBotProgressStatusPrimitive', is_in_progress: true, title: titulo } }
    }],
    embedded_screens: [{
      title: 'Preview',
      content: [{
        __typename: 'FOAIDNixelButtonSheets',
        tabs: [{
          id: 'tab_0',
          tab_header: titulo,
          sections: [{
            __typename: 'GenAIUnifiedResponseSection',
            view_model: { __typename: 'GenAISingleLayoutViewModel', primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: html, trusted_sources: ['example.com'], url: 'https://whatsapp.com' } }
          }],
          step_entries: []
        }]
      }]
    }]
  };
  return {
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 'AI_RICH_RESPONSE_TYPE_STANDARD',
          submessages: [{ messageType: 'AI_RICH_RESPONSE_TEXT', messageText: titulo }],
          unifiedResponse: { data: Buffer.from(JSON.stringify(unified), 'utf8') },
          contextInfo: { forwardingScore: 2, isForwarded: true, forwardOrigin: 'META_AI', forwardedAiBotMessageInfo: { botJid: '0@bot' }, botMessageSharingInfo: { forwardScore: 2 } }
        }
      }
    }
  };
}

// Imagen de portada opcional (la del .menu), reducida para que el mensaje pese poco.
async function portada(ruta) {
  try {
    if (!ruta || /\.mp4$/i.test(ruta)) return null;
    const Jimp = require('jimp');
    const img = await Jimp.read(fs.readFileSync(ruta));
    img.scaleToFit(480, 480).quality(70);
    const buf = await img.getBufferAsync(Jimp.MIME_JPEG);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (_) { return null; }
}

async function enviarMenuPanel({ sock, jid, categorias, orden, prefix, rutaImagen }) {
  const { proto } = require('@whiskeysockets/baileys');
  const paginas = armarPaginas(categorias, orden);
  if (!paginas.length) throw new Error('no hay comandos para mostrar');
  const html = construirHTML({ paginas, prefix, imagen: await portada(rutaImagen) });
  const m = proto.Message.fromObject(construirContenido('🐼 ALEPANDA · MENÚ', html));
  const rr = m.botForwardedMessage && m.botForwardedMessage.message && m.botForwardedMessage.message.richResponseMessage;
  if (!rr || !rr.unifiedResponse || !rr.unifiedResponse.data || !rr.unifiedResponse.data.length) {
    throw new Error('esta version de Baileys no trae richResponseMessage');
  }
  await sock.relayMessage(jid, m, { messageId: '3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase() });
  return paginas.length;
}

module.exports = { armarPaginas, construirHTML, construirContenido, enviarMenuPanel };
