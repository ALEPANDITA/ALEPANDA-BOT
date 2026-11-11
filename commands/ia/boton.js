// .boton -> activa/desactiva a las IAs con voz en ESTE chat (por defecto desactivadas).
//   .boton                    Pandita (activa/desactiva)       .boton mei        Mei (activa/desactiva)
//   .boton on | off           Pandita                          .boton mei on|off Mei
//   .boton estado             cual esta activa aqui
//   .boton memoria            ayuda y conteo                   .boton memoria ver | borrar [todo]
//   Tambien: .boton mei memoria ver / borrar   (la memoria de cada una es aparte)
// Activar / desactivar: SOLO un owner del bot (en privado y en grupos). Ver estado y la memoria propia: cualquiera.
// En un grupo pueden estar las dos a la vez (cada una contesta a su @mencion). En privado solo una a la vez.
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, esAdminDelGrupo } = require('../../lib/permisos');
const { porId, TODAS, activar } = require('../../lib/ia-personas');

module.exports = {
  name: 'boton',
  category: 'ia',
  description: 'Activa/desactiva a Pandita (.boton) o a Mei (.boton mei) en este chat. Subcomandos: memoria, memoria ver, memoria borrar, estado',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const esGrupo = jid.endsWith('@g.us');
    let args = texto.slice(prefix.length).trim().split(/\s+/).slice(1).map((a) => a.toLowerCase());
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

    // Cual IA: "mei" / "pandita" al principio; sin nombre es Pandita (como siempre)
    let P = porId('pandita');
    if (args[0] && porId(args[0])) { P = porId(args[0]); args = args.slice(1); }
    const D = P.def;
    const comando = P.id === 'pandita' ? `${prefix}boton` : `${prefix}boton ${P.id}`;

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

    if (args[0] === 'estado') {
      return responder('🤖 *IAs en este chat*\n' + TODAS.map((p) => `${p.def.emoji} ${p.nombre}: ${p.estaActiva(jid) ? '✅ activa' : '⛔ apagada'}  (${prefix}boton${p.id === 'pandita' ? '' : ' ' + p.id})`).join('\n'));
    }

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
        `🧠 *Memoria de ${D.nombre}* (separada por chat)\n` +
        `Recuerdo ${c.usuario} cosa(s) de ti` + (esGrupo ? ` y ${c.grupo} del grupo` : '') + `.\n\n` +
        `${comando} memoria ver\n${comando} memoria borrar` + (esGrupo ? `\n${comando} memoria borrar todo (admins)` : '') +
        `\n\nLa memoria no se borra sola ni al reiniciar el bot.`
      );
    }

    if (args.length && !['on', 'off', 'activar', 'desactivar'].includes(args[0])) {
      return responder(`Uso:\n${prefix}boton (Pandita)   ${prefix}boton mei (Mei)\n${comando} on | off\n${comando} memoria | memoria ver | memoria borrar\n${prefix}boton estado`);
    }

    // Prender y apagar a las IAs es solo de los owners (gastan creditos de voz y de IA)
    if (!(await esOwnerBot(sock, leerConfig(), msg))) {
      return responder(`🔒 Solo un owner del bot puede activar o desactivar a ${D.nombre}.`);
    }

    let nuevo;
    if (['on', 'activar'].includes(args[0])) nuevo = true;
    else if (['off', 'desactivar'].includes(args[0])) nuevo = false;
    else nuevo = !P.estaActiva(jid);

    const apagadas = activar(P, jid, nuevo);

    if (nuevo) {
      const aviso = apagadas.length ? `\n(${apagadas.map((p) => p.nombre).join(' y ')} se apagó en este chat privado: aquí solo puede haber una a la vez)` : '';
      return responder((esGrupo ? D.textos.activadaGrupo : D.textos.activadaPrivado) + aviso);
    }
    return responder(D.textos.desactivada);
  }
};
