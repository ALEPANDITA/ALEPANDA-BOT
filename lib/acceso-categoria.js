// Quien puede usar un comando en un grupo, segun el modo admin (.modoadmin on) y los permisos por categoria (.permisos).
//
//   .permisos download todos   -> esa categoria queda ABIERTA PARA TODOS aunque el modo admin este activo
//   .permisos download admins  -> solo admins y owners (con o sin modo admin)
//   (sin configurar)           -> sigue al modo admin: con modo admin solo admins/owners, sin modo admin todos
//
// Devuelve: 'permitir' | 'modo-admin' (se ignora en silencio) | 'categoria-admins' (se avisa que es solo-admins)
function decidirAcceso({ soloAdmins = false, permisoCategoria = null, esAdmin = false, esOwner = false } = {}) {
  if (esAdmin || esOwner) return 'permitir';
  if (soloAdmins && permisoCategoria !== 'todos') return 'modo-admin';
  if (permisoCategoria === 'admins') return 'categoria-admins';
  return 'permitir';
}

module.exports = { decidirAcceso };
