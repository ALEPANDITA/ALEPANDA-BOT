const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const eco = require('../../lib/eco-anim');
const { caja, advertencia, porCategoria } = require('../../lib/estilo');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'mapa',
  aliases: ['map', 'mispropiedades', 'imperio'],
  category: 'economia',
  description: 'Mapa con todas tus propiedades: cuánto ganan por hora y cuánto juntan en 24 h',
  execute: async (sock, jid, msg, { prefix = '.' } = {}) => {
    const estilo = porCategoria('economia');
    const remitente = msg.key.participant || msg.key.remoteJid;
    { const db0 = leerDB(); if (S.resolver(db0)) guardarDB(db0); }
    const db = leerDB();
    const u = getUsuario(db, remitente);
    const r = N.resumen(u, db);
    if (!r.cantidad) {
      return sock.sendMessage(jid, { text: advertencia(`Tu mapa está vacío. Compra tu primera propiedad con *${prefix}negocio*.`, { titulo: 'MAPA', estilo }) }, { quoted: msg });
    }

    const nombre = u.perfilNombre || msg.pushName || `@${String(remitente).split('@')[0]}`;
    const s = r.inv.pareja;
    const nombrePareja = s ? (s.perfilNombre || s.nombre || null) : null;
    const resumenTexto = [
      `🏘️ Propiedades: *${r.cantidad}* de ${r.total}`,
      `⏱️ Por hora: *${eco.dinero(r.porHora)}*`,
      `📅 En 24 h: *${eco.dinero(r.en24)}*`,
      `💰 Por cobrar ya: *${eco.dinero(r.porCobrar)}*`,
      ...(r.inv.compartido ? [`💞 Compartido con tu pareja${r.bonos ? ` · ${r.bonos} con bono x${N.BONO_PAREJA}` : ''}`] : []),
      '', `Cóbralo con *${prefix}recolectar*`
    ];

    try {
      const { crearMapa } = require('../../lib/mapacard');
      const png = crearMapa({
        nombre, categorias: N.CATEGORIAS, porHora: r.porHora, en24: r.en24, porCobrar: r.porCobrar, cantidad: r.cantidad, total: r.total,
        bonos: r.bonos, compartido: r.inv.compartido, nombrePareja,
        items: r.inv.items.map((e) => ({ nombre: e.nombre, cat: e.n.cat, nivel: e.nivel, maxNivel: e.n.maxNivel, hora: e.hora, bono: e.bono, exclusiva: e.n.tipo === 'exclusiva', deMiPareja: !e.mio }))
      });
      return await sock.sendMessage(jid, { image: png, caption: `🗺️ *Mapa de propiedades*\n\n${resumenTexto.join('\n')}` }, { quoted: msg });
    } catch (e) {
      console.error('[mapa] no se pudo dibujar:', e && e.message ? e.message : e);
      const lineas = [...resumenTexto, ''];
      for (const it of r.inv.items.sort((a, b) => b.hora - a.hora).slice(0, 25)) lineas.push(`${it.n.emoji} ${it.nombre} — ${eco.dinero(it.hora)}/h`);
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'MAPA', estilo }) }, { quoted: msg });
    }
  }
};
