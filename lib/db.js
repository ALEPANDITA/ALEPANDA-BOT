const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database.json');

function leerDB() {
  if (!fs.existsSync(dbPath)) {
    const inicial = { usuarios: {}, grupos: {} };
    fs.writeFileSync(dbPath, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function guardarDB(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Devuelve (y crea o completa si faltan campos) los datos de un usuario especifico
function getUsuario(db, id) {
  const base = { warns: 0, muteado: false, saldo: 0, banco: 0, lastTrabajo: 0, lastDiario: 0 };
  if (!db.usuarios[id]) {
    db.usuarios[id] = { ...base };
  } else {
    db.usuarios[id] = { ...base, ...db.usuarios[id] };
  }
  return db.usuarios[id];
}

// Devuelve (y crea si no existe) los datos de un grupo especifico
function getGrupo(db, id) {
  if (!db.grupos[id]) {
  db.grupos[id] = {
      bienvenida: true,
      despedida: true,
      antilink: false,
      usarDescripcion: true,
      textoBienvenida: 'Bienvenido/a {user} al grupo {group}! 🎉',
      textoDespedida: '{user} salio del grupo. Hasta luego! 👋'
    };
  }
  return db.grupos[id];
}

module.exports = { leerDB, guardarDB, getUsuario, getGrupo };
