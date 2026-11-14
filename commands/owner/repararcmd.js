// .repararcmd <instruccion en español>  (solo owner)
//
// Ya no es solo "prueba y repara una categoria": le das instrucciones como a Claude y las sigue.
//   .repararcmd elimina todos los duplicados          (te muestra el plan, tu dices "si", hace respaldo y lo aplica)
//   .repararcmd duplicados de anime                   (solo detecta, no toca nada)
//   .repararcmd limpia los duplicados de anime y conserva los de fun
//   .repararcmd lista los comandos de anime · info de .pat · busca hentai
//   .repararcmd mueve .pat a fun · elimina .slap
//   .repararcmd como esta todo                        (salud general)
//   .repararcmd repara anime · prueba logos           (lo de siempre: probar de verdad y arreglar con IA)
//   .repararcmd deshaz lo ultimo · respaldos
// Motor: lib/cmdmaint.js · interprete: lib/cmdmaint-ia.js · plan/confirmacion: lib/cmdmaint-plan.js · flujo de reparar: lib/cmdmaint-reparar.js
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia } = require('../../lib/estilo');
const { procesarInstruccion } = require('../../lib/cmdmaint-plan');

module.exports = {
  name: 'repararcmd',
  aliases: ['revisarcmd'],
  category: 'owner',
  description: 'Solo owner: dale instrucciones en español para mantener los comandos. Ej: .repararcmd elimina todos los duplicados · duplicados de anime · repara anime · deshaz lo ultimo',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    if (!(await esOwnerBot(sock, config, msg))) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }
    const instruccion = String(texto || '').trim().replace(/^\S+\s*/, ''); // sin ".repararcmd"
    return procesarInstruccion({ sock, jid, msg, texto: instruccion, comandos, prefix });
  }
};
