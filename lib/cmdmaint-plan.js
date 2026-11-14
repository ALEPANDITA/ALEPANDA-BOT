// lib/cmdmaint-plan.js
//
// El "cerebro" de .repararcmd: recibe la instruccion del owner en español, la entiende (lib/cmdmaint-ia.js), la ejecuta con el motor
// (lib/cmdmaint.js) y contesta. Todo lo que borra o mueve algo se MUESTRA primero como plan y solo se aplica cuando el owner dice "si"
// (respondiendo al mensaje del plan o con .repararcmd si). Los planes viven en memoria, por chat, y caducan a los 30 minutos.
const path = require('path');
const { leerConfig } = require('./config');
const { esOwnerBot } = require('./permisos');
const { caja, error: cajaError, advertencia } = require('./estilo');
const maint = require('./cmdmaint');
const { interpretar, textoAyuda, norm, parseConservar } = require('./cmdmaint-ia');

const TTL_MS = 30 * 60 * 1000;
const pendientes = new Map(); // jid -> { plan, ids:Set, creado, descripcion }
let trabajando = false;       // una sola limpieza a la vez en todo el bot

// ---------- si / cancelar (misma idea que .crearcmd) ----------
const NUCLEO_SI = new Set(['si', 'sii', 'siii', 'sip', 'sep', 'simon', 'dale', 'dalee', 'va', 'vale', 'ok', 'okay', 'okey', 'listo', 'hazlo', 'hazla', 'hacelo', 'adelante', 'confirmo', 'confirmado', 'procede', 'perfecto', 'andale', 'sale', 'ejecutalo', 'ejecuta', 'aplicalo', 'aplica', 'aplicar', 'aprobado', 'arre', 'metele', 'bien']);
const RELLENO_SI = new Set(['de', 'una', 'por', 'favor', 'porfa', 'pls', 'ya', 'asi', 'esta', 'todo', 'gracias', 'y', 'el', 'lo', 'la', 'que', 'sea', 'pues', 'entonces', 'claro', 'correcto', 'plan']);
const NUCLEO_NO = new Set(['cancela', 'cancelar', 'cancelalo', 'olvidalo', 'olvida', 'dejalo', 'descartalo', 'descarta', 'aborta', 'abortar', 'stop', 'no', 'nel', 'nop', 'nope', 'nah']);

function esConfirmacion(texto) {
  const p = norm(texto).split(' ').filter(Boolean);
  return p.length > 0 && p.length <= 5 && p.every((x) => NUCLEO_SI.has(x) || RELLENO_SI.has(x)) && p.some((x) => NUCLEO_SI.has(x));
}
function esCancelacion(texto) {
  const n = norm(texto);
  const p = n.split(' ').filter(Boolean);
  return p.length > 0 && p.length <= 4 && (p.some((x) => NUCLEO_NO.has(x)) || /^ya no( lo)?( quiero| hagas)?$/.test(n));
}

// ---------- plan pendiente ----------
function obtener(jid) {
  const p = pendientes.get(jid);
  if (!p) return null;
  if (Date.now() - p.creado > TTL_MS) { pendientes.delete(jid); return null; }
  return p;
}
function descartar(jid) { pendientes.delete(jid); }

// Manda un mensaje; si es parte de un plan, recuerda su id para que "si" (citando ese mensaje) funcione
async function decir(sock, jid, texto, quoted, pendiente) {
  const enviado = await sock.sendMessage(jid, { text: texto }, quoted ? { quoted } : undefined);
  if (pendiente && enviado && enviado.key && enviado.key.id) pendiente.ids.add(enviado.key.id);
  return enviado;
}

// ---------- textos ----------
const lista = (arr, max = 6) => (arr.length <= max ? arr.join(' ') : `${arr.slice(0, max).join(' ')} …(+${arr.length - max})`);
const puntos = (nombres, p) => nombres.map((n) => p + n);

function ordenCarga(entradas, d) { return d.ocurrencias.map((o) => o.entrada.archivo); }

function textoDuplicados({ entradas, rotos }, dups, plan, { categoria = null, prefix = '.' } = {}) {
  const l = [];
  const posibles = maint.choquesPosibles(entradas);
  if (!dups.length) {
    l.push(`No hay comandos ni alias repetidos${categoria ? ` en "${categoria}"` : ''}. ✅`);
    if (rotos.length) l.push('', `⚠️ ${rotos.length} archivo(s) no cargan y no se pueden revisar: ${lista(rotos.map((r) => r.archivo), 4)}`);
    return l;
  }
  l.push(`Encontre *${dups.length}* nombre(s)/alias que estan en 2 o mas lugares${categoria ? ` (que involucran a "${categoria}")` : ''}.`);
  l.push('El bot solo usa UNA version de cada uno (la que carga al final); las demas nunca se ejecutan.');

  const porCat = {};
  for (const d of dups) {
    for (const o of d.ocurrencias) if (o !== d.ganador) porCat[o.entrada.categoria] = (porCat[o.entrada.categoria] || 0) + 1;
  }
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  l.push('', `📂 Repetidos por categoria: ${cats.slice(0, 8).map(([c, n]) => `${c} ${n}`).join(' · ')}${cats.length > 8 ? ' …' : ''}`);

  l.push('', '*Ejemplos (se queda el que dice ✔):*');
  for (const d of dups.slice(0, 8)) {
    const otros = d.ocurrencias.filter((o) => o !== d.ganador).map((o) => o.entrada.archivo);
    l.push(`• ${prefix}${d.clave} → ${[...new Set(otros)].slice(0, 2).join(', ')} ✔ ${d.ganador.entrada.archivo}`);
  }
  if (dups.length > 8) l.push(`  …y ${dups.length - 8} mas`);

  if (plan && plan.archivos.length) {
    const quitan = plan.archivos.reduce((s, a) => s + (a.modo === 'editar' ? a.quita.length + a.alias.length : a.quita.length), 0);
    l.push('', `🧹 Se pueden limpiar sin cambiar nada de lo que hoy funciona: ${plan.archivos.length} archivo(s).`);
    l.push(`Para hacerlo dime: *${prefix}repararcmd elimina los duplicados${categoria ? ' de ' + categoria : ''}* (te muestro el plan y no toco nada hasta tu "si").`);
  }
  if (plan && plan.bloqueadas.length) l.push('', `🚫 ${plan.bloqueadas.length} no se pueden limpiar solos (te explico cuando pidas la limpieza).`);
  if (rotos.length) l.push('', `⚠️ ${rotos.length} archivo(s) no cargan y no cuentan aqui: ${lista(rotos.map((r) => r.archivo), 4)}`);
  if (posibles.length && rotos.length) l.push(`ℹ️ Al arreglarlos chocarian ${posibles.length} nombre(s) mas.`);
  return l;
}

function textoPlan(plan, { prefix = '.', titulo = 'plan' } = {}) {
  const l = [];
  const editar = plan.archivos.filter((a) => a.modo === 'editar');
  const mover = plan.archivos.filter((a) => a.modo === 'mover');
  const cambiar = plan.archivos.filter((a) => a.modo === 'mover_categoria');
  const quitaTotal = plan.archivos.reduce((s, a) => s + (a.modo === 'editar' ? a.quita.length : a.quita.length), 0);

  if (plan.tipo === 'limpiar') l.push(`Hay *${plan.choques}* repetido(s). Para quedar limpio voy a tocar *${plan.archivos.length}* archivo(s) (${quitaTotal} comando(s) repetido(s) fuera).`);
  if (plan.tipo === 'limpiar') l.push('Me quedo con la version que HOY esta activa en el bot, asi que nada de lo que funciona cambia.');
  for (const a of editar) {
    const partes = [];
    if (a.quita.length) partes.push(`quito ${lista(puntos(a.quita, prefix), 8)}`);
    if (a.alias.length) partes.push(`quito alias ${lista(puntos(a.alias, prefix), 6)}`);
    l.push(`✂️ ${a.archivo} — ${partes.join(' y ')}`);
  }
  for (const a of mover) l.push(`📦 ${a.archivo} — se aparta completo (${lista(puntos(a.quita, prefix), 6)})`);
  for (const a of cambiar) l.push(`🚚 ${a.archivo} → ${a.destino}`);

  if (plan.pierdeAlias && plan.pierdeAlias.length) l.push('', `⚠️ Ojo: dejarian de existir estos alias que hoy SI funcionan: ${lista(puntos(plan.pierdeAlias, prefix), 8)}`);
  if (plan.cambiaComportamiento && plan.cambiaComportamiento.length) l.push('', `⚠️ Con "conservar" cambia que version responde en: ${lista(puntos(plan.cambiaComportamiento, prefix), 8)}`);
  if (plan.fueraDeAlcance && plan.fueraDeAlcance.length) l.push('', `ℹ️ ${plan.fueraDeAlcance.length} choque(s) tienen su repetido en OTRA categoria; no los toco (dime "todos" para incluirlos).`);
  if (plan.bloqueadas.length) {
    l.push('', '🚫 *No puedo quitar solo:*');
    for (const b of plan.bloqueadas.slice(0, 8)) l.push(`• ${prefix}${b.clave} (${b.archivo}): ${b.motivo}`);
    if (plan.bloqueadas.length > 8) l.push(`  …y ${plan.bloqueadas.length - 8} mas`);
  }
  return l;
}

const PIE_CONFIRMAR = (prefix) => ['', '💾 Nada se pierde: queda un respaldo y lo puedes deshacer con *' + prefix + 'repararcmd deshaz lo ultimo*.', '¿Lo aplico? Responde *si* (citando este mensaje o con *' + prefix + 'repararcmd si*) o *cancelar*.'];

// ---------- ejecutar un plan aprobado ----------
async function aplicarPendiente({ sock, jid, msg, comandos, prefix }, pendiente) {
  if (trabajando) { await sock.sendMessage(jid, { text: '⏳ Ya estoy aplicando otra limpieza, dame un momento.' }, { quoted: msg }); return; }
  trabajando = true;
  pendientes.delete(jid);
  try {
    await sock.sendMessage(jid, { text: '🧹 Va, aplicando con respaldo y comprobando que todo siga cargando...' }, { quoted: msg });
    const res = await maint.aplicarPlan(pendiente.plan);
    const cambios = maint.recargarEnVivo(comandos);

    const l = [];
    const hechas = res.hechas;
    if (hechas.length) {
      const editadas = hechas.filter((h) => h.modo === 'editar').length;
      const movidas = hechas.filter((h) => h.modo === 'mover').length;
      const cambiadas = hechas.filter((h) => h.modo === 'mover_categoria').length;
      l.push(`✅ Listo: ${hechas.length} archivo(s) (${[editadas && `${editadas} editado(s)`, movidas && `${movidas} apartado(s)`, cambiadas && `${cambiadas} movido(s)`].filter(Boolean).join(', ')}). Ya esta activo, sin reiniciar el bot.`);
      const verificados = hechas.filter((h) => h.verificado).length;
      if (verificados) l.push(`🔬 ${verificados} archivo(s) editado(s) se volvieron a cargar aparte y quedaron con exactamente los comandos esperados.`);
      l.push(`💾 Respaldo: ${res.ts} (carpeta commands/_eliminados/mantenimiento)`);
    }
    for (const f of res.fallidas) l.push(`❌ ${f.archivo}: ${f.motivo}`);
    if (!hechas.length) l.push('No se aplico nada.');

    // lo que queda
    if (pendiente.plan.tipo === 'limpiar') {
      try {
        const nuevo = maint.escanear();
        const quedan = maint.detectarDuplicados(nuevo.entradas, pendiente.categoria ? { categoria: pendiente.categoria } : {});
        l.push('', quedan.length ? `🔁 Quedan ${quedan.length} repetido(s)${pendiente.plan.bloqueadas.length || pendiente.plan.fueraDeAlcance.length ? ' (los que no pude quitar solo)' : ''}.` : '🎉 Ya no quedan comandos duplicados.');
      } catch (_) { /* sin recuento */ }
    }
    if (hechas.length) l.push('', `↩️ Si algo no te gusta: *${prefix}repararcmd deshaz lo ultimo*`);
    if (hechas.length) l.push('📌 Estos archivos ahora difieren de GitHub. Si un git pull se queja de ellos: `git checkout -- commands`, `git pull` y vuelve a pedirme la limpieza.');
    if (cambios === 0 && hechas.length) l.push('(El bot ya tenia cargado lo correcto.)');
    await sock.sendMessage(jid, { text: caja(l, { titulo: res.fallidas.length && !hechas.length ? '❌ NO SE APLICO' : '🧹 LIMPIEZA TERMINADA', estilo: 'neon' }) }, { quoted: msg });
  } catch (err) {
    console.error('[cmdmaint] error aplicando:', err);
    await sock.sendMessage(jid, { text: cajaError(`No pude aplicar el plan: ${(err && err.message) || err}`) }, { quoted: msg });
  } finally {
    trabajando = false;
  }
}

// ---------- las acciones ----------
async function accionDuplicados(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const esc = maint.escanear();
  const dups = maint.detectarDuplicados(esc.entradas, peticion.categoria ? { categoria: peticion.categoria } : {});
  const plan = dups.length ? maint.planificarLimpieza(esc.entradas, dups, { soloCategoria: peticion.categoria || null }) : null;
  await sock.sendMessage(jid, { text: caja(textoDuplicados(esc, dups, plan, { categoria: peticion.categoria, prefix }), { titulo: `🔁 DUPLICADOS${peticion.categoria ? ' · ' + peticion.categoria.toUpperCase() : ''}`, estilo: 'neon' }) }, { quoted: msg });
}

async function accionEliminarDuplicados(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const esc = maint.escanear();
  const dups = maint.detectarDuplicados(esc.entradas, peticion.categoria ? { categoria: peticion.categoria } : {});
  if (!dups.length) {
    return sock.sendMessage(jid, { text: caja([`No hay comandos ni alias repetidos${peticion.categoria ? ` en "${peticion.categoria}"` : ''}. Nada que limpiar. ✅`], { titulo: '🧹 LIMPIEZA', estilo: 'neon' }) }, { quoted: msg });
  }
  const plan = maint.planificarLimpieza(esc.entradas, dups, { conservar: peticion.conservar || null, soloCategoria: peticion.categoria || null });
  const l = textoPlan(plan, { prefix });
  if (!plan.archivos.length) {
    l.unshift(`Encontre ${dups.length} repetido(s), pero no puedo quitar ninguno de forma segura:`);
    return sock.sendMessage(jid, { text: caja(l, { titulo: '🧹 LIMPIEZA', estilo: 'neon' }) }, { quoted: msg });
  }
  const pendiente = { plan, ids: new Set(), creado: Date.now(), categoria: peticion.categoria || null, descripcion: 'limpieza de duplicados', peticion };
  pendientes.set(jid, pendiente);
  l.push(...PIE_CONFIRMAR(prefix));
  await decir(sock, jid, caja(l, { titulo: `🧹 PLAN DE LIMPIEZA${peticion.categoria ? ' · ' + peticion.categoria.toUpperCase() : ''}`, estilo: 'neon' }), msg, pendiente);
}

async function accionEliminar(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const esc = maint.escanear();
  const plan = maint.planDeEliminarComando(esc.entradas, peticion.nombre);
  const l = textoPlan({ ...plan, choques: 0 }, { prefix });
  if (!plan.archivos.length) {
    return sock.sendMessage(jid, { text: caja(l.length ? l : [`No encontre ${prefix}${peticion.nombre}.`], { titulo: '🗑️ ELIMINAR', estilo: 'neon' }) }, { quoted: msg });
  }
  const pendiente = { plan, ids: new Set(), creado: Date.now(), categoria: null, descripcion: `eliminar ${peticion.nombre}` };
  pendientes.set(jid, pendiente);
  l.unshift(`Voy a quitar *${prefix}${peticion.nombre}* del bot:`);
  l.push(...PIE_CONFIRMAR(prefix));
  await decir(sock, jid, caja(l, { titulo: '🗑️ ELIMINAR COMANDO', estilo: 'neon' }), msg, pendiente);
}

async function accionMover(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const esc = maint.escanear();
  const plan = maint.planDeMover(esc.entradas, peticion.nombre, peticion.destino);
  const l = textoPlan({ ...plan, choques: 0 }, { prefix });
  if (!plan.archivos.length) {
    return sock.sendMessage(jid, { text: caja(l, { titulo: '🚚 MOVER', estilo: 'neon' }) }, { quoted: msg });
  }
  const pendiente = { plan, ids: new Set(), creado: Date.now(), categoria: null, descripcion: `mover ${peticion.nombre}` };
  pendientes.set(jid, pendiente);
  l.unshift(`Voy a pasar *${prefix}${peticion.nombre}* a la categoria *${peticion.destino}*:`);
  l.push(...PIE_CONFIRMAR(prefix));
  await decir(sock, jid, caja(l, { titulo: '🚚 MOVER COMANDO', estilo: 'neon' }), msg, pendiente);
}

async function accionSalud(ctx) {
  const { sock, jid, msg, prefix } = ctx;
  const s = maint.resumenSalud();
  const cats = Object.entries(s.porCategoria).sort((a, b) => b[1] - a[1]);
  const resp = maint.listarRespaldos().filter((r) => !r.restaurado);
  const l = [
    `Comandos activos: *${s.total}* en ${cats.length} categorias`,
    `Mas grandes: ${cats.slice(0, 6).map(([c, n]) => `${c} ${n}`).join(' · ')}`,
    '',
    s.duplicados.length ? `🔁 Duplicados: *${s.duplicados.length}* → ${prefix}repararcmd elimina los duplicados` : '🔁 Duplicados: ninguno ✅',
    s.rotos.length ? `❌ Archivos que NO cargan: ${s.rotos.length} (${lista(s.rotos.map((r) => r.archivo), 3)})` : '✅ Todos los archivos cargan',
    s.sinExecute.length ? `⚠️ Sin funcion execute: ${s.sinExecute.length} (${lista(s.sinExecute.map((x) => x.archivo), 3)})` : null,
    s.sinDescripcion ? `ℹ️ Sin descripcion: ${s.sinDescripcion}` : null,
    resp.length ? `💾 Respaldos de limpiezas: ${resp.length} (el ultimo ${resp[resp.length - 1].ts})` : null,
    '',
    `Para probar de verdad una categoria: ${prefix}repararcmd prueba <categoria>`
  ].filter((x) => x !== null);
  await sock.sendMessage(jid, { text: caja(l, { titulo: '🩺 SALUD DE LOS COMANDOS', estilo: 'neon' }) }, { quoted: msg });
}

async function accionListar(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const esc = maint.escanear();
  const dupKeys = new Set(maint.detectarDuplicados(esc.entradas).map((d) => d.clave));
  const delaCat = esc.entradas.filter((e) => e.categoria === peticion.categoria);
  const porArchivo = new Map();
  for (const e of delaCat) { if (!porArchivo.has(e.archivo)) porArchivo.set(e.archivo, []); porArchivo.get(e.archivo).push(e); }
  const l = [`${delaCat.length} comando(s) en ${porArchivo.size} archivo(s)`, ''];
  let lineas = 0;
  for (const [archivo, lst] of porArchivo) {
    if (lineas >= 30) { l.push(`…y ${porArchivo.size - lineas} archivo(s) mas`); break; }
    l.push(`📄 ${path.basename(archivo)}: ${lista(lst.map((e) => (dupKeys.has(e.name) ? '⚠️' : '') + prefix + e.name), 12)}`);
    lineas++;
  }
  const rep = delaCat.filter((e) => dupKeys.has(e.name)).length;
  if (rep) l.push('', `⚠️ = repetido en otro lugar (${rep}). Dime: ${prefix}repararcmd duplicados de ${peticion.categoria}`);
  await sock.sendMessage(jid, { text: caja(l, { titulo: `📋 ${peticion.categoria.toUpperCase()}`, estilo: 'neon' }) }, { quoted: msg });
}

async function accionInfo(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const esc = maint.escanear();
  const ap = maint.apariciones(esc.entradas.filter((e) => e.origen === 'cargado')).get(peticion.nombre) || [];
  if (!ap.length) {
    const parecidos = esc.entradas.filter((e) => e.name.includes(peticion.nombre) || e.aliases.some((a) => a.includes(peticion.nombre))).slice(0, 6);
    return sock.sendMessage(jid, { text: caja([`No existe ${prefix}${peticion.nombre}.`, parecidos.length ? `¿Quizas: ${parecidos.map((e) => prefix + e.name).join(' ')}?` : ''].filter(Boolean), { titulo: '🔎 INFO', estilo: 'neon' }) }, { quoted: msg });
  }
  const ganador = ap[ap.length - 1];
  const e = ganador.entrada;
  const l = [
    `*${prefix}${peticion.nombre}*${ganador.via !== 'name' ? ` (es alias de ${prefix}${e.name})` : ''}`,
    `📂 ${e.categoria} · 📄 ${e.archivo}`,
    e.aliases.length ? `🏷️ Alias: ${e.aliases.map((a) => prefix + a).join(' ')}` : null,
    e.descripcion ? `📝 ${e.descripcion.slice(0, 160)}` : null
  ];
  if (new Set(ap.map((o) => `${o.entrada.archivo}#${o.entrada.indice}`)).size > 1) {
    l.push('', `🔁 Esta repetido: ${ap.map((o) => o.entrada.archivo + (o === ganador ? ' ✔(activo)' : '')).join(' · ')}`);
  }
  await sock.sendMessage(jid, { text: caja(l.filter((x) => x !== null), { titulo: '🔎 INFO', estilo: 'neon' }) }, { quoted: msg });
}

async function accionBuscar(ctx, peticion) {
  const { sock, jid, msg, prefix } = ctx;
  const q = norm(peticion.consulta);
  const esc = maint.escanear();
  const res = esc.entradas.filter((e) => norm(`${e.name} ${e.aliases.join(' ')} ${e.ocultas.join(' ')} ${e.descripcion}`).includes(q));
  const l = res.length ? [`${res.length} resultado(s) para "${peticion.consulta}":`, ''] : [`No encontre nada para "${peticion.consulta}".`];
  for (const e of res.slice(0, 15)) l.push(`• ${prefix}${e.name} (${e.archivo})${e.descripcion ? ' — ' + e.descripcion.slice(0, 60) : ''}`);
  if (res.length > 15) l.push(`…y ${res.length - 15} mas`);
  await sock.sendMessage(jid, { text: caja(l, { titulo: '🔎 BUSCAR', estilo: 'neon' }) }, { quoted: msg });
}

async function accionRespaldos(ctx) {
  const { sock, jid, msg, prefix } = ctx;
  const r = maint.listarRespaldos().reverse();
  const l = r.length ? [`${r.length} respaldo(s) (el mas nuevo primero):`, ''] : ['Todavia no hay respaldos: no se ha hecho ninguna limpieza.'];
  for (const x of r.slice(0, 8)) l.push(`${x.restaurado ? '↩️' : '💾'} ${x.ts} — ${x.archivos.length} archivo(s)${x.restaurado ? ' (ya restaurado)' : ''}`);
  if (r.some((x) => !x.restaurado)) l.push('', `Para deshacer el ultimo: ${prefix}repararcmd deshaz lo ultimo`);
  await sock.sendMessage(jid, { text: caja(l, { titulo: '💾 RESPALDOS', estilo: 'neon' }) }, { quoted: msg });
}

async function accionRestaurar(ctx, peticion) {
  const { sock, jid, msg, comandos, prefix } = ctx;
  if (trabajando) return sock.sendMessage(jid, { text: '⏳ Estoy aplicando otra limpieza, dame un momento.' }, { quoted: msg });
  trabajando = true;
  try {
    const r = maint.restaurar(peticion.ts || 'ultimo');
    if (!r.ok) return await sock.sendMessage(jid, { text: caja([r.motivo], { titulo: '↩️ DESHACER', estilo: 'neon' }) }, { quoted: msg });
    maint.recargarEnVivo(comandos);
    const l = [`Deshice la limpieza *${r.ts}*: ${r.restaurados.length} archivo(s) vuelven a estar como antes (${lista(r.restaurados.map((x) => path.basename(x)), 5)}). Ya esta activo.`];
    for (const f of r.fallidos) l.push(`❌ ${f.archivo}: ${f.motivo}`);
    await sock.sendMessage(jid, { text: caja(l, { titulo: '↩️ DESHECHO', estilo: 'neon' }) }, { quoted: msg });
  } finally { trabajando = false; }
}

// ---------- entrada principal ----------
// texto = lo que el owner escribio SIN el ".repararcmd" (o la respuesta a un plan)
async function procesarInstruccion(ctx) {
  const { sock, jid, msg, comandos, prefix } = ctx;
  const texto = String(ctx.texto || '').trim();

  const pend = obtener(jid);
  if (pend && esConfirmacion(texto)) return aplicarPendiente(ctx, pend);
  if (pend && esCancelacion(texto)) {
    pendientes.delete(jid);
    return sock.sendMessage(jid, { text: '👍 Listo, descartado. No toque ningun archivo.' }, { quoted: msg });
  }
  if (!pend && (esConfirmacion(texto) && /^(si|ok|dale)/.test(norm(texto)))) {
    return sock.sendMessage(jid, { text: 'No tengo ningun plan pendiente. Dime que quieres hacer, por ejemplo: *' + prefix + 'repararcmd elimina los duplicados*' }, { quoted: msg });
  }

  // Con una limpieza pendiente: "conserva los de fun" / "mejor deja los de anime" cambia el plan sin empezar de cero
  if (pend && pend.peticion && pend.peticion.accion === 'eliminar_duplicados' && /\b(conserv\w*|queda\w*|dej\w*|prefier\w*|mant\w*|mejor)\b/.test(norm(texto)) && !/\b(duplic\w*|repetid\w*)\b/.test(norm(texto))) {
    const conservar = parseConservar(norm(texto).replace(/^.*?\b(?:conserv\w*|queda\w*|dej\w*|prefier\w*|mant\w*)\b/, ''));
    if (conservar) return accionEliminarDuplicados(ctx, { ...pend.peticion, conservar });
  }

  let peticion;
  try { peticion = await interpretar(texto, { prefix, existe: (n) => comandos && comandos.has(n) }); } catch (err) { peticion = { accion: 'no_entendi' }; }

  switch (peticion.accion) {
    case 'ayuda':
      return sock.sendMessage(jid, { text: caja(textoAyuda(prefix), { titulo: '🛠️ REPARARCMD', estilo: 'neon' }) }, { quoted: msg });
    case 'salud': return accionSalud(ctx);
    case 'duplicados': return accionDuplicados(ctx, peticion);
    case 'eliminar_duplicados': return accionEliminarDuplicados(ctx, peticion);
    case 'eliminar': return accionEliminar(ctx, peticion);
    case 'mover': return accionMover(ctx, peticion);
    case 'listar': return accionListar(ctx, peticion);
    case 'info': return accionInfo(ctx, peticion);
    case 'buscar': return accionBuscar(ctx, peticion);
    case 'respaldos': return accionRespaldos(ctx);
    case 'restaurar': return accionRestaurar(ctx, peticion);
    case 'reparar':
    case 'probar':
      return require('./cmdmaint-reparar').repararCategoria({ sock, jid, msg, comandos, prefix, categoria: peticion.categoria, soloProbar: peticion.accion === 'probar' });
    default: {
      const extra = peticion.errorIA ? `\n\n(No pude usar la IA para entenderte: ${peticion.errorIA})` : '';
      return sock.sendMessage(jid, { text: caja(['No estoy seguro de lo que quieres hacer.', '', ...textoAyuda(prefix).slice(0, 6), '', `Escribe *${prefix}repararcmd ayuda* para ver todo lo que sé hacer.`], { titulo: '🤔 REPARARCMD', estilo: 'neon' }) + extra }, { quoted: msg });
    }
  }
}

// Hook de index.js: el owner responde (citando) a un mensaje de plan del bot
async function manejarRespuesta({ sock, jid, msg, texto, comandos, prefix }) {
  const ctxInfo = msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo;
  const stanzaId = ctxInfo && ctxInfo.stanzaId;
  if (!stanzaId) return false;
  const pend = obtener(jid);
  if (!pend || !pend.ids.has(stanzaId)) return false;
  if (!(await esOwnerBot(sock, leerConfig(), msg))) return false;
  await procesarInstruccion({ sock, jid, msg, texto, comandos, prefix });
  return true;
}

module.exports = { procesarInstruccion, manejarRespuesta, obtener, descartar, esConfirmacion, esCancelacion, textoDuplicados, textoPlan };
