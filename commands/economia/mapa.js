const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const eco = require('../../lib/eco-anim');
const { caja, advertencia, porCategoria } = require('../../lib/estilo');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { estadosMapa, datosPanel } = require('../../lib/mapa-estados');
const M = require('../../lib/mapa-mundo');

// .mapa → mapa ilustrado como panel interactivo (tocar comercios, acercar, mover)
// .mapa 1 … .mapa 4 → el mismo mapa partido en 4 imágenes, para quien las prefiera
module.exports = {
  name: 'mapa',
  aliases: ['map', 'mispropiedades', 'imperio'],
  category: 'economia',
  description: 'Mapa ilustrado de tu ciudad con todas las propiedades (gris = las que no tienes). Panel interactivo; .mapa 1 al .mapa 4 en imágenes',
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const arg = String(texto || '').trim().split(/\s+/).slice(1)[0] || '';
    const estilo = porCategoria('economia');
    if (arg && !/^[1-4]$/.test(arg)) {
      return sock.sendMessage(jid, { text: advertencia(`Usa *${prefix}mapa* para el mapa interactivo, o *${prefix}mapa 1*, *${prefix}mapa 2*, *${prefix}mapa 3*, *${prefix}mapa 4* para verlo en imágenes.`, { titulo: 'MAPA', estilo }) }, { quoted: msg });
    }
    const parte = arg ? Number(arg) : 0;

    const remitente = msg.key.participant || msg.key.remoteJid;
    { const db0 = leerDB(); if (S.resolver(db0)) guardarDB(db0); }
    const db = leerDB();
    const u = getUsuario(db, remitente);
    const r = N.resumen(u, db);
    const estados = estadosMapa(u, db);

    const nombre = u.perfilNombre || msg.pushName || `@${String(remitente).split('@')[0]}`;
    const resumenTexto = [
      `🏘️ Propiedades: *${r.cantidad}* de ${r.total}`,
      `⏱️ Por hora: *${eco.dinero(r.porHora)}*`,
      `📅 En 24 h: *${eco.dinero(r.en24)}*`,
      `💰 Por cobrar ya: *${eco.dinero(r.porCobrar)}*`,
      ...(r.inv.compartido ? [`💞 Compartido con tu pareja${r.bonos ? ` · ${r.bonos} con bono x${N.BONO_PAREJA}` : ''}`] : []),
      '', r.cantidad ? `Cóbralo con *${prefix}recolectar*` : `Aún no tienes propiedades: compra la primera con *${prefix}negocio*`
    ];

    // ---- imágenes: .mapa 1 al .mapa 4 ----
    const enImagen = async (n) => {
      const render = require('../../lib/mapa-render');
      const buffer = render.dibujarParte(estados, n, { titulo: `Mapa de ${String(nombre).replace(/^@/, '')}` });
      const aqui = render.resumenPartes(estados)[n - 1];
      const zonas = M.CUADRANTES[n - 1].map((id) => (N.CATEGORIAS.find((c) => c.id === id) || { nombre: id }).nombre).join(', ');
      const otras = [1, 2, 3, 4].filter((x) => x !== n).map((x) => `*${prefix}mapa ${x}*`).join(' · ');
      return sock.sendMessage(jid, {
        image: buffer,
        caption: `🗺️ *Mapa de tu ciudad* — parte ${n} de 4 (${M.NOMBRE_CUADRANTE[n - 1]})\n📍 Zonas: ${zonas}\n✅ Aquí tienes ${aqui.tiene} de ${aqui.total} · lo gris aún no lo tienes\n\n${resumenTexto.join('\n')}\n\n➡️ Otras partes: ${otras}\n📲 El mapa completo e interactivo: *${prefix}mapa*`
      }, { quoted: msg });
    };
    const enTexto = () => {
      const lineas = [...resumenTexto, ''];
      for (const it of r.inv.items.sort((a, b) => b.hora - a.hora).slice(0, 25)) lineas.push(`${it.n.emoji} ${it.nombre} — ${eco.dinero(it.hora)}/h`);
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'MAPA', estilo }) }, { quoted: msg });
    };

    if (parte) {
      try { return await enImagen(parte); } catch (e) {
        console.error('[mapa] no se pudo dibujar la imagen:', e && e.message ? e.message : e);
        return enTexto();
      }
    }

    // ---- panel interactivo (lo normal) ----
    try {
      const { enviarMapaPanel } = require('../../lib/mapa-panel');
      const datos = datosPanel(estados, {
        titulo: `Mapa de ${String(nombre).replace(/^@/, '')}`, prefix,
        resumen: [`🏘️ ${r.cantidad} de ${r.total}`, `⏱️ ${eco.dinero(r.porHora)}/h`, `💰 ${eco.dinero(r.porCobrar)} por cobrar`, ...(r.inv.compartido ? ['💞 Con tu pareja'] : [])]
      });
      return await enviarMapaPanel({ sock, jid, datos });
    } catch (e) {
      console.error('[mapa] no se pudo mandar el panel:', e && e.message ? e.message : e);
      try { await sock.sendMessage(jid, { text: `No pude mandar el panel interactivo. Te mando la parte 1; usa *${prefix}mapa 2*, *${prefix}mapa 3* y *${prefix}mapa 4* para el resto.` }, { quoted: msg }); return await enImagen(1); } catch (e2) {
        console.error('[mapa] tampoco la imagen:', e2 && e2.message ? e2.message : e2);
        return enTexto();
      }
    }
  }
};
