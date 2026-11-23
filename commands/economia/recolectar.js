const eco = require('../../lib/eco-anim');
const N = require('../../lib/eco-negocios');
const S = require('../../lib/eco-subasta');
const { advertencia, porCategoria } = require('../../lib/estilo');
const { leerDB, guardarDB } = require('../../lib/db');

module.exports = {
  name: 'recolectar',
  aliases: ['ganancias', 'recaudar'],
  category: 'economia',
  description: 'Cobra lo que juntaron tus propiedades (hasta 24 h). Animado',
  execute: async (sock, jid, msg, { prefix = '.' } = {}) => {
    const estilo = porCategoria('economia');
    const remitente = msg.key.participant || msg.key.remoteJid;
    { const db0 = leerDB(); if (S.resolver(db0)) guardarDB(db0); }
    const { usuario, llave } = eco.ficha(remitente);
    const db = leerDB();
    const aviso = (t) => sock.sendMessage(jid, { text: advertencia(t, { titulo: 'RECOLECTAR', estilo }) }, { quoted: msg });

    const r0 = N.resumen(usuario, db);
    if (!r0.cantidad) return aviso(`Todavía no tienes propiedades. Mira las zonas con *${prefix}negocio*.`);
    const inicial = r0.porCobrar;
    if (inicial < 1) return aviso('Tus propiedades todavía no juntan nada. Vuelve en un rato.');

    await eco.correr(sock, jid, msg, `recolectar:${llave}`, async () => {
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'RECOLECTAR' });
      const emojis = r0.inv.items.sort((a, b) => b.hora - a.hora).slice(0, 8).map((e) => e.n.emoji).join(' ') + (r0.cantidad > 8 ? ` +${r0.cantidad - 8}` : '');

      await anim.paso([emojis, '', '🧾 Contando la caja...']);
      for (const p of [0.25, 0.5, 0.75, 1]) {
        await anim.paso([emojis, '', '💵 Contando...', eco.barra(p), `💰 ${eco.dinero(inicial * p)}`]);
      }

      const r = eco.actualizar(remitente, (u, d) => {
        const total = N.porCobrar(u, d);
        u.saldo = (Number(u.saldo) || 0) + total;
        u.negocioPendiente = 0;
        u.negocioCobro = Date.now();
        return { total, saldo: u.saldo, resumen: N.resumen(u, d) };
      });

      await anim.final([
        '✅ Caja recogida', '',
        emojis,
        `💰 Recolectaste: *${eco.dinero(r.total)}*`,
        `🏘️ ${r.resumen.cantidad} propiedades ganan ${eco.dinero(r.resumen.porHora)} por hora`,
        ...(r.resumen.inv.compartido ? [`💞 Compartidas con tu pareja${r.resumen.bonos ? ` · ${r.resumen.bonos} con bono x${N.BONO_PAREJA}` : ''}`] : []),
        `💼 Saldo actual: *${eco.dinero(r.saldo)}*`, '',
        `🗺️ Mira todo en *${prefix}mapa*`
      ]);
    });
  }
};
