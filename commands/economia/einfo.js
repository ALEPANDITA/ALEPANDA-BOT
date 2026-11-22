// Lista TODOS los comandos de economia, casino y duelos. Los de la tabla llevan una descripcion corta;
// cualquier comando nuevo de estas categorias sale solo (con la primera frase de su descripcion).
const CORTAS = {
  // economia
  saldo: 'ver tu dinero', banco: 'ver tu banco', depositar: 'guardar dinero en el banco', retirar: 'sacar dinero del banco',
  trabajar: 'trabaja cada 1 hora', diario: 'bono diario (24 h)', semanal: 'bono semanal de $4000 (7 días)', mensual: 'bono mensual de $20000 (30 días)',
  transferir: 'envía dinero a alguien', crimen: 'arriésgate por dinero (45 min)', robar: 'róbale a alguien (1 h)', slut: 'gana dinero con riesgo',
  cazar: 'caza animales por dinero (30 min)', curar: 'recupera la vida perdida cazando', minar: 'excava minerales (20 min)',
  pescar: 'pesca y vende (25 min)', matematicas: 'resuelve rápido y gana', topsaldo: 'ranking de los más ricos',
  // casino contra la casa
  apostar: 'cara o cruz', moneda: 'volado animado', ruleta: 'rojo/negro, par/impar o un número', tragamonedas: 'máquina tragamonedas',
  dados: 'apuesta alto / bajo / siete', crash: 'elige tu multiplicador antes de que se rompa', carrera: 'apuesta a tu corredor',
  cofre: 'abre un cofre sorpresa', raspadito: 'junta 3 premios iguales', blackjack: 'llega a 21 (luego .pedir / .plantarse)',
  cartas: 'carta alta contra la casa', loteria: 'elige un número del 1 al 10', aventura: 'explora en busca de tesoros', buceo: 'bucea por recompensas',
  // duelos contra otros jugadores
  ruletarusa: 'ruleta rusa 1 vs 1 (@rival monto)', duelodados: 'duelo de dados 1 vs 1 (@rival monto)'
};
const DUELOS = new Set(['ruletarusa', 'duelodados']);
const BANCO = new Set(['depositar', 'retirar']); // viven en la carpeta casino pero son de economia

const primeraFrase = (d) => String(d || '').split(/\.\s|:\s/)[0].slice(0, 60);

module.exports = {
  name: 'einfo',
  category: 'economia',
  description: 'Muestra todos los comandos de economía, casino y duelos',
  execute: async (sock, jid, msg, { prefix, comandos }) => {
    const unicos = comandos && comandos.values ? [...new Set(comandos.values())] : [];
    const de = (cat, filtro) => unicos.filter((c) => (c.category === cat || (cat === 'economia' && BANCO.has(c.name))) && c.name !== 'einfo' && filtro(c.name)).map((c) => c.name).sort();
    const linea = (n) => `${prefix}${n} — ${CORTAS[n] || primeraFrase((unicos.find((c) => c.name === n) || {}).description)}`;
    let economia = de('economia', () => true);
    let casino = de('casino', (n) => !DUELOS.has(n) && !BANCO.has(n));
    let duelos = de('casino', (n) => DUELOS.has(n));
    if (!unicos.length) { // sin el registro de comandos, se usa la tabla completa
      const tabla = Object.keys(CORTAS);
      duelos = tabla.filter((n) => DUELOS.has(n));
      economia = tabla.slice(0, tabla.indexOf('apostar'));
      casino = tabla.filter((n) => !economia.includes(n) && !DUELOS.has(n));
    }
    const bloque = (titulo, lista) => (lista.length ? `${titulo}\n${lista.map(linea).join('\n')}\n\n` : '');
    const texto = `📋 *EINFO — TODA LA ECONOMÍA*\n\n` +
      bloque('💰 *ECONOMÍA*', economia) +
      bloque('🎰 *CASINO (contra la casa)*', casino) +
      bloque('⚔️ *DUELOS (contra otros jugadores)*', duelos) +
      `ℹ️ Apuesta mínima: *$10*. Escribe cada comando sin datos para ver cómo se usa.\n` +
      `🔫 Duelo: *${prefix}ruletarusa @rival 200* → el rival responde *${prefix}ruletarusa aceptar*.`;
    await sock.sendMessage(jid, { text: texto.trim() }, { quoted: msg });
  }
};
