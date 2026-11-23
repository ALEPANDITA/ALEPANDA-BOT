'use strict';
// lib/album-gacha.js
// Album de gacha en forma de LIBRO, con la misma estetica del .menupanel (tarjetas deslizables dentro de WhatsApp).
const crypto = require('crypto');

const POR_PAGINA = 5;
const VALOR_POR_RAREZA = { COMUN: 100, RARA: 300, EPICA: 800, LEGENDARIA: 2000 };
const ORDEN_RAREZA = { LEGENDARIA: 0, EPICA: 1, RARA: 2, COMUN: 3 };
const COLOR = { LEGENDARIA: '#ffc857', EPICA: '#b07cff', RARA: '#4aa8ff', COMUN: '#9fb3b0' };
const NOMBRE_RAREZA = { LEGENDARIA: 'Legendaria', EPICA: 'Épica', RARA: 'Rara', COMUN: 'Común' };
const EMOJI_RAREZA = { LEGENDARIA: '🌟', EPICA: '💜', RARA: '💙', COMUN: '⚪' };

const PIEZAS_POR_TOMO = 20;     // cartas por mensaje (4 paginas). Si tienes mas: .album 2, .album 3...
const MAX_IMAGENES = 60;
const MAX_NUEVAS_ANIME = 12;
const MAX_BUSQUEDAS_JIKAN = 12;
const MAX_HTML = 520000;        // si un tomo pesa mas que esto se le quitan fotos

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-MX');

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
    const n = Math.min(60, Math.max(1, Number(cantidad) || 1));
    const pool = (perfil.imagenesAnime && Array.isArray(perfil.imagenesAnime[nombre])) ? perfil.imagenesAnime[nombre].filter(Boolean).slice(-n) : [];
    for (let i = 0; i < n; i++) {
      piezas.push({ tipo: 'anime', id: null, nombre, serie: 'Ilustración de anime', rareza: ORDEN_RAREZA[rareza] !== undefined ? rareza : 'COMUN', valor: VALOR_POR_RAREZA[rareza] || 100, copias: 1, imagen: pool[i] || '', categoria: arq ? arq[1].categoriaApi : '', emoji: arq ? arq[1].emoji : '🎴' });
    }
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

const cacheMiniaturas = new Map();

// nekos.best (Cloudflare) rechaza el fetch de node pero acepta curl, igual que .rollanime
async function bajarImagen(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (res.ok) { const b = Buffer.from(await res.arrayBuffer()); if (b.length) return b; }
  } catch (_) { /* prueba con curl */ }
  const { descargarImagenBuffer } = require('./animeapi');
  return descargarImagenBuffer(url);
}

async function miniatura(url) {
  if (!url) return null;
  if (cacheMiniaturas.has(url)) return cacheMiniaturas.get(url);
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const img = await loadImage(await bajarImagen(url));
    const W = 200; const H = 270;
    const lienzo = createCanvas(W, H);
    const ctx = lienzo.getContext('2d');
    const escala = Math.max(W / img.width, H / img.height);
    const w = img.width * escala; const h = img.height * escala;
    ctx.drawImage(img, (W - w) / 2, 0, w, h);
    const uri = 'data:image/jpeg;base64,' + lienzo.toBuffer('image/jpeg', 52).toString('base64');
    if (cacheMiniaturas.size > 300) cacheMiniaturas.clear();
    cacheMiniaturas.set(url, uri);
    return uri;
  } catch (err) { console.warn('[album] no pude preparar una foto:', String(url).slice(0, 80), '-', err && err.message ? err.message : err); return null; }
}

async function completarImagenes(piezas, guardar) {
  const faltan = [];
  for (const p of piezas) if (p.tipo === 'waifu' && !p.imagen && p.id && !faltan.some((x) => x.id === p.id)) faltan.push(p);
  let nuevas = 0;
  for (const p of faltan.slice(0, MAX_BUSQUEDAS_JIKAN)) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/characters/${encodeURIComponent(p.id)}`, { signal: AbortSignal.timeout(6000) });
      if (res.status === 429) break;
      if (res.ok) {
        const json = await res.json();
        const url = json && json.data && json.data.images && ((json.data.images.webp && json.data.images.webp.image_url) || (json.data.images.jpg && json.data.images.jpg.image_url));
        if (url) { for (const q of piezas) if (q.tipo === 'waifu' && q.id === p.id) q.imagen = url; nuevas++; }
      }
    } catch (_) { /* sigue */ }
    await esperar(380);
  }
  if (nuevas && guardar) { try { guardar(piezas); } catch (_) { /* no critico */ } }
  return nuevas;
}

async function completarImagenesAnime(piezas, guardar) {
  const nuevas = [];
  const faltan = piezas.filter((p) => p.tipo === 'anime' && !p.imagen && p.categoria).slice(0, MAX_NUEVAS_ANIME);
  let cola = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cola < faltan.length) {
      const p = faltan[cola++];
      try {
        const { obtenerImagenAnime } = require('./animeapi');
        const r = await obtenerImagenAnime(p.categoria);
        if (r && r.url) { p.imagen = r.url; nuevas.push({ nombre: p.nombre, url: r.url }); }
      } catch (err) { console.warn('[album] no pude pedir una imagen de anime:', err && err.message ? err.message : err); }
    }
  }));
  if (nuevas.length && guardar) { try { guardar(nuevas); } catch (_) { /* no critico */ } }
  return nuevas.length;
}

async function prepararFotos(piezas, limite) {
  const fotos = new Map();
  const quienes = piezas.map((p, i) => ({ p, i })).filter((x) => x.p.imagen).slice(0, limite);
  let cola = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cola < quienes.length) {
      const { p, i } = quienes[cola++];
      const uri = await miniatura(p.imagen);
      if (uri) fotos.set(i, uri);
    }
  }));
  return fotos;
}

function construirHTML({ piezas, fotos, dueno, nombreBot = 'ALEPANDA', tomo = 1, prefix = '.' }) {
  const r = resumen(piezas);
  const totalTomos = Math.max(1, Math.ceil(piezas.length / PIEZAS_POR_TOMO));
  tomo = Math.min(Math.max(1, tomo), totalTomos);
  const inicio = (tomo - 1) * PIEZAS_POR_TOMO;
  const delTomo = piezas.slice(inicio, inicio + PIEZAS_POR_TOMO);
  const paginasPiezas = [];
  for (let i = 0; i < delTomo.length; i += POR_PAGINA) paginasPiezas.push(delTomo.slice(i, i + POR_PAGINA).map((p, k) => ({ p, n: inicio + i + k })));
  const totalPaginas = paginasPiezas.length + 1;
  const paginasTotales = Math.ceil(piezas.length / POR_PAGINA);
  const paginaBase = inicio / POR_PAGINA;

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
    <div class="hint">${paginasPiezas.length ? '👆 Toca una carta para verla en grande' : 'Aún no tienes piezas. Usa .rollwaifu o .rollanime'}</div>
    <div class="hint">${totalTomos > 1 ? `Tomo ${tomo} de ${totalTomos} · usa ${esc(prefix)}album ${tomo < totalTomos ? tomo + 1 : 1} para ${tomo < totalTomos ? 'el siguiente' : 'volver al primero'}` : ''}</div>
    <div class="orn small">🐼 ${esc(nombreBot)}</div>
  </div></section>`;

  const paginas = paginasPiezas.map((lista, pi) => {
    const valorPagina = lista.reduce((a, x) => a + x.p.valor, 0);
    const slots = lista.map(({ p, n }) => {
      const foto = fotos.get(n);
      const marco = foto ? `<img src="${foto}">` : `<span>${p.emoji}</span>`;
      return `<div class="slot" style="--c:${COLOR[p.rareza]}" data-nm="${esc(p.nombre)}" data-sr="${esc(p.serie)}" data-rz="${esc(EMOJI_RAREZA[p.rareza] + ' ' + NOMBRE_RAREZA[p.rareza])}" data-vl="${esc(dinero(p.valor))}" data-cl="${COLOR[p.rareza]}" data-em="${esc(p.emoji)}" data-nu="${n + 1}">
        <div class="num">${String(n + 1).padStart(2, '0')}</div>
        <div class="foto${p.rareza === 'LEGENDARIA' ? ' leg' : ''}">${marco}</div>
        <div class="inf"><div class="nm">${esc(p.nombre)}</div><div class="sr">${esc(p.serie)}</div><div class="bd">${EMOJI_RAREZA[p.rareza]} ${NOMBRE_RAREZA[p.rareza]}</div></div>
        <div class="val"><b>${esc(dinero(p.valor))}</b><small>valor</small></div>
      </div>`;
    }).join('') + Array.from({ length: POR_PAGINA - lista.length }, () => '<div class="slot vacio">ESPACIO LIBRE</div>').join('');
    return `<section class="pg"><div class="card">
      <div class="top"><div class="ico">📖</div><div class="tt"><h2>Álbum de ${esc(dueno)}</h2><p>Página ${paginaBase + pi + 1} de ${paginasTotales}${totalTomos > 1 ? ` · Tomo ${tomo}/${totalTomos}` : ''}</p></div><div class="n">${esc(dinero(valorPagina))}<small>página</small></div></div>
      <div class="sec">COLECCIÓN</div>
      <div class="slots">${slots}</div>
      <div class="pie">— ${paginaBase + pi + 2} —</div>
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

.slot[data-nm]{cursor:pointer}.slot[data-nm]:active{filter:brightness(1.25)}
.zoom{position:fixed;top:0;left:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(4,9,11,.94);z-index:9;padding:16px}
.zoom.on{display:flex}
.zx{position:absolute;top:14px;right:14px;width:48px;height:48px;border-radius:50%;background:#14232a;border:2px solid #3ddc97;color:#e6f1ee;font-size:22px;line-height:1;z-index:10}
.zc{width:100%;max-width:330px;background:#0f1b1f;border:3px solid var(--c);border-radius:18px;padding:12px;text-align:center;box-shadow:0 0 34px -4px var(--c)}
.zi{width:100%;aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:#0b1a1d;display:flex;align-items:center;justify-content:center;font-size:96px}
.zi img{width:100%;height:100%;object-fit:cover;display:block}
.zn{font-size:20px;font-weight:800;margin-top:10px;word-break:break-word}.zs{font-size:12px;color:#8fa9a4;margin-top:3px}
.zb{display:inline-block;font-size:13px;color:var(--c);margin-top:8px}.zv{font-size:24px;color:#3ddc97;font-weight:800;margin-top:6px}.zv small{display:block;font-size:10px;color:#6d8a84;letter-spacing:2px;font-weight:400}
.zt{font-size:11px;color:#6d8a84;margin-top:8px}
</style></head><body><div class="wrap">
<div class="trk" id="t">${portada}${paginas}</div>
<div class="foot"><button class="nav" onclick="go(-1)">‹</button><div class="dots" id="d">${Array.from({ length: totalPaginas }, () => '<b></b>').join('')}</div><button class="nav" onclick="go(1)">›</button><div class="cnt"><span id="i">1</span> / ${totalPaginas} · ${r.total} PZ</div></div>
</div>
<div class="zoom" id="z"><button class="zx" id="zx">✕</button><div class="zc" id="zc"></div></div>
<script>
var t=document.getElementById('t'),d=document.getElementById('d').children,i=document.getElementById('i'),cards=t.querySelectorAll('.card'),z=document.getElementById('z'),zc=document.getElementById('zc');
function act(){var w=t.clientWidth||1,n=Math.round(t.scrollLeft/w);for(var k=0;k<d.length;k++)d[k].className=k===n?'on':'';i.textContent=n+1;
for(var k=0;k<cards.length;k++){var x=(t.scrollLeft-k*w)/w;cards[k].style.transform=x>0&&x<1?'rotateY('+(-x*38)+'deg)':'';cards[k].style.opacity=x>0&&x<1?(1-x*.35):''}}
function go(s){t.scrollBy({left:s*t.clientWidth,behavior:'smooth'})}
t.addEventListener('scroll',act);act();
function mk(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function ver(s){
  zc.innerHTML='';zc.style.setProperty('--c',s.getAttribute('data-cl'));
  var zi=mk('div','zi'),im=s.querySelector('.foto img');
  if(im){var g=document.createElement('img');g.src=im.src;zi.appendChild(g)}else{zi.textContent=s.getAttribute('data-em')}
  zc.appendChild(zi);
  zc.appendChild(mk('div','zn',s.getAttribute('data-nm')));
  zc.appendChild(mk('div','zs',s.getAttribute('data-sr')));
  zc.appendChild(mk('div','zb',s.getAttribute('data-rz')));
  var v=mk('div','zv',s.getAttribute('data-vl'));v.appendChild(mk('small',null,'VALOR'));zc.appendChild(v);
  zc.appendChild(mk('div','zt','Carta #'+s.getAttribute('data-nu')+' · toca la ✕ para volver'));
  z.className='zoom on';
}
function cerrar(){z.className='zoom'}
document.getElementById('zx').addEventListener('click',function(e){e.stopPropagation();cerrar()});
z.addEventListener('click',function(e){if(e.target===z)cerrar()});
t.addEventListener('click',function(e){var s=e.target.closest?e.target.closest('.slot'):null;if(s&&s.hasAttribute('data-nm'))ver(s)});
</script></body></html>`;
}

async function enviarHTML(sock, jid, titulo, html, citado) {
  const { proto } = require('@whiskeysockets/baileys');
  const { construirContenido } = require('./menu-panel');
  const m = proto.Message.fromObject(construirContenido(titulo, html));
  const rr = m.botForwardedMessage && m.botForwardedMessage.message && m.botForwardedMessage.message.richResponseMessage;
  if (!rr || !rr.unifiedResponse || !rr.unifiedResponse.data || !rr.unifiedResponse.data.length) throw new Error('esta version de Baileys no trae richResponseMessage');
  await sock.relayMessage(jid, m, { messageId: '3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase() });
}

async function armarAlbum({ piezas, dueno, tomo = 1, prefix = '.' }) {
  const totalTomos = Math.max(1, Math.ceil(piezas.length / PIEZAS_POR_TOMO));
  tomo = Math.min(Math.max(1, tomo), totalTomos);
  const inicio = (tomo - 1) * PIEZAS_POR_TOMO;
  const local = await prepararFotos(piezas.slice(inicio, inicio + PIEZAS_POR_TOMO), MAX_IMAGENES);
  let fotos = new Map([...local.entries()].map(([i, uri]) => [inicio + i, uri]));
  let html = construirHTML({ piezas, fotos, dueno, tomo, prefix });
  let limite = fotos.size;
  while (html.length > MAX_HTML && limite > 0) {
    limite = Math.floor(limite / 2);
    fotos = new Map([...fotos.entries()].slice(0, limite));
    html = construirHTML({ piezas, fotos, dueno, tomo, prefix });
  }
  return { html, fotos: fotos.size, tomo, totalTomos };
}

module.exports = { PIEZAS_POR_TOMO, POR_PAGINA, VALOR_POR_RAREZA, reunirPiezas, resumen, completarImagenes, completarImagenesAnime, prepararFotos, construirHTML, armarAlbum, enviarHTML, dinero, EMOJI_RAREZA, NOMBRE_RAREZA };
