const banco = require('./banco');

module.exports = {
  name: 'prestamo',
  aliases: ['prestamos', 'préstamo', 'préstamos', 'pagar', 'deuda'],
  category: 'economia',
  description: 'Préstamos del banco según tus negocios (.prestamo, .prestamo 2, .pagar todo, .deuda)',
  execute: async (sock, jid, msg, ctx) => {
    const partes = ctx.texto.trim().split(/\s+/);
    const cmd = (partes[0] || '').replace(/^[^a-zA-Zñáéíóú]+/, '').toLowerCase();
    const resto = partes.slice(1).join(' ');
    const accion = ['pagar', 'deuda'].includes(cmd) ? cmd : 'prestamo';
    return banco.execute(sock, jid, msg, { ...ctx, texto: `${ctx.prefix}banco ${accion} ${resto}`.trim() });
  }
};
