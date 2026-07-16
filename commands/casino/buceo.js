const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { xpNecesario } = require('../../lib/niveles');

let cooldownsBuceo = {};

const zonas = [
  { prob: 0.01, zona: 'Trono del Dios del Mar', emoji: '👑', tier: '⭐ LEGENDARIO',
    descripciones: ['Encontraste el trono perdido de Poseidon lleno de oro', 'Una luz divina te guio hasta riquezas infinitas', 'Los dioses del mar te bendijeron con sus tesoros'],
    dMin: 40, dMax: 60, eMin: 60, eMax: 90 },
  { prob: 0.02, zona: 'Atlantida Perdida', emoji: '🏛️', tier: '⭐ LEGENDARIO',
    descripciones: ['Encontraste la ciudad sumergida de Atlantida', 'Las ruinas doradas de Atlantida brillaban ante ti', 'Descubriste secretos y riquezas de la civilizacion perdida'],
    dMin: 35, dMax: 55, eMin: 55, eMax: 80 },
  { prob: 0.04, zona: 'Guarida del Kraken Anciano', emoji: '🦑', tier: '🔥 EPICO',
    descripciones: ['Robaste los tesoros mientras el Kraken dormia', 'Venciste al Kraken y tomaste su botin', 'El Kraken te ofrecio joyas a cambio de tu libertad'],
    dMin: 25, dMax: 40, eMin: 40, eMax: 60 },
  { prob: 0.03, zona: 'Barco Pirata Hundido', emoji: '🏴‍☠️', tier: '🔥 EPICO',
    descripciones: ['Encontraste el legendario barco del Capitan Maldito', 'Un galeon pirata lleno de oro yacia en el fondo', 'El cofre del tesoro pirata estaba intacto'],
    dMin: 22, dMax: 38, eMin: 35, eMax: 55 },
  { prob: 0.03, zona: 'Templo Submarino Antiguo', emoji: '⛩️', tier: '🔥 EPICO',
    descripciones: ['Un templo milenario guardaba ofrendas de oro', 'Los dioses antiguos dejaron sus reliquias aqui', 'Encontraste artefactos sagrados de gran valor'],
    dMin: 20, dMax: 35, eMin: 30, eMax: 50 },
  { prob: 0.06, zona: 'Arrecife de Cristal Magico', emoji: '💎', tier: '💜 RARO',
    descripciones: ['Los cristales del arrecife brillaban como diamantes', 'Recolectaste cristales magicos del fondo marino', 'Un arrecife encantado te lleno los bolsillos'],
    dMin: 12, dMax: 22, eMin: 20, eMax: 35 },
  { prob: 0.06, zona: 'Cueva de la Sirena', emoji: '🧜‍♀️', tier: '💜 RARO',
    descripciones: ['Una sirena te regalo perlas magicas', 'La sirena canto y aparecio oro a tus pies', 'Intercambiaste historias por joyas con la sirena'],
    dMin: 10, dMax: 20, eMin: 18, eMax: 30 },
  { prob: 0.05, zona: 'Jardin de Coral Dorado', emoji: '🪸', tier: '💜 RARO',
    descripciones: ['Corales dorados que valen una fortuna', 'El jardin de coral guardaba joyas entre sus ramas', 'Recolectaste coral dorado muy preciado'],
    dMin: 9, dMax: 18, eMin: 15, eMax: 28 },
  { prob: 0.05, zona: 'Naufragio Mercante', emoji: '⚓', tier: '💜 RARO',
    descripciones: ['Un barco mercante hundido lleno de mercancias', 'La bodega del barco guardaba valiosas especias', 'Encontraste monedas antiguas en el naufragio'],
    dMin: 8, dMax: 16, eMin: 14, eMax: 25 },
  { prob: 0.09, zona: 'Cueva Submarina Oscura', emoji: '🌀', tier: '💚 COMUN',
    descripciones: ['En la oscuridad encontraste algunas monedas', 'Una pequeña grieta escondia unas pocas joyas', 'Entre las rocas hallaste algo de valor'],
    dMin: 4, dMax: 9, eMin: 8, eMax: 15 },
  { prob: 0.08, zona: 'Banco de Algas Luminosas', emoji: '🌿', tier: '💚 COMUN',
    descripciones: ['Las algas luminosas escondian pequeñas perlas', 'Entre las algas habia algunas cositas valiosas', 'Recolectaste plantas marinas de poco valor'],
    dMin: 3, dMax: 8, eMin: 6, eMax: 12 },
  { prob: 0.09, zona: 'Fondo Arenoso Tranquilo', emoji: '🐚', tier: '💚 COMUN',
    descripciones: ['Solo conchas y arena pero algo brillo', 'Una concha especial tenia una perla dentro', 'El fondo tranquilo te dio poco pero algo es algo'],
    dMin: 2, dMax: 6, eMin: 4, eMax: 10 },
  { prob: 0.09, zona: 'Arrecife Colorido', emoji: '🐠', tier: '💚 COMUN',
    descripciones: ['Los peces coloridos te guiaron a unas monedas', 'Entre los corales habia algo de valor escondido', 'Un pez curioso te trajo un pequeño regalo'],
    dMin: 2, dMax: 5, eMin: 3, eMax: 8 },
  { prob: 0.08, zona: 'Ataque de Tiburon', emoji: '🦈', tier: '💀 PELIGRO',
    descripciones: ['Un tiburon blanco te ataco y perdiste tus cosas', 'La mandibula del tiburon destrozo tu equipo', 'Huiste del tiburon pero dejaste tus diamantes'],
    dMin: -8, dMax: -3, eMin: 2, eMax: 6 },
  { prob: 0.07, zona: 'Corriente Submarina', emoji: '🌊', tier: '💀 PELIGRO',
    descripciones: ['La corriente te arrastro lejos y perdiste todo', 'Una corriente inesperada se llevo tu botin', 'El remolino submarino te robo los diamantes'],
    dMin: -6, dMax: -2, eMin: 1, eMax: 5 },
  { prob: 0.08, zona: 'Trampa de Medusas', emoji: '🪼', tier: '💀 PELIGRO',
    descripciones: ['Las medusas te paralizaron y alguien te robo', 'El veneno de medusa te hizo soltar todo', 'Un banco de medusas bloqueo tu regreso'],
    dMin: -5, dMax: -1, eMin: 1, eMax: 4 },
  { prob: 0.07, zona: 'Aguas Toxicas', emoji: '☠️', tier: '💀 PELIGRO',
    descripciones: ['Las aguas contaminadas arruinaron tu equipo', 'El veneno del agua disolvio tus diamantes', 'Tuviste que salir corriendo y perdiste todo'],
    dMin: -7, dMax: -2, eMin: 1, eMax: 3 }
];

module.exports = {
  name: 'buceo',
  category: 'casino',
  description: 'Bucea en busca de tesoros marinos (cooldown 10 min)',
  execute: async (sock, jid, msg) => {
    const who = msg.key.participant || msg.key.remoteJid;
    const now = Date.now();
    const cd = cooldownsBuceo[who] || 0;

    if (now < cd) {
      const restante = Math.ceil((cd - now) / 1000);
      const minutos = Math.floor(restante / 60);
      const segundos = restante % 60;
      const mensajesCd = [
        '🌊 » Sigues bajo el agua, descansa un poco...',
        '🐠 » Los peces aun te rodean, espera...',
        '🤿 » Tu tanque de oxigeno esta vacio...',
        '🌀 » La corriente no te deja volver aun...',
        '🦈 » Un tiburon bloquea tu camino...'
      ];
      const msgCd = mensajesCd[Math.floor(Math.random() * mensajesCd.length)];
      return sock.sendMessage(jid, {
        text: `࿇ ══━━━✥◈✥━━━══ ࿇\n   ALEPANDA BUCEO\n࿇ ══━━━✥◈✥━━━══ ࿇\n\n${msgCd}\n⏳ » Espera ${minutos}m ${segundos}s`
      });
    }

    let rand = Math.random();
    let acumulado = 0;
    let resultado = zonas[zonas.length - 1];
    for (const z of zonas) {
      acumulado += z.prob;
      if (rand < acumulado) { resultado = z; break; }
    }

    const { zona, emoji, tier, descripciones, dMin, dMax, eMin, eMax } = resultado;
    const diamantes = dMin < 0
      ? -(Math.floor(Math.random() * (Math.abs(dMin) - Math.abs(dMax) + 1)) + Math.abs(dMax))
      : Math.floor(Math.random() * (dMax - dMin + 1)) + dMin;
    const exp = Math.floor(Math.random() * (eMax - eMin + 1)) + eMin;
    const descripcion = descripciones[Math.floor(Math.random() * descripciones.length)];

    const db = leerDB();
    const usuario = getUsuario(db, who);
    usuario.saldo = Math.max(0, (usuario.saldo || 0) + diamantes);
    usuario.xp = (usuario.xp || 0) + exp;

    let subioNivel = false;
    let requerido = xpNecesario(usuario.nivel || 1);
    while (usuario.xp >= requerido) {
      usuario.xp -= requerido;
      usuario.nivel = (usuario.nivel || 1) + 1;
      subioNivel = true;
      requerido = xpNecesario(usuario.nivel);
    }
    guardarDB(db);
    cooldownsBuceo[who] = now + 600000;

    let texto = `࿇ ══━━━✥◈✥━━━══ ࿇\n   ALEPANDA BUCEO\n࿇ ══━━━✥◈✥━━━══ ࿇\n\n`;
    texto += `${emoji} » ${zona}\n🏅 » ${tier}\n❧ » ${descripcion}\n\n`;
    texto += `💎 » ${diamantes > 0 ? '+' : ''}${diamantes} diamantes\n✨ » +${exp} exp\n`;
    texto += `💰 » Total: ${usuario.saldo} 💎\n\n`;
    if (subioNivel) texto += `🎉 » Subiste al nivel ${usuario.nivel}!\n\n`;
    texto += `࿇ ══━━━✥◈✥━━━══ ࿇`;

    await sock.sendMessage(jid, { text: texto });
  }
};
