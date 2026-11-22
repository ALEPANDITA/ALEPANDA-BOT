const eco = require('../../lib/eco-anim');
const N = require('../../lib/eco-negocios');
const { caja, advertencia, porCategoria } = require('../../lib/estilo');

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function lineasLista(usuario, prefix) {
  const mios = N.propios(usuario);
  const lineas = [
    'Tus negocios ganan dinero solos, aunque no estés.',
    `Se junta hasta ${N.MAX_HORAS} h y se cobra con *${prefix}recolectar*.`,
    ''
  ];
  N.NEGOCIOS.forEach((n, i) => {
    lineas.push(`${i + 1}. ${n.emoji} *${n.nombre}*${mios.includes(n.id) ? ' ✅ (tuyo)' : ''}`);
    lineas.push(`   ${eco.dinero(n.precio)} → +${eco.dinero(n.hora)} por hora`);
  });
  lineas.push('', `💵 Por cobrar: *${eco.dinero(N.porCobrar(usuario))}*`, `💼 Tu saldo: *${eco.dinero(usuario.saldo)}*`, '', `▸ Comprar: *${prefix}negocio comprar <número>*`);
  return lineas;
}

module.exports = {
  name: 'negocio',
  aliases: ['negocios', 'empresa'],
  category: 'economia',
  description: 'Compra negocios que ganan solos y cóbralos con .recolectar. Animado',
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const estilo = porCategoria('economia');
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = String(texto).trim().split(/\s+/).slice(1).filter(Boolean);
    const sub = sinAcentos(args[0]);
    const aviso = (t) => sock.sendMessage(jid, { text: advertencia(t, { titulo: 'NEGOCIOS', estilo }) }, { quoted: msg });

    const { usuario, llave } = eco.ficha(remitente);

    // ---------- lista ----------
    if (!sub || ['lista', 'ver', 'tienda'].includes(sub)) {
      return sock.sendMessage(jid, { text: caja(lineasLista(usuario, prefix), { titulo: 'NEGOCIOS', estilo }) }, { quoted: msg });
    }

    // ---------- compra ----------
    if (!['comprar', 'compra', 'buy'].includes(sub)) {
      return aviso(`No entendí. Usa *${prefix}negocio* para ver la lista o *${prefix}negocio comprar <número>*.`);
    }
    const negocio = N.buscarNegocio(args.slice(1).join(' '));
    if (!negocio) return aviso(`Dime cuál negocio. Ej: *${prefix}negocio comprar 1*`);
    if (N.propios(usuario).includes(negocio.id)) return aviso(`Ya tienes ${negocio.emoji} ${negocio.nombre}.`);
    if ((Number(usuario.saldo) || 0) < negocio.precio) {
      return aviso(`Te faltan ${eco.dinero(negocio.precio - (Number(usuario.saldo) || 0))} para comprar ${negocio.emoji} ${negocio.nombre} (${eco.dinero(negocio.precio)}).`);
    }

    await eco.correr(sock, jid, msg, `negocio:${llave}`, async () => {
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'NEGOCIOS' });
      const titulo = `${negocio.emoji} ${negocio.nombre}`;
      await anim.paso([titulo, '', '📝 Firmando el contrato...']);
      await anim.paso([titulo, '', '🏗️ Construyendo...', eco.barra(0.3)]);
      await anim.paso([titulo, '', '🏗️ Construyendo...', eco.barra(0.7)]);
      await anim.paso([titulo, '', '🎀 Cortando el listón...', eco.barra(1)]);

      // Recién ahora se lee la base y se cobra. Lo que ya habían ganado los otros negocios se guarda aparte.
      const r = eco.actualizar(remitente, (u) => {
        const saldo = Number(u.saldo) || 0;
        if (N.propios(u).includes(negocio.id)) return { error: 'ya' };
        if (saldo < negocio.precio) return { error: 'saldo', saldo };
        const ahora = Date.now();
        u.negocioPendiente = N.porCobrar(u, ahora);
        u.negocioCobro = ahora;
        u.negocios = [...N.propios(u), negocio.id];
        u.saldo = saldo - negocio.precio;
        return { saldo: u.saldo, hora: N.ingresoPorHora(u), cantidad: u.negocios.length };
      });

      if (r.error) {
        return anim.final([titulo, '', r.error === 'ya' ? '❌ Ya tenías este negocio.' : '❌ Ya no te alcanza el dinero. No se cobró nada.']);
      }
      await anim.final([
        '🎉 ¡Inauguración!', '',
        `${titulo} ya es tuyo`,
        `💸 Pagaste: ${eco.dinero(negocio.precio)}`,
        `📈 Tus ${r.cantidad} negocio(s) ganan ${eco.dinero(r.hora)} por hora`,
        `💼 Saldo actual: *${eco.dinero(r.saldo)}*`,
        '', `Cobra con *${prefix}recolectar*`
      ]);
    });
  }
};
