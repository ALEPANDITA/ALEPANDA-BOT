'use strict';
// lib/album-gacha.js
// Album de gacha en forma de LIBRO, con la misma estetica del .menupanel (tarjetas deslizables dentro de WhatsApp).
// Portada + paginas de 5 piezas, cada una con su foto, rareza y cuanto vale. Junta las dos colecciones del bot:
//   - perfil.waifus      (.rollwaifu)  -> una pieza por personaje
//   - perfil.gachaAnime  (.rollanime)  -> una pieza por tipo, con sus copias
// El valor de cada pieza es el mismo que paga .vender (VALOR_POR_RAREZA).
const crypto = require('crypto');

const POR_PAGINA = 5;
const VALOR_POR_RAREZA = { COMUN: 100, RARA: 300, EPICA: 800, LEGENDARIA: 2000 };
const ORDEN_RAREZA = { LEGENDARIA: 0, EPICA: 1, RARA: 2, COMUN: 3 };
const COLOR = { LEGENDARIA: '#ffc857', EPICA: '#b07cff', RARA: '#4aa8ff', COMUN: '#9fb3b0' };
const NOMBRE_RAREZA = { LEGENDARIA: 'Legendaria', EPICA: 'Épica', RARA: 'Rara', COMUN: 'Común' };
const EMOJI_RAREZA = { LEGENDARIA: '🌟', EPICA: '💜', RARA: '💙', COMUN: '⚪' };

const MAX_IMAGENES = 110;        // fotos incrustadas como maximo (las de mayor rareza primero)
const MAX_BUSQUEDAS_JIKAN = 20; // fotos que se piden a Jikan por comando para las waifus viejas que no guardaron su imagen
const MAX_HTML = 750000;        // si el album pesa mas que esto se le quitan fotos

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-MX');

// ---------- Datos ----------
function reunirPiezas(perfil) {
  const piezas = [];
  for (const w of (perfil && perfil.waifus) || []) {
    const rareza = ORDEN_RAREZA[w.rareza] !== undefined ? w.rareza : 'COMUN';
    piezas.push({ tipo: 'waifu', id: w.id, nombre: w.nombre || 'Personaje', serie: w.serie || 'Desconocida', rareza, valor: VALOR_POR_RAREZA[rareza], copias: 1, imagen: w.imagen || '', emoji: '🎴' });
  }
  let arquetipos = {};
  try { arquetipos = require('./gachaanime').ARQUETIPOS || {}; } catch (_) { arquetipos = {}; }
  for (const [nombre, cantidad] of Object.entries((perfil && perfil.gachaAnime) || {})) {
    const arq = Object.entries(arquetipos).find(([, a]) => a.nombre === nombre);
    const rareza = arq ? arq[0].toUpperCase() : 'COMUN';
    const copias = Math.max(1, Number(cantidad) || 1);
    piezas.push({ tipo: 'anime', id: null, nombre, serie: 'Ilustración de anime', rareza: ORDEN_RAREZA[rareza] !== undefined ? rareza : 'COMUN', valor: (VALOR_POR_RAREZA[rareza] || 100) * copias, copias, imagen: ((perfil && perfil.gachaAnimeFotos) || {})[nombre] || '', categoria: arq ? arq[1].categoriaApi : '', emoji: arq ? arq[1].emoji : '🎴' });
  }
  piezas.sort((a, b) => ORDEN_RAREZA[a.rareza] - ORDEN_RAREZA[b.rareza] || b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'));
  return piezas;
}

function resumen(piezas) {
  const porRareza = { LEGENDARIA: 0, EPICA: 0, RARA: 0, COMUN: 0 };
  let valor = 0;
  let total = 0;
  for (const p of piezas) { porRareza[p.rareza] += p.copias; valor += p.valor; total += p.copias; }
  return { total, valor, porRareza };
}

// ---------- Fotos ----------
// Tamano de las fotos segun cuantas hay: pocas = mas nitidas (se ven mejor al ampliar), muchas = mas chicas para que el album no pese de mas
function nivelPara(n) {
  if (n <= 24) return { W: 200, H: 267, q: 62 };
  if (n <= 45) return { W: 150, H: 200, q: 56 };
  if (n <= 75) return { W: 112, H: 150, q: 50 };
  return { W: 90, H: 120, q: 45 };
}
const cacheMiniaturas = new Map(); // url|ancho -> data URI (se limpia solo al pasar de 300)

// nekos.best bloquea el fetch de node (con curl si responde), asi que si fetch falla se baja con curl
async function bajarImagen(url) {
  const { descargarImagenBuffer } = require('./animeapi');
  if (!/nekos\.best/i.test(url)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch (_) { /* se intenta con curl */ }
  }
  return descargarImagenBuffer(url);
}

async function miniatura(url, nivel) {
  if (!url) return null;
  const clave = url + '|' + nivel.W;
  if (cacheMiniaturas.has(clave)) return cacheMiniaturas.get(clave);
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const img = await loadImage(await bajarImagen(url));
    const { W, H, q } = nivel;
    const lienzo = createCanvas(W, H);
    const ctx = lienzo.getContext('2d');
    const escala = Math.max(W / img.width, H / img.height);
    const w = img.width * escala; const h = img.height * escala;
    ctx.drawImage(img, (W - w) / 2, 0, w, h); // recorte centrado, pegado arriba (las caras suelen estar arriba)
    const uri = 'data:image/jpeg;base64,' + lienzo.toBuffer('image/jpeg', q).toString('base64');
    if (cacheMiniaturas.size > 300) cacheMiniaturas.clear();
    cacheMiniaturas.set(clave, uri);
    return uri;
  } catch (_) { return null; }
}

// Piezas guardadas antes de que se guardara su imagen: waifus -> se le pide a Jikan (pocas por vez, respetando su limite);
// ilustraciones de anime -> se les asigna una imagen real de su categoria. Todo se guarda en la base para la proxima vez
async function completarImagenes(piezas, guardar) {
  let nuevas = 0;
  try {
    const { obtenerImagenAnime } = require('./animeapi');
    for (const p of piezas) {
      if (p.tipo !== 'anime' || p.imagen || !p.categoria) continue;
      try { const img = await obtenerImagenAnime(p.categoria); if (img && img.url) { p.imagen = img.url; nuevas++; } } catch (_) { /* sigue con la siguiente */ }
    }
  } catch (_) { /* sin animeapi no hay respaldo para anime */ }
  const faltan = [];
  for (const p of piezas) if (p.tipo === 'waifu' && !p.imagen && p.id && !faltan.some((x) => x.id === p.id)) faltan.push(p);
  for (const p of faltan.slice(0, MAX_BUSQUEDAS_JIKAN)) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/characters/${encodeURIComponent(p.id)}`, { signal: AbortSignal.timeout(6000) });
      if (res.status === 429) break;
      if (res.ok) {
        const json = await res.json();
        const url = json && json.data && json.data.images && ((json.data.images.webp && json.data.images.webp.image_url) || (json.data.images.jpg && json.data.images.jpg.image_url));
        if (url) { for (const q of piezas) if (q.tipo === 'waifu' && q.id === p.id) q.imagen = url; nuevas++; }
      }
    } catch (_) { /* sigue con la siguiente */ }
    await esperar(380);
  }
  if (nuevas && guardar) { try { guardar(piezas); } catch (_) { /* no es critico */ } }
  return nuevas;
}

async function prepararFotos(piezas, limite) {
  const fotos = new Map();
  const quienes = piezas.map((p, i) => ({ p, i })).filter((x) => x.p.imagen).slice(0, limite);
  const nivel = nivelPara(quienes.length);
  let cola = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cola < quienes.length) {
      const { p, i } = quienes[cola++];
      const uri = await miniatura(p.imagen, nivel);
      if (uri) fotos.set(i, uri);
    }
  }));
  return fotos;
}

// ---------- HTML (misma paleta que .menupanel) ----------
function construirHTML({ piezas, fotos, dueno, nombreBot = 'ALEPANDA' }) {
  const r = resumen(piezas);
  const paginasPiezas = [];
  for (let i = 0; i < piezas.length; i += POR_PAGINA) paginasPiezas.push(piezas.slice(i, i + POR_PAGINA).map((p, k) => ({ p, n: i + k })));
  const totalPaginas = paginasPiezas.length + 1;

  const portada = `<section class="pg"><div class="card cover">
    <div class="ribbon"></div>
    <div class="orn">✦ ✦ ✦</div>
    <div class="ttl">ÁLBUM<br>DE GACHA</div>
    <div class="owner">${esc(dueno)}</div>
    <div class="stats">
      <div class="st"><b>${r.total}</b><span>piezas</span></div>
      <div class="st"><b>${esc(dinero(r.valor))}</b><span>valor total</span></div>
    </div>
    <div class="chips">${['LEGENDARIA', 'EPICA', 'RARA', 'COMUN'].map((k) => `<div class="rc" style="--c:${COLOR[k]}"><i></i>${EMOJI_RAREZA[k]} ${r.porRareza[k]} <small>${NOMBRE_RAREZA[k]}</small></div>`).join('')}</div>
    <div class="hint">${paginasPiezas.length ? 'Desliza o toca › para pasar la página · toca una carta para ampliarla' : 'Aún no tienes piezas. Usa .rollwaifu o .rollanime'}</div>
    <div class="orn small">🐼 ${esc(nombreBot)}</div>
  </div></section>`;

  const paginas = paginasPiezas.map((lista, pi) => {
    const valorPagina = lista.reduce((a, x) => a + x.p.valor, 0);
    const slots = lista.map(({ p, n }) => {
      const foto = fotos.get(n);
      const marco = foto ? `<img src="${foto}">` : `<span>${p.emoji}</span>`;
      return `<div class="slot" style="--c:${COLOR[p.rareza]}">
        <div class="num">${String(n + 1).padStart(2, '0')}</div>
        <div class="foto${p.rareza === 'LEGENDARIA' ? ' leg' : ''}">${marco}</div>
        <div class="inf"><div class="nm">${esc(p.nombre)}${p.copias > 1 ? ` <em>x${p.copias}</em>` : ''}</div><div class="sr">${esc(p.serie)}</div><div class="bd">${EMOJI_RAREZA[p.rareza]} ${NOMBRE_RAREZA[p.rareza]}</div></div>
        <div class="val"><b>${esc(dinero(p.valor))}</b><small>valor</small></div>
      </div>`;
    }).join('') + Array.from({ length: POR_PAGINA - lista.length }, () => '<div class="slot vacio">ESPACIO LIBRE</div>').join('');
    return `<section class="pg"><div class="card">
      <div class="top"><div class="ico">📖</div><div class="tt"><h2>Álbum de ${esc(dueno)}</h2><p>Página ${pi + 1} de ${paginasPiezas.length}</p></div><div class="n">${esc(dinero(valorPagina))}<small>página</small></div></div>
      <div class="sec">COLECCIÓN</div>
      <div class="slots">${slots}</div>
      <div class="pie">— ${pi + 2} —</div>
    </div></section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#0b1316;color:#e6f1ee;font-family:ui-monospace,Menlo,Consolas,monospace;overflow:hidden}
.wrap{height:100%;display:flex;flex-direction:column;padding:10px}
.trk{flex:1;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:0;perspective:1200px}
.trk::-webkit-scrollbar{display:none}
.pg{flex:0 0 100%;scroll-snap-align:center;overflow-y:auto;padding:2px}
.card{position:relative;background:linear-gradient(90deg,#08100f 0,#0f1b1f 7%,#0f1b1f 100%);border:1px solid #1d3a3a;border-left:6px solid #12302b;border-radius:6px 16px 16px 6px;padding:12px 12px 8px 14px;min-height:100%;display:flex;flex-direction:column;transform-origin:left center;box-shadow:inset 8px 0 14px -8px #000}
.top{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.ico{width:46px;height:46px;border-radius:12px;background:#12302b;border:1px solid #1f5a4a;display:flex;align-items:center;justify-content:center;font-size:24px}
.tt{flex:1;min-width:0}.tt h2{font-size:15px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt p{font-size:11px;color:#8fa9a4;margin-top:2px}
.n{font-size:13px;color:#3ddc97;border:1px solid #1f5a4a;border-radius:9px;padding:4px 8px;background:#0d2a25;text-align:center}.n small{display:block;font-size:9px;color:#8fa9a4}
.sec{font-size:11px;letter-spacing:2px;color:#2fbf86;margin:8px 0 6px;display:flex;align-items:center;gap:8px}
.sec:after{content:"";flex:1;height:1px;background:#1f5a4a}
.slots{flex:1;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(5,minmax(70px,1fr));gap:6px}
.slot{min-height:70px;display:flex;align-items:center;gap:9px;background:#14232a;border:1px solid #24424a;border-left:3px solid var(--c);border-radius:10px;padding:6px 9px 6px 7px}
.num{font-size:10px;color:#6d8a84;width:18px;text-align:center}
.slot.vacio{justify-content:center;border-style:dashed;border-left:1px dashed #24424a;background:transparent;color:#41605a;font-size:11px;letter-spacing:2px}
.foto{flex:0 0 auto;width:48px;height:64px;border-radius:7px;border:2px solid var(--c);background:#0b1a1d;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 10px -2px var(--c)}
.foto img{width:100%;height:100%;object-fit:cover;display:block}
.foto.leg{animation:br 2.4s ease-in-out infinite}
@keyframes br{0%,100%{box-shadow:0 0 6px -2px var(--c)}50%{box-shadow:0 0 16px 0 var(--c)}}
.inf{flex:1;min-width:0}
.nm{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nm em{font-style:normal;color:#3ddc97;font-size:11px}
.sr{font-size:10px;color:#8fa9a4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.bd{display:inline-block;font-size:10px;color:var(--c);margin-top:4px}
.val{text-align:right;flex:0 0 auto}.val b{display:block;font-size:13px;color:#3ddc97}.val small{font-size:9px;color:#6d8a84;letter-spacing:1px}
.pie{text-align:center;font-size:10px;color:#6d8a84;letter-spacing:2px;margin-top:8px}
.cover{align-items:center;justify-content:center;text-align:center;gap:12px;background:radial-gradient(circle at 50% 30%,#12302b 0,#0f1b1f 60%) ,#0f1b1f;border-left:10px solid #12302b}
.ribbon{position:absolute;top:0;right:22px;width:22px;height:60px;background:#3ddc97;clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%);opacity:.9}
.orn{color:#2fbf86;letter-spacing:6px;font-size:12px}.orn.small{font-size:11px;letter-spacing:2px;color:#6d8a84;margin-top:6px}
.ttl{font-size:30px;line-height:1.1;letter-spacing:3px;font-weight:800;color:#e6f1ee;text-shadow:0 0 18px #2fbf8666}
.owner{font-size:14px;color:#3ddc97;border:1px solid #1f5a4a;background:#0d2a25;border-radius:9px;padding:5px 12px;max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stats{display:flex;gap:10px;margin-top:6px}.st{background:#14232a;border:1px solid #24424a;border-radius:10px;padding:8px 14px}.st b{display:block;font-size:18px;color:#3ddc97}.st span{font-size:10px;color:#8fa9a4;letter-spacing:1px}
.chips{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;max-width:300px}
.rc{position:relative;background:#14232a;border:1px solid #24424a;border-radius:8px;padding:7px 8px;font-size:13px;text-align:left;overflow:hidden}.rc small{color:#8fa9a4;font-size:10px}.rc i{position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c)}
.hint{font-size:11px;color:#8fa9a4;margin-top:4px}
.foot{display:flex;align-items:center;gap:8px;padding:8px 4px 0}
.dots{flex:1;display:flex;gap:3px;min-width:0;overflow:hidden}.dots b{flex:0 0 5px;width:5px;height:5px;border-radius:50%;background:#2a3b3f}.dots b.on{flex:0 0 14px;width:14px;border-radius:4px;background:#3ddc97}
.cnt{font-size:10px;color:#8fa9a4;text-align:right}
.nav{background:#14232a;border:1px solid #24424a;color:#e6f1ee;border-radius:8px;width:30px;height:28px;font-size:14px}
/* ---- zoom de cartas: toca una para ampliarla, vuelve a tocarla para quitar el zoom ---- */
.slots{display:flex;flex-direction:column}
.slot{flex:1 1 70px;cursor:pointer;transition:background .2s}
.slot.vacio{cursor:default}
.slot.zoom{flex:0 0 auto;flex-direction:column;text-align:center;gap:10px;padding:14px 10px;background:#1a2f38;box-shadow:0 0 22px -6px var(--c);animation:pop .22s ease-out}
.slot.zoom .num{display:none}
.slot.zoom .foto{width:min(70vw,250px);height:auto;aspect-ratio:3/4;font-size:72px;border-width:3px}
.slot.zoom .inf{width:100%}
.slot.zoom .nm{white-space:normal;font-size:16px}
.slot.zoom .sr{white-space:normal;font-size:12px}
.slot.zoom .val{text-align:center}
@keyframes pop{from{transform:scale(.88)}to{transform:scale(1)}}
</style></head><body><div class="wrap">
<div class="trk" id="t">${portada}${paginas}</div>
<div class="foot"><button class="nav" onclick="go(-1)">‹</button><div class="dots" id="d">${Array.from({ length: totalPaginas }, () => '<b></b>').join('')}</div><button class="nav" onclick="go(1)">›</button><div class="cnt"><span id="i">1</span> / ${totalPaginas} · ${r.total} PZ</div></div>
</div>
<script>
var t=document.getElementById('t'),d=document.getElementById('d').children,i=document.getElementById('i'),cards=t.querySelectorAll('.card');
function act(){var w=t.clientWidth||1,n=Math.round(t.scrollLeft/w);for(var k=0;k<d.length;k++)d[k].className=k===n?'on':'';i.textContent=n+1;
for(var k=0;k<cards.length;k++){var x=(t.scrollLeft-k*w)/w;cards[k].style.transform=x>0&&x<1?'rotateY('+(-x*38)+'deg)':'';cards[k].style.opacity=x>0&&x<1?(1-x*.35):''}}
function go(s){t.scrollBy({left:s*t.clientWidth,behavior:'smooth'})}
t.addEventListener('scroll',act);act();
t.addEventListener('click',function(e){var s=e.target;while(s&&s!==t&&!(s.classList&&s.classList.contains('slot')))s=s.parentNode;
if(!s||s===t||s.classList.contains('vacio'))return;var on=s.classList.contains('zoom'),z=t.querySelectorAll('.slot.zoom');
for(var k=0;k<z.length;k++)z[k].classList.remove('zoom');
if(!on){s.classList.add('zoom');setTimeout(function(){try{s.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch(_){}},40)}});
</script></body></html>`;
}

// ---------- Envio (el mismo mecanismo que .menupanel) ----------
async function enviarHTML(sock, jid, titulo, html, citado) {
  const { proto } = require('@whiskeysockets/baileys');
  const { construirContenido } = require('./menu-panel');
  const m = proto.Message.fromObject(construirContenido(titulo, html));
  const rr = m.botForwardedMessage && m.botForwardedMessage.message && m.botForwardedMessage.message.richResponseMessage;
  if (!rr || !rr.unifiedResponse || !rr.unifiedResponse.data || !rr.unifiedResponse.data.length) throw new Error('esta version de Baileys no trae richResponseMessage');
  await sock.relayMessage(jid, m, { messageId: '3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase() });
}

// Arma el HTML con las fotos que quepan (si pesa demasiado, va quitando fotos)
async function armarAlbum({ piezas, dueno }) {
  let limite = MAX_IMAGENES;
  let fotos = await prepararFotos(piezas, limite);
  let html = construirHTML({ piezas, fotos, dueno });
  while (html.length > MAX_HTML && limite > 0) {
    limite = Math.floor(limite / 2);
    fotos = new Map([...fotos.entries()].filter(([i]) => i < limite));
    html = construirHTML({ piezas, fotos, dueno });
  }
  return { html, fotos: fotos.size };
}

module.exports = { POR_PAGINA, VALOR_POR_RAREZA, reunirPiezas, resumen, completarImagenes, prepararFotos, construirHTML, armarAlbum, enviarHTML, dinero, EMOJI_RAREZA, NOMBRE_RAREZA };
