// .boton -> activa/desactiva a Pandita en ESTE chat (por defecto desactivada).
// .boton on | off          -> forzar estado
// .boton memoria           -> ayuda y conteo
// .boton memoria ver       -> ver lo que Pandita recuerda (tuyo en este chat + del grupo)
// .boton memoria borrar    -> borra TU memoria en este chat (admins: "borrar todo" borra la del chat)
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, esAdminDelGrupo } = require('../../lib/permisos');
const P = require('../../lib/pandita');

module.exports = {
  name: 'boton',
  category: 'ia',
  description: 'Activa/desactiva a Pandita en este chat. Subcomandos: memoria, memoria ver, memoria borrar',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const esGrupo = jid.endsWith('@g.us');
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1).map((a) => a.toLowerCase());
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

    const metadata = esGrupo ? await sock.groupMetadata(jid).catch(() => null) : null;
    const uid = await P.idUsuario(sock, jid, msg, metadata);
    if (!uid) return responder('No pude identificarte, intenta de nuevo.');

    // En privado cualquiera maneja su chat. En grupos solo admins u owners.
    const puedeAdministrar = async () => {
      if (!esGrupo) return true;
      const remitente = msg.key.participant || msg.key.remoteJid;
      const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
      return esAdmin || (await esOwnerBot(sock, leerConfig(), msg));
    };

    if (args[0] === 'memoria') {
      const sub = args[1];

      if (sub === 'ver') {
        const m = P.verMemoria(jid, uid);
        const lineas = [];
        lineas.push(esGrupo ? '🧠 *Lo que recuerdo de ti en este grupo:*' : '🧠 *Lo que recuerdo de ti:*');
        lineas.push(m.usuario.length ? m.usuario.map((h, i) => `${i + 1}. ${h}`).join('\n') : '(nada guardado todavia)');
        if (esGrupo) {
          lineas.push('', '👥 *Lo que recuerdo del grupo:*');
          lineas.push(m.grupo.length ? m.grupo.map((h, i) => `${i + 1}. ${h}`).join('\n') : '(nada guardado todavia)');
        }
        return responder(lineas.join('\n'));
      }

      if (sub === 'borrar') {
        const todo = args[2] === 'todo';
        if (todo && esGrupo && !(await puedeAdministrar())) {
          return responder('Solo admins del grupo (o owners) pueden borrar toda la memoria del grupo.');
        }
        P.borrarMemoria(jid, uid, todo);
        return responder(todo || !esGrupo
          ? '🧹 Listo, borre toda mi memoria de este chat.'
          : '🧹 Listo, borre lo que recordaba de ti en este grupo.');
      }

      const c = P.contarMemoria(jid, uid);
      return responder(
        `🧠 *Memoria de Pandita* (separada por chat)\n` +
        `Recuerdo ${c.usuario} cosa(s) de ti` + (esGrupo ? ` y ${c.grupo} del grupo` : '') + `.\n\n` +
        `${prefix}boton memoria ver\n${prefix}boton memoria borrar` + (esGrupo ? `\n${prefix}boton memoria borrar todo (admins)` : '') +
        `\n\nLa memoria no se borra sola ni al reiniciar el bot.`
      );
    }

    if (args.length && !['on', 'off', 'activar', 'desactivar'].includes(args[0])) {
      return responder(`Uso:\n${prefix}boton (activa/desactiva)\n${prefix}boton on | off\n${prefix}boton memoria | memoria ver | memoria borrar`);
    }

    if (!(await puedeAdministrar())) {
      return responder('Solo admins del grupo (o owners) pueden activar o desactivar a Pandita.');
    }

    let nuevo;
    if (['on', 'activar'].includes(args[0])) nuevo = true;
    else if (['off', 'desactivar'].includes(args[0])) nuevo = false;
    else nuevo = !P.estaActiva(jid);

    P.setActiva(jid, nuevo);

    if (nuevo) {
      return responder(esGrupo
        ? `🎀 *Pandita activada* en este grupo ✨\nLlamala con *@Pandita* o respondiendo a uno de sus mensajes. Si nadie la llama, se queda calladita 🐼`
        : `🎀 *Pandita activada* ✨\nHablame normal, sin prefijo. Por ejemplo: "hola Pandita" 🐼`);
    }
    return responder('🐼 *Pandita desactivada* en este chat. Lo que recuerda se queda guardado.');
  }
};
