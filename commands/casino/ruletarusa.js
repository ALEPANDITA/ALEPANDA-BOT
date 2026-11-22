const { manejarDuelo } = require('../../lib/duelos');
const { marco, aleatorio, elegir } = require('../../lib/cuadros');

const TITULO = 'RULETA RUSA';
const CLICKS = ['*click*... vacío 😮‍💨', '*click*... ¡se salvó! 😅', '*click*... ¡qué suerte! 🍀', '*click*... sudando frío 🥶', '*click*... ¡ufff, por poquito! 😰'];
const NERVIOS = ['💓 Late el corazón...', '😰 Le tiembla la mano...', '🥶 Una gota de sudor frío...', '🙏 Cierra los ojos y reza...'];

// Un revolver de 6 camaras con UNA bala: se turnan para jalar el gatillo y pierde quien reciba el disparo.
// (La logica del juego no cambia: solo la animacion es nueva, con pausas largas antes del disparo para dar suspenso.)
function jugar(a, b, monto) {
  const bala = aleatorio(6);          // en que jalada (0 a 5) sale el disparo
  const primero = aleatorio(2);       // quien jala primero (0 = retador, 1 = rival)
  const nombres = [a.tag, b.tag];
  const perdedor = (primero + bala) % 2;
  const cabecera = `${a.tag} 🆚 ${b.tag}  ·  💰 Bote $${monto * 2}`;

  // Tambor: 🟢 ya salio vacia · 🔫 la que se va a jalar · 💥 el disparo · ⚪ sin probar
  const tambor = (t, estado) => '[ ' + Array.from({ length: 6 }, (_, i) => (i < t ? '🟢' : i === t ? (estado === 'bang' ? '💥' : '🔫') : '⚪')).join(' ') + ' ]';
  // Giro del tambor: un marcador recorre las camaras
  const giro = (pos) => '[ ' + Array.from({ length: 6 }, (_, i) => (i === pos ? '🔘' : '⚪')).join(' ') + ' ]';
  const riesgo = (t) => {
    const quedan = 6 - t;
    const llenos = Math.min(6, Math.round(6 / quedan));
    return `🩸 Riesgo: ${'▰'.repeat(llenos)}${'▱'.repeat(6 - llenos)} ${Math.round(100 / quedan)}%  (1 bala en ${quedan} cámara${quedan === 1 ? '' : 's'})`;
  };
  const pantalla = (titulo, lineas, ms) => ({ texto: marco(titulo, [cabecera, '', ...lineas]), ms });
  const T = `🔫 ${TITULO} 🔫`;

  const cuadros = [
    pantalla(T, ['Se saca el revólver... 🔫'], 1100),
    pantalla(T, ['Se abre el tambor...', 'Se mete UNA sola bala 🔴'], 1300),
    pantalla(T, ['Se cierra el tambor... *clac* 🔒'], 1000)
  ];
  for (let i = 0; i < 9; i++) cuadros.push(pantalla(T, ['¡Se gira el tambor! 🌀', giro(i % 6)], 380));
  cuadros.push(pantalla(T, ['El tambor se detiene...', '⏳ Nadie sabe dónde quedó la bala'], 1400));
  // Quien empieza: el marcador salta entre los dos jugadores
  for (let i = 0; i < 5; i++) cuadros.push(pantalla(T, ['🎲 Sorteando quién empieza...', `👉 ${nombres[(primero + 1 + i) % 2]}`], 450));
  cuadros.push(pantalla(T, [`🎯 ¡Empieza ${nombres[primero]}!`], 1200));

  const historial = [];
  for (let t = 0; t <= bala; t++) {
    const quien = (primero + t) % 2;
    const ultima = t === 5;
    cuadros.push(pantalla(T, [...historial, `🎯 Turno de ${nombres[quien]}`, 'Toma el revólver y se lo pone en la sien... 🔫', tambor(t), riesgo(t)], 1500));
    cuadros.push(pantalla(T, [...historial, `🎯 ${nombres[quien]}`, ultima ? '😱 ¡Es la ÚLTIMA cámara! ¡Ya no hay escapatoria!' : elegir(NERVIOS), tambor(t), riesgo(t)], t === bala ? 2000 : 1300));
    if (t < bala) {
      historial.push(`${t + 1}️⃣ ${nombres[quien]} — ${elegir(CLICKS)}`);
      cuadros.push(pantalla(T, [...historial, `💨 ¡${nombres[quien]} se salvó! Pasa el revólver...`, tambor(t + 1)], 1300));
    } else {
      cuadros.push(pantalla(`💥 ${TITULO} 💥`, [...historial, `${t + 1}️⃣ ${nombres[quien]} jala el gatillo...`, '', '💥💥💥  *¡BANG!*  💥💥💥', tambor(t, 'bang')], 1300));
      cuadros.push(pantalla(`☠️ ${TITULO} ☠️`, [...historial, `${t + 1}️⃣ ${nombres[quien]} — 💥 *¡BANG!*`, '', `🩸 ${nombres[quien]} recibió el disparo...`, `☠️ ¡Cayó al suelo!`], 1600));
    }
  }
  return { ganador: 1 - perdedor, cuadros, resumen: `💥 ¡BANG! ${nombres[perdedor]} recibió el disparo.` };
}

module.exports = {
  name: 'ruletarusa',
  aliases: ['rr', 'rusa'],
  category: 'casino',
  description: 'Ruleta rusa 1 vs 1: retas a alguien con una apuesta, si acepta el bot les quita el dinero y el que sobrevive se lleva el bote. Ej: .ruletarusa @amigo 200',
  _jugar: jugar,
  execute: (sock, jid, msg, ctx) => manejarDuelo(sock, jid, msg, ctx, {
    comando: 'ruletarusa', titulo: TITULO, emoji: '🔫', minimo: 10, jugar,
    reglas: '🔫 *Ruleta rusa*: un revólver con 1 bala en 6 cámaras. Se turnan para jalar el gatillo; quien reciba el disparo pierde y el otro se lleva las dos apuestas.'
  })
};
