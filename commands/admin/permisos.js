// .permisos                              -> lista el permiso de cada categoria
// .permisos <categoria> todos            -> esa categoria la puede usar TODO el mundo, aunque el modo admin (.modoadmin on) este activo
// .permisos <categoria> admins           -> solo admins y owners
// .permisos <categoria> reset            -> la deja "normal" (sigue lo que diga el modo admin)
// La categoria se entiende en singular/plural, con o sin acentos ("downloads", "descargas" = download).
const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot, esAdminDelGrupo } = require('../../lib/permisos');

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clave = (t) => sinAcentos(t).replace(/[^a-z0-9]/g, '');
const sinS = (t) => t.replace(/s$/, '');

// Nombres en español que la gente usa para las categorias
const SINONIMOS = { descargas: 'download', descarga: 'download', downloader: 'download', dl: 'download' };

function resolverCategoria(entrada, disponibles) {
  const k = clave(entrada);
  if (!k) return null;
  const buscar = (x) => disponibles.find((c) => clave(c) === x) || disponibles.find((c) => sinS(clave(c)) === sinS(x));
  return buscar(k) || (SINONIMOS[k] ? buscar(clave(SINONIMOS[k])) : null) || null;
}

const MODOS_TODOS = new Set(['todos', 'todas', 'todo', 'all', 'abierto', 'abierta', 'abrir', 'publico', 'libre', 'everyone']);
const MODOS_ADMINS = new Set(['admins', 'admin', 'administradores', 'administrador', 'cerrado', 'cerrada', 'cerrar', 'privado']);
const MODOS_RESET = new Set(['reset', 'resetear', 'quitar', 'normal', 'defecto', 'default', 'auto', 'automatico', 'limpiar', 'borrar']);

function interpretarModo(palabras) {
  for (const w of palabras.map(sinAcentos)) {
    if (MODOS_TODOS.has(w)) return 'todos';
    if (MODOS_ADMINS.has(w)) return 'admins';
    if (MODOS_RESET.has(w)) return 'reset';
  }
  return null;
}

module.exports = {
  name: 'permisos',
  category: 'admin',
  description: 'Permisos por categoria. Ej: .permisos download todos (abierta para todos aunque el modo admin este activo) · .permisos casino admins · .permisos download reset',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix, comandos }) => {
    const config = leerConfig();
    const remitente = msg.key.participant;
    const esOwner = await esOwnerBot(sock, config, msg);

    let esAdmin = false;
    try { esAdmin = (await esAdminDelGrupo(sock, jid, remitente)).esAdmin; } catch (_) { esAdmin = false; }

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin o un owner del bot puede usar este comando.' });
    }

    // "downloads, todos" / "downloads: todos" tambien valen
    const partes = texto.slice((prefix + 'permisos').length).replace(/[,:;=]/g, ' ').trim().split(/\s+/).filter(Boolean);
    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const modoAdminActivo = !!grupo.soloAdmins;

    const categoriasDisponibles = [...new Set([...comandos.values()].map((c) => c.category || 'general'))].sort();

    if (!partes.length || sinAcentos(partes[0]) === 'list' || sinAcentos(partes[0]) === 'lista') {
      let t = '📋 *PERMISOS POR CATEGORIA*\n';
      t += `🔒 Modo admin (.modoadmin): ${modoAdminActivo ? '*activo*' : 'apagado'}\n\n`;
      for (const cat of categoriasDisponibles) {
        const explicito = grupo.permisosCategorias[cat];
        let estado;
        if (explicito === 'todos') estado = modoAdminActivo ? '*todos* ✅ (abierta aunque haya modo admin)' : '*todos*';
        else if (explicito === 'admins') estado = '*admins* 🔒';
        else estado = modoAdminActivo ? 'admins (por el modo admin)' : 'todos';
        t += `▸ ${cat}: ${estado}\n`;
      }
      t += `\nUso: ${prefix}permisos <categoria> <todos/admins/reset>`;
      if (modoAdminActivo) t += `\nCon el modo admin activo, ${prefix}permisos <categoria> todos abre esa categoria para todos.`;
      return sock.sendMessage(jid, { text: t });
    }

    const categoria = resolverCategoria(partes[0], categoriasDisponibles);
    if (!categoria) {
      return sock.sendMessage(jid, {
        text: `Categoria invalida: "${partes[0]}". Disponibles: ${categoriasDisponibles.join(', ')}`
      });
    }

    const modo = interpretarModo(partes.slice(1));
    if (!modo) {
      const actual = grupo.permisosCategorias[categoria];
      return sock.sendMessage(jid, {
        text: `Ahora *${categoria}* está en: *${actual || (modoAdminActivo ? 'normal (modo admin)' : 'normal (todos)')}*\nUso: ${prefix}permisos ${categoria} <todos/admins/reset>`
      });
    }

    if (modo === 'reset') {
      delete grupo.permisosCategorias[categoria];
      guardarDB(db);
      return sock.sendMessage(jid, {
        text: `Categoria *${categoria}* vuelve a lo normal: ${modoAdminActivo ? 'con el modo admin activo solo la usan admins y owners.' : 'todos la pueden usar.'}`
      });
    }

    grupo.permisosCategorias[categoria] = modo;
    guardarDB(db);

    let respuesta;
    if (modo === 'todos') {
      respuesta = modoAdminActivo
        ? `✅ Categoria *${categoria}* abierta para *todos*, aunque el modo admin esté activo. Las demás categorías siguen solo para admins.`
        : `✅ Categoria *${categoria}* configurada como: *todos*. Si activas el modo admin (${prefix}modoadmin on), esta categoría seguirá abierta para todos.`;
    } else {
      respuesta = `🔒 Categoria *${categoria}* configurada como: *admins* (solo admins y owners).`;
    }
    await sock.sendMessage(jid, { text: respuesta });
  }
};
