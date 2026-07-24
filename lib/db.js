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

function getUsuario(db, id) {
  const base = {
    warns: 0, muteado: false, saldo: 0, banco: 0, lastTrabajo: 0, lastDiario: 0,
    xp: 0, nivel: 1, ultimoXp: 0,
    vida: 100, lastCrimen: 0, lastRobar: 0, lastMinar: 0, lastCazar: 0,
    waifus: [], lastRoll: 0, pareja: null
  };
  if (!db.usuarios[id]) {
    db.usuarios[id] = { ...base };
  } else {
    db.usuarios[id] = { ...base, ...db.usuarios[id] };
  }
  return db.usuarios[id];
}

function getGrupo(db, id) {
  const base = {
    bienvenida: true,
    despedida: true,
    antilink: false,
    usarDescripcion: true,
    soloAdmins: false,
    niveles: true,
    nsfw: false,
    simonAutomatico: true,
    vozUnica: null,
    prefix: null,
    permisosCategorias: {},
    textoBienvenida: 'Bienvenido/a {user} al grupo {group}! 🎉',
    textoDespedida: '{user} salio del grupo. Hasta luego! 👋',
    welcomeMediaPath: null,
    welcomeMediaTipo: 'texto',
    byeMediaPath: null,
    byeMediaTipo: 'texto'
  };
  if (!db.grupos[id]) {
    db.grupos[id] = { ...base };
  } else {
    db.grupos[id] = { ...base, ...db.grupos[id] };
  }
  return db.grupos[id];
}

module.exports = { leerDB, guardarDB, getUsuario, getGrupo };
