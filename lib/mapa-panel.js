'use strict';
// El .mapa como panel interactivo dentro de WhatsApp (se mueve con el dedo, se acerca/aleja y al tocar un comercio se ve en grande).
// Usa el mismo sistema de panel que .menupanel (lib/menu-panel.js). Todo se dibuja en el celular de quien lo ve.
//
// El script del panel (dibujo + cliente) va ya minificado en assets/mapa/mapa-panel.min.js para que el mensaje pese poco.
// Si cambias lib/mapa-edificios.js, lib/mapa-mundo.js o assets/mapa/cliente.js, vuelve a generarlo con:
//   cat lib/mapa-edificios.js lib/mapa-mundo.js assets/mapa/cliente.js | npx esbuild --minify --target=es2018 > assets/mapa/mapa-panel.min.js
// (si ese archivo no existe, se usan los 3 archivos tal cual).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { construirContenido } = require('./menu-panel');

const RAIZ = path.join(__dirname, '..');
let guion = null;
function scriptCliente() {
  if (guion) return guion;
  try { guion = fs.readFileSync(path.join(RAIZ, 'assets', 'mapa', 'mapa-panel.min.js'), 'utf8'); } catch (_) {
    guion = ['lib/mapa-edificios.js', 'lib/mapa-mundo.js', 'assets/mapa/cliente.js'].map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n;\n');
  }
  return guion;
}
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#0b1316;color:#e6f1ee;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}
.wrap{position:absolute;left:0;top:0;right:0;height:100%;display:flex;flex-direction:column;overflow:hidden;background:#0b1316}
.top{display:flex;align-items:center;gap:8px;padding:8px 10px 4px}.top b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.st{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding:0 10px 4px}.st::-webkit-scrollbar,.chips::-webkit-scrollbar{display:none}
.st span{flex:0 0 auto;font-size:11px;background:#12302b;border:1px solid #1f5a4a;color:#9fe8c4;border-radius:9px;padding:3px 8px}
.chips{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding:2px 10px 6px}
.chip{flex:0 0 auto;font-size:12px;background:#14232a;border:1.5px solid #24424a;color:#e6f1ee;border-radius:14px;padding:5px 10px}
.chip:active{background:#1d3a3a}
#vista{position:relative;display:flex;flex:1;min-height:0;overflow:auto;background:#0b1316;-webkit-overflow-scrolling:touch;border-top:1px solid #1d3a3a;border-bottom:1px solid #1d3a3a}
#mapa{display:block;flex:none;margin:auto}
.bar{display:flex;align-items:center;gap:6px;padding:6px 10px}
.bar button{background:#14232a;border:1px solid #24424a;color:#e6f1ee;border-radius:9px;min-width:40px;height:34px;font-size:18px;padding:0 10px}
.bar button:disabled{opacity:.35}.bar button.t{font-size:13px}
.bar small{flex:1;text-align:right;font-size:10px;color:#8fa9a4;line-height:1.25}
@media (max-width:430px){.bar small .l{display:none}}
.c .hd{display:flex;align-items:center;gap:5px;overflow-x:auto;scrollbar-width:none;padding:4px 8px;flex:none}.c .hd::-webkit-scrollbar{display:none}
.c .top{display:none}.c .st,.c .chips{display:contents}.c .st span,.c .chip{font-size:11px;padding:3px 8px}
.c #vista{border:0}.c #aviso{bottom:auto;top:44px}
.c .bar{position:absolute;left:6px;bottom:6px;background:rgba(11,19,22,.86);border:1px solid #24424a;border-radius:12px;padding:3px 5px;z-index:3}
.c .bar button{height:30px;min-width:34px;font-size:16px;padding:0 7px}.c .bar button.t{font-size:12px}.c .bar small{display:none}
.c #mod{padding:6px}.c .tarj{max-width:none;display:grid;grid-template-columns:42% 1fr;column-gap:10px;align-items:start;padding:8px}
.c #grande{grid-column:1;grid-row:1/3}.c .tarj h3{grid-column:2;margin:0 0 2px;font-size:15px}.c #info{grid-column:2;font-size:12px;line-height:1.4}
.c .bt{grid-column:1/3;margin-top:6px}.c .bt button{height:32px}
#carga{position:absolute;inset:0;display:flex;align-items:flex-start;padding-top:70px!important;justify-content:center;text-align:center;background:rgba(11,19,22,.88);color:#e6f1ee;font-size:14px;padding:20px;z-index:5}
#aviso{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);background:rgba(15,27,31,.95);border:1px solid #1f5a4a;color:#e6f1ee;border-radius:12px;padding:7px 12px;font-size:12px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:6;max-width:92%;text-align:center;line-height:1.3}
#mod{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.66);z-index:7;padding:10px}
.tarj{width:100%;max-width:340px;max-height:100%;overflow:auto;background:#0f1b1f;border:1px solid #1d3a3a;border-radius:16px;padding:10px}
#grande{display:block;width:100%;height:auto;border-radius:11px;background:#cde}
.tarj h3{font-size:17px;margin:8px 0 4px}
#info{font-size:13px;line-height:1.55;color:#cfe3de}#info small{color:#8fa9a4;font-size:11px}
.tag{display:inline-block;font-size:11px;border:1.5px solid #24424a;border-radius:9px;padding:2px 8px;margin:0 5px 4px 0}.tag.ok{border-color:#2fbf86;color:#3ddc97}.tag.no{border-color:#7a8790;color:#b4c0c6}
.bt{display:flex;gap:6px;margin-top:9px}.bt button{flex:1;background:#14232a;border:1px solid #24424a;color:#e6f1ee;border-radius:9px;height:36px;font-size:13px}
.bt button.p{background:#12302b;border-color:#1f5a4a;color:#9fe8c4}`;

function construirHTML(datos) {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
  const stats = (datos.res || []).map((t) => `<span>${esc(t)}</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head><body><div class="wrap">
<div class="hd"><div class="top"><b>🗺️ ${esc(datos.t || 'Mapa')}</b></div>
<div class="st">${stats}</div>
<div class="chips" id="chips"></div></div>
<div id="vista"><canvas id="mapa" width="2" height="2"></canvas></div>
<div class="bar"><button id="menos">−</button><button id="mas">+</button><button class="t" id="todo">Ver todo</button><button id="full" title="Pantalla completa">⛶</button><button id="giro" title="Girar de lado">⟳</button><small><span id="pct"></span><br><span class="l">Gris = aún no lo tienes</span></small></div>
<div id="carga">Dibujando tu mapa…</div><div id="aviso"></div>
<div id="mod"><div class="tarj"><canvas id="grande" width="640" height="540"></canvas><h3 id="tit"></h3><div id="info"></div><div class="bt"><button id="ant">‹</button><button class="p" id="ver">📍 Ubicar</button><button id="sig">›</button><button id="cerrar">✕</button></div></div></div>
</div><script>window.MAPA_DATA=${json};</script><script>${scriptCliente().replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}

async function enviarMapaPanel({ sock, jid, datos }) {
  const { proto } = require('@whiskeysockets/baileys');
  const html = construirHTML(datos);
  const m = proto.Message.fromObject(construirContenido('🗺️ ALEPANDA · MAPA', html));
  const rr = m.botForwardedMessage && m.botForwardedMessage.message && m.botForwardedMessage.message.richResponseMessage;
  if (!rr || !rr.unifiedResponse || !rr.unifiedResponse.data || !rr.unifiedResponse.data.length) throw new Error('esta version de Baileys no trae richResponseMessage');
  await sock.relayMessage(jid, m, { messageId: '3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase() });
  return html.length;
}

module.exports = { construirHTML, enviarMapaPanel };
