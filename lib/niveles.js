// Sistema de niveles y rangos de ALEPANDA BOT.
//
// Diseño clave para evitar los bugs del sistema anterior:
//
// 1. Solo se guarda la XP total del usuario (usuario.xp). El NIVEL y el RANGO
//    nunca se guardan por separado -- siempre se calculan a partir de la xp
//    con las funciones de aqui abajo. Asi es imposible que "nivel" y "xp"
//    queden desincronizados entre si, que era una fuente clasica de bugs.
//
// 2. El leaderboard (topnivel) NUNCA debe recorrer las claves de db.usuarios
//    directamente -- debe recorrer metadata.participants del grupo (la lista
//    real y unica de miembros que da WhatsApp) y buscar los datos de cada uno
//    por su id. Recorrer db.usuarios puede mostrar a la misma persona 2 veces
//    si quedo guardada con un @lid y con su numero real (@s.whatsapp.net) por
//    separado. Ver lib/identidad.js para la funcion que evita que eso pase al
//    momento de sumar xp.

const NIVEL_MAXIMO = 100;

const XP_POR_MENSAJE_MIN = 8;
const XP_POR_MENSAJE_MAX = 15;
const COOLDOWN_XP_MS = 45 * 1000; // evita farmear niveles mandando flood de mensajes

// XP que cuesta subir CADA nivel individual (no acumulada). Curva creciente
// pero moderada: los primeros niveles suben rapido (para que se sienta el
// progreso desde el inicio) y los ultimos cuestan bastante mas, sin volverse
// pero sin llegar a ser imposible de alcanzar con uso normal del grupo.
function xpDelNivel(nivel) {
  return Math.round(35 * nivel + Math.pow(nivel, 1.5));
}

// Tabla de XP ACUMULADA necesaria para llegar a cada nivel, calculada una
// sola vez al cargar el modulo. XP_ACUMULADA[n] = xp total necesaria para
// haber alcanzado el nivel n.
const XP_ACUMULADA = [0];
for (let n = 1; n <= NIVEL_MAXIMO; n++) {
  XP_ACUMULADA[n] = XP_ACUMULADA[n - 1] + xpDelNivel(n);
}

function calcularNivel(xpTotal) {
  const xp = Number(xpTotal) || 0;
  let nivel = 0;
  for (let n = 1; n <= NIVEL_MAXIMO; n++) {
    if (xp >= XP_ACUMULADA[n]) nivel = n;
    else break;
  }
  return nivel;
}

// Devuelve el progreso hacia el siguiente nivel (o null si ya es nivel maximo).
function progreso(xpTotal) {
  const xp = Number(xpTotal) || 0;
  const nivelActual = calcularNivel(xp);
  if (nivelActual >= NIVEL_MAXIMO) return null;

  const pisoNivelActual = XP_ACUMULADA[nivelActual] || 0;
  const techoSiguienteNivel = XP_ACUMULADA[nivelActual + 1];

  return {
    actual: xp - pisoNivelActual,
    necesaria: techoSiguienteNivel - pisoNivelActual,
    faltante: techoSiguienteNivel - xp
  };
}

// 20 rangos base, uno cada 5 niveles, tematica panda/bambu acorde a ALEPANDA BOT.
const RANGOS = [
  { hasta: 5, nombre: 'Cría de Panda 🐼' },
  { hasta: 10, nombre: 'Panda Curioso 🎋' },
  { hasta: 15, nombre: 'Explorador de Bambú 🌿' },
  { hasta: 20, nombre: 'Trepador Ágil 🧗' },
  { hasta: 25, nombre: 'Guardián del Bosque 🌳' },
  { hasta: 30, nombre: 'Cazador de Bambú 🍃' },
  { hasta: 35, nombre: 'Panda Veloz 💨' },
  { hasta: 40, nombre: 'Sabio del Bosque 📜' },
  { hasta: 45, nombre: 'Panda Guerrero ⚔️' },
  { hasta: 50, nombre: 'Maestro de Bambú 🎍' },
  { hasta: 55, nombre: 'Panda Místico 🔮' },
  { hasta: 60, nombre: 'Señor del Bosque 🌲' },
  { hasta: 65, nombre: 'Panda Imperial 👑' },
  { hasta: 70, nombre: 'Titán de Bambú 🏔️' },
  { hasta: 75, nombre: 'Panda Ancestral 🏮' },
  { hasta: 80, nombre: 'Espíritu del Bosque 👻' },
  { hasta: 85, nombre: 'Panda Celestial ✨' },
  { hasta: 90, nombre: 'Dios del Bambú 🌌' },
  { hasta: 95, nombre: 'Panda Supremo 💎' },
  { hasta: 100, nombre: 'Panda Legendario 🐉' }
];

// Insignias extra (un segundo "rango" bonus) en los niveles hito 25/50/75/100.
const INSIGNIAS_ESPECIALES = {
  25: 'Panda de Bronce 🥉',
  50: 'Panda de Plata 🥈',
  75: 'Panda de Oro 🥇',
  100: 'Panda Eterno 🏆'
};

function calcularRango(nivel) {
  if (nivel <= 0) return 'Sin rango';
  const encontrado = RANGOS.find(r => nivel <= r.hasta);
  return (encontrado || RANGOS[RANGOS.length - 1]).nombre;
}

function calcularInsignia(nivel) {
  return INSIGNIAS_ESPECIALES[nivel] || null;
}

// Da xp por hablar, con cooldown para que no se pueda farmear niveles
// mandando muchos mensajes seguidos. Devuelve null si no toco (por
// cooldown), o un objeto con el resultado si subio de nivel/rango.
function darXpPorMensaje(usuario) {
  const ahora = Date.now();
  if (usuario.lastXp && ahora - usuario.lastXp < COOLDOWN_XP_MS) return null;

  const nivelAntes = calcularNivel(usuario.xp || 0);
  if (nivelAntes >= NIVEL_MAXIMO) {
    usuario.lastXp = ahora;
    return null;
  }

  const ganancia = Math.floor(Math.random() * (XP_POR_MENSAJE_MAX - XP_POR_MENSAJE_MIN + 1)) + XP_POR_MENSAJE_MIN;
  usuario.xp = (usuario.xp || 0) + ganancia;
  usuario.lastXp = ahora;

  const nivelDespues = calcularNivel(usuario.xp);
  if (nivelDespues <= nivelAntes) return null;

  const rangoAntes = calcularRango(nivelAntes);
  const rangoDespues = calcularRango(nivelDespues);

  return {
    nivelAntes,
    nivelDespues,
    subioRango: rangoAntes !== rangoDespues,
    rango: rangoDespues,
    insignia: calcularInsignia(nivelDespues)
  };
}

// Fija a un usuario exactamente en un nivel (se usa para el comando de
// admin/owner de dar, quitar o fijar niveles). Como el nivel se deriva
// siempre de la xp, "fijar nivel N" es simplemente asignar la xp minima
// para ese nivel -- nunca se guarda un numero de nivel suelto.
function fijarNivel(usuario, nivelObjetivo) {
  const nivel = Math.max(0, Math.min(NIVEL_MAXIMO, Math.round(nivelObjetivo)));
  usuario.xp = XP_ACUMULADA[nivel] || 0;
  return {
    nivel,
    rango: calcularRango(nivel),
    insignia: calcularInsignia(nivel)
  };
}

function sumarNiveles(usuario, delta) {
  const nivelActual = calcularNivel(usuario.xp || 0);
  return fijarNivel(usuario, nivelActual + delta);
}

module.exports = {
  NIVEL_MAXIMO,
  calcularNivel,
  calcularRango,
  calcularInsignia,
  progreso,
  darXpPorMensaje,
  fijarNivel,
  sumarNiveles
};
