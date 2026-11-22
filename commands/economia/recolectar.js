const eco = require('../../lib/eco-anim');
const N = require('../../lib/eco-negocios');
const { advertencia, porCategoria } = require('../../lib/estilo');

module.exports = {
  name: 'recolectar',
  aliases: ['ganancias', 'recaudar'],
  category: 'economia',
  description: 'Cobra lo que juntaron tus negocios (hasta 24 h). Animado',
  execute: async (sock, jid, msg, { prefix = '.' } = {}) => {
    const estilo = porCategoria('economia');
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { usuario, llave } = eco.ficha(remitente);
    const aviso = (t) => sock.sendMessage(jid, { text: advertencia(t, { titulo: 'RECOLECTAR', estilo }) }, { quoted: msg });

    if (!N.propios(usuario).length) return aviso(`Todavía no tienes negocios. Mira la lista con *${prefix}negocio*.`);
    const inicial = N.porCobrar(usuario);
    if (inicial < 1) return aviso('Tus negocios todavía no juntan nada. Vuelve en un rato.');

    await eco.correr(sock, jid, msg, `recolectar:${llave}`, async () => {
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'RECOLECTAR' });
      const negocios = N.propios(usuario).map((id) => N.NEGOCIOS.find((n) => n.id === id).emoji).join(' ');

      await anim.paso([negocios, '', '🧾 Contando la caja...']);
      for (const p of [0.25, 0.5, 0.75, 1]) {
        await anim.paso([negocios, '', '💵 Contando...', eco.barra(p), `💰 ${eco.dinero(inicial * p)}`]);
      }

      // Recién ahora se lee la base: se cobra lo que haya en este momento y se reinicia el contador
      const r = eco.actualizar(remitente, (u) => {
        const total = N.porCobrar(u);
        u.saldo = (Number(u.saldo) || 0) + total;
        u.negocioPendiente = 0;
        u.negocioCobro = Date.now();
        return { total, saldo: u.saldo, hora: N.ingresoPorHora(u) };
      });

      await anim.final([
        '✅ Caja recogida', '',
        `${negocios}`,
        `💰 Recolectaste: *${eco.dinero(r.total)}*`,
        `📈 Tus negocios ganan ${eco.dinero(r.hora)} por hora`,
        `💼 Saldo actual: *${eco.dinero(r.saldo)}*`
      ]);
    });
  }
};
