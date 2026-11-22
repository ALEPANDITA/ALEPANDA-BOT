const eco = require('../../lib/eco-anim');
const { caja, advertencia, porCategoria } = require('../../lib/estilo');

const COOLDOWN = 20 * 60 * 1000;
const MINIMO = 100;
const MAXIMO = 50000;
const PUNTOS = 6; // puntos de la gráfica (cada uno es un cuadro de la animación)
const NIVELES = '▁▂▃▄▅▆▇█';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const rango = (a, b) => Number((a + Math.random() * (b - a)).toFixed(1));

// sorteo() devuelve el cambio en porcentaje (-100 = pierdes todo)
const ACTIVOS = {
  oro: { nombre: 'Oro', emoji: '🥇', riesgo: 'bajo', sorteo: () => rango(-6, 10) },
  bolsa: { nombre: 'Bolsa de valores', emoji: '📈', riesgo: 'medio', sorteo: () => (Math.random() < 0.55 ? rango(5, 30) : -rango(5, 28)) },
  cripto: {
    nombre: 'Criptomoneda', emoji: '🪙', riesgo: 'alto',
    sorteo: () => {
      const r = Math.random();
      if (r < 0.03) return -100;           // la moneda se desploma
      if (r < 0.45) return rango(30, 130);
      return -rango(30, 90);
    }
  }
};

function trayectoria(final) {
  const puntos = [0];
  const ruido = Math.max(3, Math.abs(final) * 0.35);
  for (let i = 1; i < PUNTOS - 1; i++) {
    const base = final * (i / (PUNTOS - 1));
    puntos.push(Math.max(-100, Number((base + (Math.random() * 2 - 1) * ruido).toFixed(1))));
  }
  puntos.push(final);
  return puntos;
}

function grafica(puntos, hasta) {
  const min = Math.min(...puntos);
  const span = Math.max(...puntos) - min || 1;
  const dibujados = puntos.slice(0, hasta + 1).map((v) => NIVELES[Math.min(NIVELES.length - 1, Math.floor(((v - min) / span) * NIVELES.length))]);
  return dibujados.join('') + '·'.repeat(PUNTOS - 1 - hasta);
}

const signo = (p) => (p > 0 ? '+' : '');

function parsearMonto(texto, saldo) {
  const t = sinAcentos(texto);
  if (t === 'todo' || t === 'all') return { monto: saldo, relativo: true };
  if (t === 'mitad') return { monto: Math.floor(saldo / 2), relativo: true };
  const n = Number(t.replace(/[,$]/g, ''));
  return { monto: Number.isFinite(n) ? Math.floor(n) : NaN, relativo: false };
}

module.exports = {
  name: 'invertir',
  aliases: ['inversion', 'bolsa'],
  category: 'economia',
  description: 'Invierte en oro, bolsa o cripto y mira el mercado (cada 20 min). Animado',
  activos: ACTIVOS,
  execute: async (sock, jid, msg, { prefix = '.', texto = '' } = {}) => {
    const estilo = porCategoria('economia');
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = String(texto).trim().split(/\s+/).slice(1).filter(Boolean);

    // La cantidad y el activo pueden ir en cualquier orden: ".invertir 500 cripto" o ".invertir cripto 500"
    const activoPedido = args.map(sinAcentos).find((a) => ACTIVOS[a]) || null;
    const textoMonto = args.find((a) => !ACTIVOS[sinAcentos(a)]);

    if (textoMonto === undefined) {
      return sock.sendMessage(jid, {
        text: caja([
          '📊 Invierte tu dinero y mira cómo se mueve el mercado:',
          '',
          `▸ *${prefix}invertir <cantidad> oro* 🥇 riesgo bajo`,
          `▸ *${prefix}invertir <cantidad> bolsa* 📈 riesgo medio (por defecto)`,
          `▸ *${prefix}invertir <cantidad> cripto* 🪙 riesgo alto`,
          '',
          `Mínimo ${eco.dinero(MINIMO)}, máximo ${eco.dinero(MAXIMO)}. También vale "todo" o "mitad".`,
          'Puedes ganar o perder. Cada 20 minutos.'
        ], { titulo: 'INVERTIR', estilo })
      }, { quoted: msg });
    }

    const { usuario, llave } = eco.ficha(remitente);
    const saldo = Number(usuario.saldo) || 0;
    const aviso = (t) => sock.sendMessage(jid, { text: advertencia(t, { titulo: 'INVERTIR', estilo }) }, { quoted: msg });

    const { monto: pedido, relativo } = parsearMonto(textoMonto, saldo);
    if (!Number.isFinite(pedido)) return aviso(`No entendí la cantidad "${textoMonto}".\nEj: ${prefix}invertir 500 bolsa`);
    let monto = pedido;
    if (relativo && monto > MAXIMO) monto = MAXIMO;
    if (monto < MINIMO) return aviso(`La inversión mínima es ${eco.dinero(MINIMO)}.`);
    if (monto > MAXIMO) return aviso(`La inversión máxima es ${eco.dinero(MAXIMO)}.`);
    if (monto > saldo) return aviso(`No tienes tanto. Tu saldo es ${eco.dinero(saldo)}.`);

    const falta = eco.restante(usuario, 'lastInvertir', COOLDOWN);
    if (falta > 0) return sock.sendMessage(jid, { text: eco.textoEspera(falta, 'invertir otra vez') }, { quoted: msg });

    const activo = ACTIVOS[activoPedido || 'bolsa'];
    await eco.correr(sock, jid, msg, `invertir:${llave}`, async () => {
      const pct = activo.sorteo();
      const puntos = trayectoria(pct);
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'INVERTIR' });
      const encabezado = [`${activo.emoji} ${activo.nombre} (riesgo ${activo.riesgo})`, `💵 Inviertes: ${eco.dinero(monto)}`];

      await anim.paso([...encabezado, '', '📊 Abriendo el mercado...']);
      for (let i = 1; i < PUNTOS; i++) {
        const valor = monto * (1 + puntos[i] / 100);
        await anim.paso([
          ...encabezado, '',
          `📊 ${grafica(puntos, i)}`,
          `${puntos[i] >= 0 ? '📈' : '📉'} ${signo(puntos[i])}${puntos[i]}%  →  ${eco.dinero(valor)}`
        ]);
      }

      const cambio = Math.round(monto * pct / 100);
      // Recién ahora se lee la base: si mientras tanto gastó el dinero, se cancela
      const r = eco.actualizar(remitente, (u) => {
        const antes = Number(u.saldo) || 0;
        if (antes < monto) return { sinFondos: true, saldo: antes };
        u.saldo = antes + cambio;
        u.lastInvertir = Date.now();
        return { saldo: u.saldo };
      });

      if (r.sinFondos) {
        return anim.final([...encabezado, '', `❌ Ya no tenías ${eco.dinero(monto)} disponibles. La inversión se canceló.`]);
      }
      await anim.final([
        ...encabezado, '',
        `📊 ${grafica(puntos, PUNTOS - 1)}`,
        `${pct >= 0 ? '📈' : '📉'} Cambio final: ${signo(pct)}${pct}%`,
        cambio >= 0 ? `💰 Ganaste: *${eco.dinero(cambio)}*` : `💸 Perdiste: *${eco.dinero(-cambio)}*`,
        `💼 Saldo actual: *${eco.dinero(r.saldo)}*`
      ]);
    });
  }
};
