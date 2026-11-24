const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const eco = require('../../lib/eco-anim');
const { caja, advertencia, porCategoria } = require('../../lib/estilo');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { estadosMapa, datosPanel } = require('../../lib/mapa-estados');
const M = require('../../lib/mapa-mundo');

// .mapa → mapa ilustrado como panel interactivo (tocar comercios, acercar, mover)
// .mapa imagenes → las 4 partes del mismo mapa en imágenes (sin panel, para quien no le sirve)
// .mapa 1 … .mapa 4 → solo esa parte en imagen
module.exports = {
  name: 'mapa',
  aliases: ['map', 'mispropiedades', 'imperio'],
  category: 'economia',
  description: 'Mapa ilustrado de tu ciudad con todas las propiedades (gris = las que no tienes). Panel interactivo; .mapa imagenes o .mapa 1 al 4 en imágenes',
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const arg = N.sinAcentos(String(texto || '').trim().split(/\s+/).slice(1)[0] || '');
    const estilo = porCategoria('economia');
    const quiereImagenes = /^(imagenes|imagen|fotos|foto|img|todas|todo)$/.test(arg);
    const quierePanel = !arg || /^(panel|interactivo|menu)$/.test(arg);
    if (!quiereImagenes && !quierePanel && !/^[1-4]$/.test(arg)) {
      return sock.sendMessage(jid, { text: advertencia(`Usa *${prefix}mapa* para el mapa interactivo, *${prefix}mapa imagenes* para recibirlo en 4 imágenes, o *${prefix}mapa 1* … *${prefix}mapa 4* para una sola parte.`, { titulo: 'MAPA', estilo }) }, { quoted: msg });
    }
    const parte = /^[1-4]$/.test(arg) ? Number(arg) : 0;

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

    // ---- imágenes: .mapa imagenes (las 4) o .mapa 1 al .mapa 4 (una sola). Sin panel, sin tocar nada ----
    // Los números de arriba (propiedades, por hora, en 24 h, por cobrar) van dibujados dentro de cada imagen.
    const stats = [['Propiedades', `${r.cantidad} de ${r.total}`], ['Por hora', eco.dinero(r.porHora)], ['En 24 h', eco.dinero(r.en24)], ['Por cobrar', eco.dinero(r.porCobrar)], ...(r.inv.compartido ? [['Pareja', 'Compartido']] : [])];
    const enImagen = async (n, { todas = false } = {}) => {
      const render = require('../../lib/mapa-render');
      const buffer = render.dibujarParte(estados, n, { titulo: `Mapa de ${String(nombre).replace(/^@/, '')}`, stats });
      const aqui = render.resumenPartes(estados)[n - 1];
      const zonas = M.CUADRANTES[n - 1].map((id) => (N.CATEGORIAS.find((c) => c.id === id) || { nombre: id }).nombre).join(', ');
      const base = `🗺️ *Mapa de tu ciudad* — parte ${n} de 4 (${M.NOMBRE_CUADRANTE[n - 1]})\n📍 Zonas: ${zonas}\n✅ Aquí tienes ${aqui.tiene} de ${aqui.total} · lo gris aún no lo tienes`;
      let pie;
      if (todas) pie = n === 4 ? `\n\n${resumenTexto.join('\n')}\n\n📲 El mapa interactivo: *${prefix}mapa*` : '';
      else pie = `\n\n${resumenTexto.join('\n')}\n\n➡️ Otras partes: ${[1, 2, 3, 4].filter((x) => x !== n).map((x) => `*${prefix}mapa ${x}*`).join(' · ')} · todas: *${prefix}mapa imagenes*\n📲 El mapa interactivo: *${prefix}mapa*`;
      return sock.sendMessage(jid, { image: buffer, caption: base + pie }, { quoted: msg });
    };
    const enTexto = () => {
      const lineas = [...resumenTexto, ''];
      for (const it of r.inv.items.sort((a, b) => b.hora - a.hora).slice(0, 25)) lineas.push(`${it.n.emoji} ${it.nombre} — ${eco.dinero(it.hora)}/h`);
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'MAPA', estilo }) }, { quoted: msg });
    };

    if (quiereImagenes) {
      try { for (let n = 1; n <= 4; n++) await enImagen(n, { todas: true }); return; } catch (e) {
        console.error('[mapa] no se pudieron dibujar las imágenes:', e && e.message ? e.message : e);
        return enTexto();
      }
    }
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
        resumen: [`🏘️ ${r.cantidad} de ${r.total}`, `⏱️ ${eco.dinero(r.porHora)}/h`, `📅 ${eco.dinero(r.en24)} en 24 h`, `💰 ${eco.dinero(r.porCobrar)} por cobrar`, ...(r.inv.compartido ? ['💞 Con tu pareja'] : [])]
      });
      return await enviarMapaPanel({ sock, jid, datos });
    } catch (e) {
      console.error('[mapa] no se pudo mandar el panel:', e && e.message ? e.message : e);
      try { await sock.sendMessage(jid, { text: `No pude mandar el panel interactivo. Te mando la parte 1; usa *${prefix}mapa imagenes* para recibir las 4 partes.` }, { quoted: msg }); return await enImagen(1); } catch (e2) {
        console.error('[mapa] tampoco la imagen:', e2 && e2.message ? e2.message : e2);
        return enTexto();
      }
    }
  }
};
