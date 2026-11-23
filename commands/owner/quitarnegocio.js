const { ejecutar } = require('../../lib/owner-negocios');
const { _resolverReceptor } = require('./darmoney');

module.exports = {
  name: 'quitarnegocio',
  aliases: ['quitarpropiedad', 'quitarcomercio'],
  category: 'owner',
  description: 'Quita una propiedad o una categoria completa a alguien (solo owner). Ej: .quitarnegocio tacos, .quitarnegocio comida',
  execute: (sock, jid, msg, { texto, prefix }) => ejecutar('quitar', sock, jid, msg, { texto, prefix, resolverReceptor: _resolverReceptor })
};
