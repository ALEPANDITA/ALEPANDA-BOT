const { caja, exito, advertencia, error: cajaError } = require('../../lib/estilo');
const { parsearRegistro, obtenerRegistro, guardarRegistro, borrarRegistro, EDAD_MIN, EDAD_MAX, NOMBRE_MAX, ETIQUETA_SEXO } = require('../../lib/registro');

// Registro obligatorio para usar el menu: nombre, edad y sexo (hombre o mujer). Las IAs del bot (Simi, Panda, Simon,
// Cupido, Pandita) usan estos datos para hablarle a cada persona en femenino o masculino.
module.exports = {
  name: 'registrar',
  aliases: ['reg', 'registro', 'registrarme'],
  category: 'general',
  description: 'Registrate para usar el menu: .registrar <nombre> <edad> <hombre/mujer> (ej: .registrar Ale 20 mujer). Ver tu registro: .registrar | borrarlo: .registrar borrar',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const partes = String(texto || '').trim().split(/\s+/);
    const args = partes.slice(1).join(' ').trim();
    const ejemplo = `${prefix}registrar Ale 20 mujer`;

    let metadata = null;
    if (String(jid).endsWith('@g.us')) { try { metadata = await sock.groupMetadata(jid); } catch (_) { metadata = null; } }

    // .registrar  -> ver como estas registrado (o como hacerlo)
    if (!args) {
      const actual = await obtenerRegistro(sock, msg, jid, metadata);
      if (actual) {
        const r = actual.usuario.registro;
        return sock.sendMessage(jid, {
          text: caja([
            `👤 Nombre: *${r.nombre}*`, `🎂 Edad: *${r.edad}*`, `🚻 Sexo: *${ETIQUETA_SEXO[actual.usuario.genero] || ETIQUETA_SEXO[r.sexo]}*`,
            '', `Para cambiarlo: ${ejemplo}`, `Para borrarlo: ${prefix}registrar borrar`
          ], { titulo: 'TU REGISTRO', estilo: 'neon' })
        }, { quoted: msg });
      }
      return sock.sendMessage(jid, {
        text: caja([
          'Para usar el menu primero tienes que registrarte.', '',
          `Escribe: ${prefix}registrar <nombre> <edad> <hombre o mujer>`, `Ejemplo: ${ejemplo}`
        ], { titulo: 'REGISTRO', estilo: 'neon' })
      }, { quoted: msg });
    }

    // .registrar borrar
    if (/^(borrar|eliminar|quitar|reset)$/i.test(args)) {
      const borrado = await borrarRegistro(sock, msg, jid, metadata);
      return sock.sendMessage(jid, {
        text: borrado
          ? caja(['Listo, borre tu registro. Para volver a usar el menu registrate de nuevo.', `Ejemplo: ${ejemplo}`], { titulo: 'REGISTRO BORRADO', estilo: 'neon' })
          : advertencia('No tenias ningun registro.', { titulo: 'REGISTRO', estilo: 'neon' })
      }, { quoted: msg });
    }

    // .registrar <nombre> <edad> <sexo>
    const r = parsearRegistro(args);
    if (!r.ok) {
      const motivo = {
        sexo: 'Falta tu sexo: escribe *hombre* o *mujer*.',
        edad: 'Falta tu edad (un numero).',
        edad_rango: `Escribe una edad real (de ${EDAD_MIN} a ${EDAD_MAX} años).`,
        nombre: `Falta tu nombre (letras, maximo ${NOMBRE_MAX} caracteres).`,
        vacio: 'Faltan tus datos.'
      }[r.error] || 'No entendi tus datos.';
      return sock.sendMessage(jid, {
        text: advertencia(`${motivo}\n\nFormato: ${prefix}registrar <nombre> <edad> <hombre o mujer>\nEjemplo: ${ejemplo}`, { titulo: 'REGISTRO', estilo: 'neon' })
      }, { quoted: msg });
    }

    try {
      const { actualizado } = await guardarRegistro(sock, msg, jid, r, metadata);
      const trato = r.sexo === 'mujer' ? 'como mujer' : 'como hombre';
      await sock.sendMessage(jid, {
        text: caja([
          actualizado ? '✅ Registro actualizado.' : '✅ ¡Registro listo!', '',
          `👤 Nombre: *${r.nombre}*`, `🎂 Edad: *${r.edad}*`, `🚻 Sexo: *${ETIQUETA_SEXO[r.sexo]}*`, '',
          `Ya puedes usar ${prefix}menu. Simi, Panda y los demas te hablaran ${trato}.`
        ], { titulo: 'REGISTRO', estilo: 'neon' })
      }, { quoted: msg });
    } catch (err) {
      console.error('[registro] No pude guardar el registro:', err && err.message ? err.message : err);
      await sock.sendMessage(jid, { text: cajaError('No pude guardar tu registro. Intenta de nuevo en un momento.', { estilo: 'neon' }) }, { quoted: msg });
    }
  }
};
