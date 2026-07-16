const rangos = [
  { nivel: 1, nombre: '🌱 Novato' },
  { nivel: 5, nombre: '💬 Charlatan' },
  { nivel: 10, nombre: '🔥 Activo' },
  { nivel: 20, nombre: '⭐ Veterano' },
  { nivel: 35, nombre: '👑 Leyenda' },
  { nivel: 50, nombre: '💎 Elite' }
];

function xpNecesario(nivel) {
  return Math.floor(50 * Math.pow(nivel, 1.5));
}

function obtenerRango(nivel) {
  let actual = rangos[0];
  for (const r of rangos) {
    if (nivel >= r.nivel) actual = r;
  }
  return actual.nombre;
}

function siguienteRango(nivel) {
  const siguiente = rangos.find(r => r.nivel > nivel);
  return siguiente ? `${siguiente.nombre} (nivel ${siguiente.nivel})` : 'Nivel maximo de rango alcanzado';
}

function darXp(usuario) {
  const ahora = Date.now();
  if (ahora - (usuario.ultimoXp || 0) < 60 * 1000) {
    return null;
  }

  usuario.ultimoXp = ahora;
  const xpGanado = Math.floor(Math.random() * 6) + 10;
  usuario.xp = (usuario.xp || 0) + xpGanado;

  let subioNivel = false;
  let requerido = xpNecesario(usuario.nivel || 1);

  while (usuario.xp >= requerido) {
    usuario.xp -= requerido;
    usuario.nivel = (usuario.nivel || 1) + 1;
    subioNivel = true;
    requerido = xpNecesario(usuario.nivel);
  }

  return { xpGanado, subioNivel, nivelNuevo: usuario.nivel };
}

module.exports = { xpNecesario, obtenerRango, siguienteRango, darXp, rangos };
