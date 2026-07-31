const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { leerConfesiones } = require('../../lib/confesiones');
const { caja, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'verconfesion',
  category: 'owner',
  description: 'Muestra el registro de las ultimas confesiones enviadas, con el numero de quien las mando (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const registro = leerConfesiones();

    if (registro.length === 0) {
      return sock.sendMessage(jid, { text: advertencia('Todavia no hay ninguna confesion registrada.', { titulo: 'SIN REGISTROS', estilo: 'neon' }) });
    }

    const ultimas = registro.slice(-10).reverse();

    const lineas = ultimas.map((c, i) => {
      const fecha = new Date(c.fecha).toLocaleString('es-MX');
      return `${i + 1}. 📱 wa.me/${c.remitente}\n   🏷️ ${c.grupoNombre}\n   💬 "${c.confesion}"\n   🕐 ${fecha}`;
    });

    const texto = caja(lineas, {
      titulo: 'REGISTRO DE CONFESIONES',
      pie: `Mostrando las ultimas ${ultimas.length} de ${registro.length} totales`,
      estilo: 'neon'
    });

    await sock.sendMessage(jid, { text: texto });
  }
};
