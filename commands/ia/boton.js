// .boton -> activa/desactiva a las IAs con voz en ESTE chat (por defecto desactivadas).
//   .boton                    Pandita (activa/desactiva)       .boton mei        Mei (activa/desactiva)
//   .boton on | off           Pandita                          .boton mei on|off Mei
//   .boton estado             cual esta activa aqui
//   .boton diagnostico        (owner) por que una IA no contesta en este chat
//   .boton memoria            ayuda y conteo                   .boton memoria ver | borrar [todo]
//   Tambien: .boton mei memoria ver / borrar   (la memoria de cada una es aparte)
// Activar / desactivar: SOLO un owner del bot (en privado y en grupos). Ver estado y la memoria propia: cualquiera.
// En un grupo pueden estar las dos a la vez (cada una contesta a su @mencion). En privado solo una a la vez.
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, esAdminDelGrupo } = require('../../lib/permisos');
const { porId, TODAS, activar } = require('../../lib/ia-personas');
const { esDuenoDelBot } = require('../../lib/ia-persona');
const { perfilPorId, idsDeMensaje } = require('../../lib/registro');
const { leerDB, getGrupo } = require('../../lib/db');
const apagados = require('../../lib/apagados');
const voz = require('../../lib/ia-voz');
const { getApiKeys } = require('../../lib/apikeys');

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

    if (['diagnostico', 'diag', 'debug'].includes(args[0])) {
      if (!(await esOwnerBot(sock, leerConfig(), msg))) return responder('🔒 Solo un owner del bot puede ver el diagnóstico.');
      const hace = (ts) => {
        if (!ts) return 'nunca (desde el último reinicio)';
        const seg = Math.round((Date.now() - ts) / 1000);
        return seg < 90 ? `hace ${seg} s` : seg < 5400 ? `hace ${Math.round(seg / 60)} min` : `hace ${Math.round(seg / 3600)} h`;
      };
      const lineas = ['🔎 *DIAGNÓSTICO DE ESTE CHAT*', esGrupo ? 'Tipo: grupo' : 'Tipo: privado'];
      if (esGrupo) {
        const g = getGrupo(leerDB(), jid);
        lineas.push(`Bot apagado aquí (.apagar): ${apagados.estaApagado(jid) ? '⛔ SÍ → no responde nada hasta que un owner use .encender' : 'no ✅'}`);
        lineas.push(`Modo solo-admins (.modoadmin): ${g.soloAdmins ? '🔒 sí → solo admins y owners le pueden hablar' : 'no ✅'}`);
        lineas.push(`Prefijo del grupo: ${g.prefix || leerConfig().prefix || '.'}`);
      }
      for (const p of TODAS) {
        const d = p.diagnostico(jid);
        const el = p.id === 'mei' ? 'ella' : 'él';
        lineas.push('', `${p.def.emoji} *${p.nombre}*: ${d.activa ? '✅ activa' : '⛔ apagada en este chat'}`);
        if (!d.activa) continue;
        if (esGrupo) lineas.push(`  Se le llama con *@${p.nombre}* o respondiendo a un mensaje suyo`);
        lineas.push(`  Último mensaje que le llegó: ${hace(d.visto && d.visto.ts)}${d.visto ? (d.visto.dirigido ? ` — era para ${el} ✅` : ` — NO iba dirigido a ${el}`) : ''}`);
        if (d.visto && !d.visto.dirigido && d.visto.snippet) lineas.push(`  Así lo vio el bot: "${d.visto.snippet}"`);
        lineas.push(`  Última respuesta: ${hace(d.exitoTs)}`);
        if (d.rechazo) lineas.push(`  Último motivo por el que NO contestó: ${d.rechazo.motivo} (${hace(d.rechazo.ts)})`);
        if (d.problemaMedio) lineas.push(`  Último problema con fotos/stickers/audios/PDF: ${d.problemaMedio.detalle} (${hace(d.problemaMedio.ts)})`);
        if (esGrupo) lineas.push(`  Personas hablando ahora: ${d.activosAhora}/${p.MAX_ACTIVOS_GRUPO}`);
      }
      // Modo novia de Mei: solo se muestra si quien pregunta es el desarrollador del bot
      const mei = porId('mei');
      if (mei.def.modoNovia && (await esDuenoDelBot(sock, msg, uid))) {
        let perfilD = null;
        for (const id of [uid, ...idsDeMensaje(msg, jid)]) { perfilD = perfilPorId(id); if (perfilD) break; }
        lineas.push('', perfilD && perfilD.edad >= 18
          ? '💗 Modo novia: ✅ Mei te habla de novia a ti (en grupos, más discreta); a los demás, normal'
          : `💗 Modo novia: ⚠️ te reconoce como dueño, pero no estás registrado con 18+ años → te trata como amigo. Usa ${prefix}registrar`);
      }
      const e = voz.estado();
      lineas.push('', `IA (Gemini): ${getApiKeys('gemini').length} clave(s)`);
      lineas.push('Voz: ' + TODAS.map((p) => `${p.nombre} ${voz.disponible(p.id) ? '✅' : '⚠️ texto'}`).join(' · ') + (!e.activo ? ' (voz apagada con .voz off)' : !e.claves ? ' (falta la clave de ElevenLabs)' : e.enPausaHasta ? ' (en pausa por créditos: .voz reanudar)' : ''));
      lineas.push('', `Cómo usarlo: en el grupo que falla manda "@Mei hola" (o "@Pandita hola") y enseguida escribe ${prefix}boton diagnostico. Si "Último mensaje que le llegó" no cambió, algo ANTES de la IA lo está frenando (grupo apagado, usuario muteado o bloqueado, antiflood/antispam). Si cambió y dice que no iba dirigido, la mención no se reconoció.`);
      return responder(lineas.join('\n'));
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
