// lib/boda.js
// La boda: cuando alguien acepta una propuesta (.casar), el bot hace una pequeña ceremonia con mensajes.
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (j) => '@' + String(j || '').split('@')[0].split(':')[0];

async function celebrarBoda(sock, jid, a, b) {
  const A = tag(a);
  const B = tag(b);
  const menciones = [a, b];
  const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Tijuana' });
  const pasos = [
    `💒 *BODA EN LA MANADA* 💒\n\nQueridos invitados, hoy nos reunimos para unir en matrimonio a ${A} y ${B}. 💐`,
    `🎶 Suena la marcha nupcial...\n${A} y ${B} caminan hacia el altar entre pétalos y aplausos. 🌸👏`,
    `🧑‍⚖️ Si alguien se opone a esta unión, que hable ahora o calle para siempre...\n\n🦗 ...\n🦗 ...\n_(nadie dijo nada)_`,
    `💍 ${A}, ¿aceptas a ${B} en las buenas, en las malas y cuando se caiga el wifi?\n\n✅ *¡SÍ, ACEPTO!*`,
    `💍 ${B}, ¿aceptas a ${A} en las buenas, en las malas y cuando se caiga el wifi?\n\n✅ *¡SÍ, ACEPTO!*`,
    `🎉 Por el poder que me otorga este grupo, los declaro *unidos en matrimonio*.\nPueden besarse. 💋`,
    `🥂 ¡Felicidades ${A} y ${B}, ya están casados! 🎊\n📅 Fecha de la boda: ${fecha}\n\n_Escribe el comando de perfil para ver cuántos días llevan juntos._`
  ];
  for (let i = 0; i < pasos.length; i++) {
    await sock.sendMessage(jid, { text: pasos[i], mentions: menciones });
    if (i < pasos.length - 1) await esperar(2500);
  }
}

module.exports = { celebrarBoda };
