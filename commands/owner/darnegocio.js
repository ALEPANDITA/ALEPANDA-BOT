const { ejecutar } = require('../../lib/owner-negocios');
const { _resolverReceptor } = require('./darmoney');

module.exports = {
  name: 'darnegocio',
  aliases: ['darpropiedad', 'darcomercio'],
  category: 'owner',
  description: 'Regala una propiedad o una categoria completa a alguien (solo owner). Ej: .darnegocio tacos, .darnegocio 12, .darnegocio comida',
  execute: (sock, jid, msg, { texto, prefix }) => ejecutar('dar', sock, jid, msg, { texto, prefix, resolverReceptor: _resolverReceptor })
};
