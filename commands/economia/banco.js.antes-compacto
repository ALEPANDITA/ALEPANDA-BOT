const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const N = require('../../lib/eco-negocios');
const P = require('../../lib/eco-prestamos');

const dinero = (n) => '$' + Math.floor(n).toLocaleString('en-US');
const corto = (n) => {
  n = Math.floor(n);
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e4) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + n.toLocaleString('en-US');
};
const barra = (parte, todo, largo = 12) => {
  const llenos = todo > 0 ? Math.max(0, Math.min(largo, Math.round((parte / todo) * largo))) : 0;
  return '▰'.repeat(llenos) + '▱'.repeat(largo - llenos);
};
const nivel = (t) => (t >= 1e9 ? '🌌 Leyenda' : t >= 1e8 ? '🏰 Titán' : t >= 1e7 ? '👑 Magnate' : t >= 1e6 ? '💎 Millonario' : t >= 1e5 ? '🥇 Inversionista' : t >= 1e4 ? '🥈 Ahorrador' : t >= 1e3 ? '🥉 Cliente' : '🌱 Principiante');
const tiempo = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${mi}m` : `${mi}m`;
};

const LINEA = '━━━━━━━━━━━━━━━━━━━━';
const SEP = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
// Misma caja de siempre: encabezado, título, filas y pie
function marco(titulo, subtitulo, cuerpo, pie) {
  return [
    '🏦 *B A N C O   A L E P A N D A* 🏦',
    `✦ ${titulo === 'Estado de cuenta' && subtitulo ? subtitulo : titulo}`,
    LINEA,
    ...cuerpo,
    ...(pie ? ['', pie] : []),
    LINEA,
    '🐼 _Tu dinero, seguro con el panda_'
  ].join('\n');
}
const seccion = (icono, nombre, filas) => [`${icono} *${nombre}*`, ...filas, ''];

function posicion(db, id, total) {
  let mejores = 0, n = 0;
  for (const k of Object.keys(db.usuarios || {})) {
    const x = db.usuarios[k]; if (!x) continue;
    const t = (Number(x.saldo) || 0) + (Number(x.banco) || 0);
    if (t <= 0) continue; n++; if (t > total) mejores++;
  }
  return { puesto: mejores + 1, de: Math.max(n, 1) };
}

function cuenta(db, u, id, ahora = Date.now()) {
  const total = u.saldo + u.banco;
  const pct = total > 0 ? Math.round((u.banco / total) * 100) : 0;
  const L = P.limite(u);
  const e = P.estado(u, ahora);
  const r = N.resumen(u, db, ahora);
  const pos = posicion(db, id, total);
  const out = [
    `👛 En mano   ›  *${dinero(u.saldo)}*`,
    `🏦 En banco  ›  *${dinero(u.banco)}*`,
    SEP,
    `💰 Total     ›  *${dinero(total)}*`,
    '',
    `🔒 Protegido: ${barra(u.banco, total)} *${pct}%*`,
    `🏅 Rango: ${nivel(total)}  ·  🌍 #${pos.puesto} de ${pos.de}`,
    SEP,
    `🏢 Negocios  ›  *${L.cantidad}*  ·  *${dinero(r.porHora)}/h*`,
    `📦 Por cobrar ›  *${dinero(r.porCobrar)}*`
  ];
  if (e) {
    out.push(SEP, `💳 Deuda     ›  *${dinero(e.debe)}*${e.atraso ? ' 🚨' : ''}`, e.atraso ? `⛔ Vencida hace ${e.dias} día(s)` : `⏳ Vence en  ›  *${tiempo(e.restante)}*`);
  } else if (L.limite >= 500) {
    out.push(SEP, `💸 Préstamo disponible  ›  *${dinero(L.limite)}*`, `⭐ Calificación: *${P.calificacion(L.limite, L.moras)}*`);
  }
  const emb = P.embargosDe(u, ahora);
  if (emb.length) {
    out.push(SEP, '🏚️ *Embargados por el banco*', ...emb.map((x) => `${x.num}. ${x.emoji} ${x.nombre} ›  recuperar *${dinero(x.costo)}* _(${tiempo(x.restante)})_`));
  }
  return out;
}

function ofertasTexto(db, u, prefix, ahora) {
  const e = P.estado(u, ahora);
  const L = P.limite(u);
  const cuerpo = [
    `🏢 Negocios  ›  *${L.cantidad}*  (valor *${corto(L.valor)}*)`,
    `⏱️ Generan   ›  *${dinero(L.hora)}/h*`,
    `⭐ Calificación  ›  *${P.calificacion(L.limite, L.moras)}*`,
    SEP
  ];
  if (e) {
    cuerpo.push(`⚠️ Ya tienes un préstamo activo: debes *${dinero(e.debe)}*.`, `Págalo con *${prefix}banco pagar <monto|todo>*`);
    return marco('Préstamos', '', cuerpo);
  }
  const ofs = P.ofertas(u);
  if (!ofs.length) {
    cuerpo.push('😕 Todavía no calificas para un préstamo.', `Compra negocios con *${prefix}negocio* para que el banco confíe en ti.`);
    return marco('Préstamos', '', cuerpo);
  }
  for (const o of ofs) cuerpo.push(`${o.icono} *${o.id}. ${o.nombre}* ›  *${dinero(o.monto)}*`, `    pagas ${dinero(o.total)} (${Math.round(o.interes * 100)}%) en *${o.dias} días*`);
  cuerpo.push(SEP, '🔔 Te aviso antes de vencer', '🤝 Abonando la mitad: *+2 días extra*', '🏚️ Sin pagar: el banco quita un negocio cada 24 h', `♻️ Recuperarlo: lo abonado + 15%`);
  return marco('Préstamos', '', cuerpo, `💡 _${prefix}banco prestamo <1|2|3|monto|max>_`);
}

function leerMonto(palabra, disponible) {
  const p = String(palabra || '').toLowerCase();
  if (p === 'all' || p === 'todo' || p === 'todos') return disponible;
  if (p === 'mitad' || p === 'half') return Math.floor(disponible / 2);
  const n = parseInt(p, 10);
  return /^\d+$/.test(p) && n > 0 ? n : 0;
}

module.exports = {
  name: 'banco',
  aliases: ['bank'],
  category: 'economia',
  description: 'Tu banco: cuenta, depósitos, retiros y préstamos según tus negocios (.banco, .banco guardar 100, .banco prestamo, .banco pagar todo)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const accion = (partes[1] || '').toLowerCase();
    const yo = `@${remitente.split('@')[0]}`;
    const enviar = (t) => sock.sendMessage(jid, { text: t, mentions: [remitente] }, { quoted: msg });
    const ahora = Date.now();

    const db = leerDB();
    const u = getUsuario(db, remitente);

    const eventos = P.procesar(db, u, ahora);
    let aviso = '';
    if (eventos.length) {
      guardarDB(db);
      aviso = eventos.map((ev) => P.textoEvento(ev, u, yo, prefix, ahora)).filter(Boolean).join('\n\n');
    }
    const conAviso = (t) => (aviso ? enviar(`${aviso}\n\n${t}`) : enviar(t));

    if (!accion || accion === 'ver' || accion === 'saldo' || accion === 'cuenta') {
      return conAviso(marco('Estado de cuenta', `Cuenta de ${yo}`, cuenta(db, u, remitente, ahora), `💡 _${prefix}banco guardar · sacar · prestamo · pagar_`));
    }

    if (['prestamo', 'préstamo', 'prestamos', 'préstamos', 'credito', 'crédito', 'pedir'].includes(accion)) {
      if (!partes[2]) return conAviso(ofertasTexto(db, u, prefix, ahora));
      const r = P.pedir(u, partes[2], ahora, jid);
      if (r.error === 'deuda') return conAviso(marco('Préstamo', '', ['⚠️ Ya tienes un préstamo activo.', `Págalo primero con *${prefix}banco pagar todo*.`]));
      if (r.error === 'poco') return conAviso(marco('Préstamo', '', ['😕 Ese plan no está disponible para ti todavía.', `Compra más negocios con *${prefix}negocio*.`]));
      if (r.error === 'limite') return conAviso(marco('Préstamo', '', [`❌ Pediste *${dinero(r.monto)}* y tu límite es *${dinero(r.lim)}*.`, '', `Mira tus ofertas con *${prefix}banco prestamo*`]));
      if (r.error) return conAviso(ofertasTexto(db, u, prefix, ahora));
      guardarDB(db);
      return conAviso(marco('Préstamo aprobado ✅', `Para ${yo}`, [
        `${r.plan.icono} Plan *${r.plan.nombre}*`,
        `💵 Recibiste  ➜  *${dinero(r.monto)}*  _(en tu mano)_`,
        `🧾 Pagarás  ➜  *${dinero(r.total)}*`,
        `📊 Interés  ➜  ${dinero(r.interes)} (${Math.round(r.plan.interes * 100)}%)`,
        `⏳ Plazo  ➜  *${r.dias} días*`
      ], `💡 _Paga con ${prefix}banco pagar <monto|todo>. Cuando se acerque la fecha te aviso._`));
    }

    if (['pagar', 'abonar', 'deuda'].includes(accion)) {
      const e = P.estado(u, ahora);
      if (!e) return conAviso(marco('Deuda', '', ['✅ No debes nada. ¡Estás al corriente!', '', `Pide un préstamo con *${prefix}banco prestamo*`]));
      if (!partes[2] && accion === 'deuda') {
        return conAviso(marco('Tu deuda', `Cuenta de ${yo}`, [`💸 Debes  ➜  *${dinero(e.debe)}*`, e.atraso ? `🚨 Vencida hace ${e.dias} día(s) · recargo ${dinero(e.mora)}` : `⏳ Vence en  ➜  *${tiempo(e.restante)}*`, `${barra(e.pagado || 0, e.total + e.mora)} pagado`], `💡 _${prefix}banco pagar <monto|todo>_`));
      }
      const r = P.pagar(u, partes[2], ahora);
      if (r.error === 'fondos') return conAviso(marco('Pago', '', [`❌ No te alcanza.`, `👛 Mano: ${dinero(r.mano)}  ·  🏦 Banco: ${dinero(r.banco)}`, `Querías pagar: *${dinero(r.monto)}*`]));
      if (r.error) return conAviso(marco('Pago', '', [`Uso: *${prefix}banco pagar <monto|todo|mitad>*`, `Debes: *${dinero(e.debe)}*`]));
      guardarDB(db);
      return conAviso(marco(r.saldada ? 'Deuda saldada 🎉' : 'Pago recibido', `De ${yo}`, [
        `💸 Pagaste  ➜  *${dinero(r.monto)}*`,
        `   (👛 ${dinero(r.deMano)} · 🏦 ${dinero(r.deBanco)})`,
        r.saldada ? (r.conMora ? '⚠️ Saldada con atraso: tu calificación bajó.' : '⭐ ¡Pagaste a tiempo! Tu calificación mejora.') : `📌 Te falta  ➜  *${dinero(r.debe)}*`,
        ...(r.prorrogada ? [`🤝 Abono de la mitad: *+2 días extra*. Nuevo plazo: *${tiempo(r.vence - ahora)}*`] : [])
      ]));
    }

    if (['recuperar', 'rescatar'].includes(accion)) {
      const r = P.recuperar(db, u, partes[2], ahora);
      if (r.error === 'nada') return conAviso(marco('Recuperar', '', ['✅ No tienes negocios embargados.']));
      if (r.error === 'cual') return conAviso(marco('Negocios embargados', `De ${yo}`, [...r.lista.map((x) => `${x.num}. ${x.emoji} *${x.nombre}*  ➜  *${dinero(x.costo)}*  _(quedan ${tiempo(x.restante)})_`), '', '♻️ Costo = lo que el banco abonó + 15%'], `💡 _${prefix}banco recuperar <número>_`));
      if (r.error === 'ya') return conAviso(marco('Recuperar', '', [`Ya tienes *${r.sel.nombre}* otra vez, así que quité el embargo de la lista.`]));
      if (r.error === 'fondos') return conAviso(marco('Recuperar', '', [`❌ No te alcanza para recuperar *${r.sel.emoji} ${r.sel.nombre}*.`, `Cuesta: *${dinero(r.sel.costo)}*`, `👛 Mano: ${dinero(r.mano)}  ·  🏦 Banco: ${dinero(r.banco)}`]));
      guardarDB(db);
      return conAviso(marco('Negocio recuperado ♻️', `De ${yo}`, [`${r.sel.emoji} *${r.sel.nombre}* volvió a ser tuyo${r.sel.nivel ? ` (con sus mejoras)` : ''}.`, `💸 Pagaste *${dinero(r.sel.costo)}*  (👛 ${dinero(r.deMano)} · 🏦 ${dinero(r.deBanco)})`]));
    }

    if (accion === 'guardar' || accion === 'depositar' || accion === 'sacar' || accion === 'retirar') {
      const guardar = accion === 'guardar' || accion === 'depositar';
      const disponible = guardar ? u.saldo : u.banco;
      const tit = guardar ? '📥 Depósito' : '📤 Retiro';
      const monto = leerMonto(partes[2], disponible);
      if (!partes[2]) return conAviso(marco(tit, '', [`Uso: *${prefix}banco ${guardar ? 'guardar' : 'sacar'} <monto>*`, 'También: *todo* o *mitad*', '', `Disponible: *${dinero(disponible)}*`]));
      if (!monto) return conAviso(marco(tit, '', [`⚠️ ${disponible > 0 ? 'Pon un monto válido (o *todo* / *mitad*).' : guardar ? 'No tienes dinero en mano para guardar.' : 'No tienes dinero guardado para sacar.'}`, '', `Disponible: *${dinero(disponible)}*`]));
      if (monto > disponible) return conAviso(marco(tit, '', [`❌ ${guardar ? 'No tienes suficiente en mano.' : 'No tienes suficiente guardado.'}`, '', `Disponible: *${dinero(disponible)}*`, `Intentaste: *${dinero(monto)}*`]));
      if (guardar) { u.saldo -= monto; u.banco += monto; } else { u.banco -= monto; u.saldo += monto; }
      guardarDB(db);
      return conAviso(marco(guardar ? 'Depósito exitoso ✅' : 'Retiro exitoso ✅', `Cuenta de ${yo}`, [`${guardar ? '➕ Guardaste' : '➖ Sacaste'}  *${dinero(monto)}*`, '', ...cuenta(db, u, remitente, ahora)]));
    }

    return conAviso(marco('Ayuda', '', [
      `${prefix}banco  ➜  ver tu cuenta completa`, `${prefix}banco guardar <monto>  ➜  depositar`, `${prefix}banco sacar <monto>  ➜  retirar`,
      `${prefix}banco prestamo  ➜  ver ofertas según tus negocios`, `${prefix}banco prestamo <1|2|3|monto>  ➜  pedir`, `${prefix}banco pagar <monto|todo|mitad>  ➜  pagar tu deuda`, `${prefix}banco recuperar  ➜  recuperar negocios embargados`, '', '✨ En lugar del monto puedes poner *todo* o *mitad*'
    ]));
  }
};
