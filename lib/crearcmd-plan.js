// lib/crearcmd-plan.js
//
// Flujo conversacional de .crearcmd y .arreglarcmd:
//
//   1. El owner describe el comando (o el problema).
//   2. El bot responde como un companero: explica QUE va a hacer (nombre, alias,
//      como se usa, como funciona, dudas) y pregunta "¿lo creo asi?".
//   3. El owner puede pedir cambios o hacer preguntas (respondiendo al mensaje del
//      bot, o con .crearcmd <cambio>); el bot contesta con el plan actualizado.
//   4. Cuando el owner dice "si" (dale, hazlo...), recien ahi se escribe el codigo,
//      se valida, se instala en caliente (y si falla, se intenta corregir 1 vez solo).
//
// Los planes viven en memoria (por chat) y caducan a la hora.

const { leerConfig } = require('./config');
const { esOwnerBot } = require('./permisos');
const { conversar, generarTexto } = require('./gemini');
const {
  construirPromptNuevoDesdePlan, construirPromptArreglo, limpiarCodigo, OPCIONES_CODIGO
} = require('./crearcmd-ia');
const { obtenerEstado } = require('./crearcmd-estado');
const { procesarYInstalarCodigo } = require('./crearcmd-instalar');
const { probarComandos } = require('./crearcmd-prueba');
const { extraerUrls, probarEndpoints, textoParaIA, textoParaOwner } = require('./crearcmd-endpoints');
const fs = require('fs');
const { aplicarArreglo } = require('./crearcmd-arreglo');

const TTL_MS = 60 * 60 * 1000;
const OPCIONES_PLAN = { maxTokens: 1500, timeoutMs: 45000, temperatura: 0.5 };

const planes = new Map(); // jid -> plan

// ---------- entender lo que contesta el owner ----------

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NUCLEO_SI = new Set(['si', 'sii', 'siii', 'sip', 'sep', 'simon', 'dale', 'dalee', 'va', 'vale', 'ok', 'okay', 'okey', 'listo', 'hazlo', 'hazla', 'hacelo', 'crealo', 'creala', 'adelante', 'confirmo', 'confirmado', 'procede', 'perfecto', 'andale', 'sale', 'ejecutalo', 'ejecuta', 'aprobado', 'arre', 'metele', 'mandale', 'bien']);
const RELLENO_SI = new Set(['de', 'una', 'por', 'favor', 'porfa', 'pls', 'ya', 'asi', 'esta', 'todo', 'gracias', 'y', 'el', 'lo', 'la', 'que', 'sea', 'pues', 'entonces', 'claro', 'correcto']);
const PALABRAS_CANCELAR = new Set(['cancela', 'cancelar', 'cancelalo', 'olvidalo', 'olvida', 'dejalo', 'descartalo', 'descarta', 'aborta', 'abortar', 'stop']);

function esConfirmacion(texto) {
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  if (!palabras.length || palabras.length > 5) return false;
  return palabras.every((p) => NUCLEO_SI.has(p) || RELLENO_SI.has(p)) && palabras.some((p) => NUCLEO_SI.has(p));
}

function esCancelacion(texto) {
  const n = normalizar(texto);
  const palabras = n.split(' ').filter(Boolean);
  if (!palabras.length || palabras.length > 5) return false;
  if (palabras.some((p) => PALABRAS_CANCELAR.has(p))) return true;
  return /^ya no( lo)?( quiero| hagas| crees)?$/.test(n);
}

function esNegativaSimple(texto) {
  return /^(no|nel|nop|nope|nah|neh)$/.test(normalizar(texto));
}

// ---------- manejo de planes ----------

function obtenerPlan(jid) {
  const plan = planes.get(jid);
  if (!plan) return null;
  if (Date.now() - plan.actualizado > TTL_MS) { planes.delete(jid); return null; }
  return plan;
}

function descartarPlan(jid) {
  planes.delete(jid);
}

async function decir(sock, plan, jid, texto, quoted) {
  const enviado = await sock.sendMessage(jid, { text: texto }, quoted ? { quoted } : undefined);
  if (plan && enviado && enviado.key && enviado.key.id) plan.ids.add(enviado.key.id);
  return enviado;
}

function textoErrorIA(err, que) {
  return err && err.code === 'NO_API_KEY'
    ? 'No hay ninguna API key de IA configurada (Gemini/Groq/OpenRouter). Configura una con .setapikey para poder usar esto.'
    : `No pude ${que}: ${err && err.message}`;
}

// ---------- el plan (lo que la IA le explica al owner) ----------

const CAPACIDADES = `Lo que SI puede hacer un comando de este bot: llamar APIs/endpoints con fetch (Node ya lo trae), responder texto, imagenes, audio, video, documentos y stickers, leer argumentos del mensaje, usar claves guardadas por el owner con .setapikey, y dar formato bonito con las cajas del bot.
Lo que NO puede: instalar paquetes npm nuevos, ejecutar comandos de shell, ni tocar archivos fuera de lo necesario.`;

const ESTILO_PLAN = `Hablas en español, natural y cercano, como un companero que explica ANTES de tocar nada. Estas en la fase de PLAN: NO escribas codigo ni bloques de codigo, solo explica lo que vas a hacer para que el owner pueda corregirte.
Formato de WhatsApp: *negritas*, listas con •, sin tablas ni titulos con #. Maximo ~200 palabras.
Si el owner te pide un cambio o te hace una pregunta, contesta breve a lo que dijo y muestra el plan ACTUALIZADO completo (misma estructura).
Ultima linea, obligatoria (el bot la oculta): ##NOMBRE:nombredelcomando## (minusculas, sin espacios ni prefijo; si son varios, separados por coma).`;

// Prueba en vivo las URLs nuevas que aparezcan en el texto del owner y las guarda en el plan
async function revisarEndpoints(plan, texto) {
  if (!plan.endpoints) plan.endpoints = [];
  if (!plan.urlsProbadas) plan.urlsProbadas = new Set();
  const nuevas = extraerUrls(texto).filter((u) => !plan.urlsProbadas.has(u));
  if (!nuevas.length) return;
  nuevas.forEach((u) => plan.urlsProbadas.add(u));
  const resultados = await probarEndpoints(nuevas);
  plan.endpoints.push(...resultados);
  plan.avisoEndpoints = [plan.avisoEndpoints, textoParaOwner(resultados)].filter(Boolean).join('\n');
}

// La peticion del owner + lo que respondieron de verdad sus endpoints (para los prompts de codigo)
function descripcionCompleta(plan) {
  const e = textoParaIA(plan.endpoints);
  return e ? `${plan.descripcion}\n\n${e}` : plan.descripcion;
}

function textoPruebasParaIA(plan, prefix) {
  const nombres = Object.keys(plan.existentes || {});
  if (!nombres.length) return '';
  const lineas = nombres.map((n) => {
    const r = plan.existentes[n];
    const e = r.estado === 'ok' ? 'FUNCIONA' : r.estado === 'roto' ? 'FALLA' : 'NO SE PUDO PROBAR';
    return `- ${prefix}${n}: ${e} (${r.detalle})`;
  });
  return `

RESULTADO DE LAS PRUEBAS (el bot ejecuto/probo de verdad los comandos que YA existen con esos nombres):
${lineas.join('\n')}
Reglas: los que FUNCIONAN se dejan IGUAL (no se tocan ni se reemplazan). Los que FALLAN se ARREGLAN usando la API/datos que dio el owner. Los que NO SE PUDO PROBAR se dejan igual, salvo que el owner pida arreglarlos. El owner puede cambiarlo ("arregla tambien .x", "no toques .y"): haz caso.
Al final agrega otra linea oculta: ##ARREGLAR:nombre1,nombre2## con los comandos EXISTENTES que se van a arreglar (solo los nombres, vacia si ninguno). En ##NOMBRE:## pon solo los comandos NUEVOS que se van a crear (no incluyas los que ya existen). No repitas la lista de pruebas en tu mensaje (el bot la agrega solo): solo di en una linea que haras con ellos.`;
}

function textoEndpointsParaPlan(plan) {
  const t = textoParaIA(plan.endpoints);
  if (!t) return '';
  return `\n\n${t}\nSi arriba aparece una LISTA DETECTADA con varias opciones/acciones/categorias, esas son los comandos a crear (uno por cada una) salvo que el owner diga otra cosa; di cuantas son. Si un endpoint no se pudo probar o devuelve HTML, dilo claro y pide una URL correcta o un ejemplo de su respuesta.`;
}

function sistemaDelPlan(plan, prefix) {
  if (plan.kind === 'nuevo') {
    return `Eres el asistente que ayuda al owner de un bot de WhatsApp (Node.js + Baileys) a CREAR comandos nuevos.
${ESTILO_PLAN}

MUY IMPORTANTE: si lo que pego el owner trae UNA API con varias acciones/categorias/endpoints (por ejemplo una lista de reacciones como hug, kiss, pat...), NO lo trates como un solo comando: propon UN comando por cada una, todos con la misma API pero cada uno con su propio parametro/endpoint, y se crean juntos en un solo archivo. Lista todos en el plan (si son mas de 8, en una sola linea separados por comas, cada uno con su emoji) y di cuantos son. El owner puede quitar, renombrar o agregar. En la linea ##NOMBRE:...## pon TODOS los nombres separados por coma.

Estructura de tu mensaje:
1. Una frase corta con lo que entendiste (y cuantos comandos son, si son varios).
2. *Lo que voy a crear:* nombre(s) con prefijo (el prefijo del bot es "${prefix}"), alias propuestos, categoria y un ejemplo de uso.
3. *Como va a funcionar:* 3 a 5 pasos cortos.
4. *Detalles:* que API/endpoint usaria, que responde si algo falla y limites. Si falta un dato clave (el endpoint, una API key...) dilo claro y di que asumirias mientras tanto. Maximo 2 preguntas.
5. Cierra SIEMPRE con: ¿Lo creo asi? Responde *si* para crearlo o dime que cambiar.

${CAPACIDADES}${textoPruebasParaIA(plan, prefix)}${textoEndpointsParaPlan(plan)}`;
  }

  const esEstado = plan.kind === 'estado';
  const codigo = String(esEstado ? plan.estadoPrevio.codigo : plan.arreglo.codigoActual).slice(0, 12000);
  const nombre = esEstado ? (plan.estadoPrevio.nombre || 'el comando') : plan.arreglo.nombre;
  const contexto = esEstado
    ? `Error o problema registrado: ${plan.estadoPrevio.error || '(el owner reporta que no funciona bien, sin error tecnico)'}`
    : `Diagnostico en vivo (URLs probadas justo ahora contra el servidor real):\n${plan.arreglo.diagnostico}`;

  return `Eres el asistente que ayuda al owner de un bot de WhatsApp (Node.js + Baileys) a ARREGLAR el comando "${prefix}${nombre}".
${ESTILO_PLAN}

Estructura de tu mensaje:
1. *Que encontre:* 1 a 3 frases con la causa probable (usa el diagnostico y lo que dijo el owner).
2. *Lo que voy a cambiar:* lista corta y concreta.
3. *Lo que no voy a tocar:* una linea.
4. Menciona que se guarda un respaldo del archivo original.
5. Cierra SIEMPRE con: ¿Le doy? Responde *si* para aplicarlo o dime que cambiar.

${CAPACIDADES}

Codigo actual del comando (solo para que lo entiendas, NO lo repitas):
"""
${codigo}
"""

${contexto}${textoEndpointsParaPlan(plan)}`;
}

function ocupadoPorOtro(comandos, n) {
  const c = comandos && comandos.get(n);
  return !!c && !c._creadoPorIA;
}

// Pide el plan a la IA. Devuelve { texto, nombres, arreglarTag } (arreglarTag = null si la IA no lo puso)
async function generarPlan(plan, comandos, prefix) {
  const mensajes = [{ role: 'system', content: sistemaDelPlan(plan, prefix) }, ...plan.conversacion];
  const bruto = await conversar(mensajes, OPCIONES_PLAN);

  const lista = (m) => (m ? m[1].toLowerCase().split(/[\s,]+/).filter(Boolean) : []);
  const mNombre = /##\s*NOMBRE\s*:\s*([a-z0-9_,\s-]*?)\s*##/i.exec(bruto);
  const mArreglar = /##\s*ARREGLAR\s*:\s*([a-z0-9_,\s-]*?)\s*##/i.exec(bruto);
  const texto = String(bruto)
    .replace(/##\s*(NOMBRE|ARREGLAR)[^#]*##/gi, '')
    .replace(/```[a-z]*/gi, '')
    .trim()
    .slice(0, 3500);

  return { texto, nombres: lista(mNombre), arreglarTag: mArreglar ? lista(mArreglar) : null };
}

// Texto fijo (no lo escribe la IA) con lo que se probo y lo que se hara con cada comando que ya existe
function bloqueExistentes(plan, prefix) {
  const nombres = (plan.nombresExistentes || []).filter((n) => plan.existentes && plan.existentes[n]);
  if (!nombres.length) return '';
  const arreglar = new Set(plan.arreglar || []);
  const p = (n) => prefix + n;

  const igualOk = nombres.filter((n) => !arreglar.has(n) && plan.existentes[n].estado === 'ok');
  const igualSin = nombres.filter((n) => !arreglar.has(n) && plan.existentes[n].estado === 'sin_prueba');
  const igualRoto = nombres.filter((n) => !arreglar.has(n) && plan.existentes[n].estado === 'roto');
  const aArreglar = nombres.filter((n) => arreglar.has(n));

  const l = ['🔎 *Probe los que ya existen:*'];
  if (igualOk.length) l.push(`✅ Funcionan, los dejo igual: ${igualOk.map(p).join(' ')}`);
  for (const n of aArreglar) {
    const r = plan.existentes[n];
    l.push(r.estado === 'roto'
      ? `❌ ${p(n)} falla (${r.detalle}) → lo arreglo con la API nueva`
      : `🔧 ${p(n)} ${r.estado === 'ok' ? 'funciona' : 'no pude probarlo'}, pero lo modifico porque lo pediste`);
  }
  for (const n of igualRoto) l.push(`❌ ${p(n)} falla (${plan.existentes[n].detalle}) pero NO lo toco, como pediste`);
  if (igualSin.length) l.push(`⚠️ No pude probarlos, los dejo igual: ${igualSin.map(p).join(' ')} (si quieres que arregle alguno dime "arregla ${p(igualSin[0])}")`);
  if ((plan.nuevos || []).length) l.push(`🆕 Creo nuevos: ${plan.nuevos.map(p).join(' ')}`);
  return l.join('\n');
}

// Genera el plan (o su version actualizada), prueba lo que ya existe y lo manda
async function responderConPlan(sock, jid, msg, plan, comandos, prefix) {
  let g;
  try {
    g = await generarPlan(plan, comandos, prefix);
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${textoErrorIA(err, 'armar el plan')}` }, { quoted: msg });
    return false;
  }

  let texto = g.texto;
  const extras = [];
  if (plan.avisoEndpoints) { extras.push(plan.avisoEndpoints); plan.avisoEndpoints = null; }

  if (plan.kind === 'nuevo' && comandos) {
    const mencionados = [...new Set([...g.nombres, ...(g.arreglarTag || [])])];
    // Se acumulan: aunque la IA ya no los nombre en una version nueva del plan, siguen contando como "existentes"
    const existentes = [...new Set([...(plan.nombresExistentes || []), ...mencionados.filter((n) => ocupadoPorOtro(comandos, n))])].filter((n) => ocupadoPorOtro(comandos, n));
    const deIA = mencionados.filter((n) => comandos.has(n) && comandos.get(n)._creadoPorIA);
    plan.nombresExistentes = existentes;

    // Probar (una sola vez por comando) los que ya existen, ANTES de tocar nada
    const sinProbar = existentes.filter((n) => !plan.existentes[n]);
    if (sinProbar.length) {
      await sock.sendMessage(jid, { text: `🔎 ${sinProbar.length === 1 ? 'Ya existe 1 comando' : `Ya existen ${sinProbar.length} comandos`} con esos nombres. Los pruebo antes de tocar nada (puede tardar un poco)...` }, { quoted: msg });
      Object.assign(plan.existentes, await probarComandos(sinProbar, comandos, prefix));
    }

    // Cuales se arreglan: lo que diga la IA (si el owner pidio algo) > decision anterior > los que fallan
    const porDefecto = existentes.filter((n) => plan.existentes[n] && plan.existentes[n].estado === 'roto');
    if (g.arreglarTag) plan.arreglar = g.arreglarTag.filter((n) => existentes.includes(n));
    else if (plan.arreglar) plan.arreglar = plan.arreglar.filter((n) => existentes.includes(n));
    else plan.arreglar = porDefecto;

    plan.nuevos = g.nombres.filter((n) => !ocupadoPorOtro(comandos, n));
    const bloque = bloqueExistentes(plan, prefix);
    if (bloque) extras.push(bloque);
    if (deIA.length) extras.push(`ℹ️ Ya existen creados con IA: ${deIA.map((n) => prefix + n).join(', ')}; si sigues con esos nombres los reemplazo.`);
  }
  if (plan.kind === 'estado') {
    const cual = plan.estadoPrevio.nombre ? `tu ultimo comando (*${prefix}${plan.estadoPrevio.nombre}*)` : 'el comando que acaba de fallar';
    extras.push(`ℹ️ Esto corrige ${cual}. Si querias crear otro distinto escribe *${prefix}crearcmd nuevo <descripcion>*.`);
  }
  if (extras.length) texto += '\n\n' + extras.join('\n\n');

  plan.nombrePlan = g.nombres[0] || null;
  plan.nombresPlan = g.nombres;
  plan.conversacion.push({ role: 'assistant', content: texto });
  plan.ultimoPlan = texto;
  plan.actualizado = Date.now();
  await decir(sock, plan, jid, texto, msg);
  return true;
}

// ---------- empezar un plan ----------

async function iniciarPlan({ sock, jid, msg, comandos, prefix, plan, primerMensaje, aviso }) {
  plan.jid = jid;
  plan.creado = Date.now();
  plan.actualizado = Date.now();
  plan.ids = new Set();
  plan.ocupado = false;
  plan.existentes = {};
  plan.endpoints = [];
  plan.urlsProbadas = new Set();
  plan.avisoEndpoints = null;
  plan.nombresExistentes = [];
  plan.arreglar = null;
  plan.nuevos = [];
  plan.ultimoPlan = '';
  plan.conversacion = [{ role: 'user', content: primerMensaje }];
  planes.set(jid, plan);

  await sock.sendMessage(jid, { text: aviso }, { quoted: msg });
  try { await revisarEndpoints(plan, primerMensaje); } catch (err) { console.error('[crearcmd-plan] endpoints:', err); }
  const ok = await responderConPlan(sock, jid, msg, plan, comandos, prefix);
  if (!ok) planes.delete(jid);
}

function iniciarPlanNuevo({ sock, jid, msg, comandos, prefix, descripcion }) {
  return iniciarPlan({
    sock, jid, msg, comandos, prefix,
    plan: { kind: 'nuevo', descripcion },
    primerMensaje: descripcion,
    aviso: '🧠 Dejame pensar como lo haria...'
  });
}

function iniciarPlanEstado({ sock, jid, msg, comandos, prefix, estadoPrevio, aclaracion }) {
  return iniciarPlan({
    sock, jid, msg, comandos, prefix,
    plan: { kind: 'estado', descripcion: aclaracion, estadoPrevio },
    primerMensaje: aclaracion,
    aviso: '🛠️ Reviso tu ultimo comando y te cuento que cambiaria...'
  });
}

function iniciarPlanArreglo({ sock, jid, msg, comandos, prefix, comando, rutaOriginal, codigoActual, diagnostico, descripcionProblema }) {
  return iniciarPlan({
    sock, jid, msg, comandos, prefix,
    plan: {
      kind: 'arreglo',
      descripcion: descripcionProblema,
      arreglo: { comando, nombre: comando.name, categoria: comando.category || 'general', rutaOriginal, codigoActual, diagnostico }
    },
    primerMensaje: `Arregla el comando ${prefix}${comando.name}. Lo que dice el owner: ${descripcionProblema}`,
    aviso: `🛠️ Reviso "${comando.name}" con IA y te cuento que cambiaria...`
  });
}

// ---------- ejecutar el plan aprobado ----------

async function pedirCodigo(prompt) {
  const respuesta = await generarTexto(prompt, OPCIONES_CODIGO);
  return limpiarCodigo(respuesta);
}

function charla(plan) {
  return plan.conversacion.map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Owner'}: ${m.content}`).join('\n\n');
}

function corto(texto, max = 1200) {
  const t = String(texto || '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

async function ejecutarNuevoOEstado(plan, { jid, comandos }) {
  const esEstado = plan.kind === 'estado';
  const previo = plan.estadoPrevio;

  const descripcionOriginal = esEstado ? previo.descripcionOriginal : descripcionCompleta(plan);
  const rutaForzada = esEstado ? (previo.rutaArchivoFinal || null) : null;

  const prompt1 = esEstado
    ? construirPromptArreglo({
        descripcionOriginal: previo.descripcionOriginal,
        codigoAnterior: previo.codigo,
        errorAnterior: previo.error || '(el owner reporta que no funciona bien, sin error tecnico registrado)',
        aclaracionUsuario: `${descripcionCompleta(plan)}\n\nPlan acordado con el owner:\n${plan.ultimoPlan}\n\nConversacion:\n${charla(plan)}`
      })
    : construirPromptNuevoDesdePlan({
        descripcion: descripcionCompleta(plan), planFinal: plan.ultimoPlan, conversacion: plan.conversacion,
        crear: (plan.nombresExistentes || []).length ? plan.nuevos : [],
        excluir: plan.nombresExistentes || []
      });

  let codigo = await pedirCodigo(prompt1);
  if (!codigo) return { ok: false, mensajeError: 'La IA no devolvio ningun codigo utilizable.' };

  let r = await procesarYInstalarCodigo({ codigo, jid, comandos, descripcionOriginal, rutaDestinoForzada: rutaForzada });
  if (r.ok || /^Ya existe un comando/.test(r.mensajeError || '')) return { ...r, intentos: 1 };

  // Un reintento automatico, con el error a la vista
  const estadoFallo = obtenerEstado(jid);
  const prompt2 = construirPromptArreglo({
    descripcionOriginal,
    codigoAnterior: codigo,
    errorAnterior: r.mensajeError,
    aclaracionUsuario: `Es un reintento automatico: corrige el error y respeta el plan acordado con el owner:\n${plan.ultimoPlan}`
  });
  codigo = await pedirCodigo(prompt2);
  if (!codigo) return { ...r, intentos: 1 };
  r = await procesarYInstalarCodigo({
    codigo, jid, comandos, descripcionOriginal,
    rutaDestinoForzada: (estadoFallo && estadoFallo.rutaArchivoFinal) || rutaForzada
  });
  return { ...r, intentos: 2 };
}

async function ejecutarArreglo(plan, { jid, comandos }) {
  const a = plan.arreglo;
  const base = {
    descripcionOriginal: `Comando existente llamado "${a.nombre}" (categoria: ${a.categoria}). Descripcion original: ${a.comando.description || '(sin descripcion)'}`,
    errorAnterior: `Diagnostico en vivo (URLs probadas justo ahora contra el servidor real):\n${a.diagnostico}`
  };
  const aclaracion = `${descripcionCompleta(plan)}\n\nPlan acordado con el owner:\n${plan.ultimoPlan}\n\nConversacion:\n${charla(plan)}`;

  let codigo = await pedirCodigo(construirPromptArreglo({ ...base, codigoAnterior: a.codigoActual, aclaracionUsuario: aclaracion }));
  if (!codigo) return { ok: false, error: 'La IA no devolvio ningun codigo utilizable.', revertido: false };

  const aplicar = (c) => aplicarArreglo({
    jid, comando: a.comando, rutaOriginal: a.rutaOriginal, codigoNuevo: c, descripcionProblema: plan.descripcion, comandos
  });

  let r = await aplicar(codigo);
  if (r.ok) return { ...r, intentos: 1 };

  codigo = await pedirCodigo(construirPromptArreglo({
    ...base,
    codigoAnterior: codigo,
    errorAnterior: r.error,
    aclaracionUsuario: `Es un reintento automatico: corrige este error sin perder lo acordado con el owner:\n${plan.ultimoPlan}`
  }));
  if (!codigo) return { ...r, intentos: 1 };
  r = await aplicar(codigo);
  return { ...r, intentos: 2 };
}

const MAX_ARREGLOS = 12;

// Arregla el/los comandos de UN archivo que ya existia y fallaba, usando la API/datos del owner.
// Aplica con respaldo, vuelve a probarlos y, si siguen fallando, lo intenta una vez mas.
async function arreglarArchivoExistente(plan, { ruta, nombres }, { jid, comandos, prefix }) {
  const comando = comandos.get(nombres[0]);
  const rel = require('path').relative(require('path').join(__dirname, '..'), ruta);
  let codigoActual = fs.readFileSync(ruta, 'utf-8');
  let detalle = nombres.map((n) => `${prefix}${n}: ${plan.existentes[n].estado === 'roto' ? 'FALLA' : 'sin problemas detectados'} (${plan.existentes[n].detalle})`).join('\n');
  let resultado = null;
  let respaldoOriginal = null;

  for (let intento = 1; intento <= 2; intento++) {
    const prompt = construirPromptArreglo({
      descripcionOriginal: `Comando(s) que ya existen en el bot: ${nombres.map((n) => prefix + n).join(', ')} (archivo ${rel}). Descripcion: ${comando.description || '(sin descripcion)'}`,
      codigoAnterior: codigoActual,
      errorAnterior: `Prueba hecha por el bot (ejecutando el comando de verdad):\n${detalle}`,
      aclaracionUsuario: `El owner quiere que ${nombres.map((n) => prefix + n).join(', ')} funcione(n) con la API/datos que el mando. Texto original del owner:\n${descripcionCompleta(plan)}\n\nPlan acordado:\n${plan.ultimoPlan}\n\nArregla SOLO ${nombres.map((n) => prefix + n).join(', ')} (mismo name y aliases). Si el archivo tiene otros comandos, dejalos exactamente igual.`
    });

    let codigo;
    try { codigo = await pedirCodigo(prompt); } catch (err) { detalle = textoErrorIA(err, 'generar el arreglo'); break; }
    if (!codigo) { detalle = 'la IA no devolvio codigo utilizable'; continue; }

    const r = await aplicarArreglo({
      jid, comando, rutaOriginal: ruta, codigoNuevo: codigo,
      descripcionProblema: `API nueva del owner (${nombres.join(', ')})`, comandos
    });
    if (!r.ok) { detalle = r.error; continue; } // el archivo quedo como estaba: se reintenta con el error a la vista
    respaldoOriginal = respaldoOriginal || r.rutaRespaldo;

    const pruebas = await probarComandos(nombres, comandos, prefix);
    const aunRotos = nombres.filter((n) => pruebas[n] && pruebas[n].estado === 'roto');
    resultado = { ok: true, respaldo: respaldoOriginal, aunRotos, pruebas, archivo: rel };
    if (!aunRotos.length) return resultado;

    codigoActual = fs.readFileSync(ruta, 'utf-8');
    detalle = aunRotos.map((n) => `${prefix}${n}: FALLA (${pruebas[n].detalle})`).join('\n');
  }
  return resultado || { ok: false, error: detalle, archivo: rel };
}

// Plan "nuevo" donde algunos nombres ya existian: se prueban (ya hecho en el plan), se crean los nuevos,
// se arreglan los que fallaban y se dejan igual los que funcionan.
async function ejecutarConExistentes(plan, { sock, jid, msg, comandos, prefix }) {
  const path = require('path');
  const existentes = plan.nombresExistentes || [];
  const arreglar = (plan.arreglar || []).slice(0, MAX_ARREGLOS);
  const sinTiempo = (plan.arreglar || []).slice(MAX_ARREGLOS);
  const dejados = existentes.filter((n) => !(plan.arreglar || []).includes(n));
  const p = (n) => prefix + n;
  const lineas = [];
  let huboProblemas = false;

  if (!plan.nuevos.length && !arreglar.length) {
    return `👌 No hice cambios: ${existentes.length === 1 ? 'el comando que pediste ya existe' : 'los comandos que pediste ya existen'} y quedan como estaban (${existentes.map(p).join(' ')}).`;
  }

  // 1) Crear los nuevos
  if (plan.nuevos.length) {
    const r = await ejecutarNuevoOEstado(plan, { jid, comandos });
    if (r.ok) {
      const archivo = path.relative(path.join(__dirname, '..'), r.rutaDestino);
      lineas.push(`🆕 *Creados (${r.comandosInstalados.length}):* ${r.comandosInstalados.map((c) => p(c.name)).join(' ')}\n   📄 ${archivo}`);
    } else {
      huboProblemas = true;
      lineas.push(`❌ *No pude crear los nuevos* (${plan.nuevos.map(p).join(' ')}): ${corto(r.mensajeError, 500)}`);
    }
  }

  // 2) Arreglar los que fallaban (de a 3 a la vez)
  if (arreglar.length) {
    await sock.sendMessage(jid, { text: `🔧 Arreglando ${arreglar.map(p).join(' ')} con la API que me diste (pruebo cada uno al terminar)...` }, { quoted: msg });
    const porArchivo = new Map();
    for (const n of arreglar) {
      const c = comandos.get(n);
      if (!c || !c._rutaArchivo || !fs.existsSync(c._rutaArchivo)) {
        huboProblemas = true;
        lineas.push(`❌ ${p(n)}: no encontre su archivo, no lo pude arreglar.`);
        continue;
      }
      if (!porArchivo.has(c._rutaArchivo)) porArchivo.set(c._rutaArchivo, []);
      porArchivo.get(c._rutaArchivo).push(n);
    }
    const trabajos = [...porArchivo.entries()].map(([ruta, nombres]) => ({ ruta, nombres }));
    const resultados = [];
    const trabajador = async () => {
      while (trabajos.length) {
        const t = trabajos.shift();
        resultados.push({ t, r: await arreglarArchivoExistente(plan, t, { jid, comandos, prefix }) });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, trabajos.length) }, trabajador));

    const buenos = [];
    for (const { t, r } of resultados) {
      if (r.ok && !r.aunRotos.length) {
        buenos.push(`${t.nombres.map(p).join(' ')} ✅ (respaldo: ${r.respaldo.split('/').pop()})`);
      } else if (r.ok) {
        huboProblemas = true;
        lineas.push(`⚠️ Apliqué cambios a ${t.nombres.map(p).join(' ')} pero ${r.aunRotos.map(p).join(' ')} sigue(n) fallando: ${corto(r.pruebas[r.aunRotos[0]].detalle, 200)}\n   (respaldo del original: ${r.respaldo.split('/').pop()})`);
      } else {
        huboProblemas = true;
        lineas.push(`❌ No pude arreglar ${t.nombres.map(p).join(' ')} (queda como estaba): ${corto(r.error, 300)}`);
      }
    }
    if (buenos.length) lineas.push(`🔧 *Arreglados y probados:*\n   ${buenos.join('\n   ')}`);
    if (sinTiempo.length) lineas.push(`⏳ Quedaron pendientes por ser muchos: ${sinTiempo.map(p).join(' ')} (pideme "arregla ${p(sinTiempo[0])}...").`);
  }

  if (dejados.length) lineas.push(`⏭️ *Dejé igual:* ${dejados.map(p).join(' ')}`);

  return `${huboProblemas ? '⚠️ *Terminé, pero con detalles:*' : '✅ *Listo, todo quedó activo* (sin reiniciar el bot).'}\n\n${lineas.join('\n\n')}`;
}

async function ejecutar(plan, { sock, jid, msg, comandos, prefix }) {
  plan.ocupado = true;
  await sock.sendMessage(jid, { text: '👌 Va, me pongo a escribirlo y probarlo... (puede tardar un poco)' }, { quoted: msg });

  try {
    if (plan.kind === 'nuevo' && (plan.nombresExistentes || []).length) {
      const textoFinal = await ejecutarConExistentes(plan, { sock, jid, msg, comandos, prefix });
      await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg });
    } else if (plan.kind === 'arreglo') {
      const r = await ejecutarArreglo(plan, { jid, comandos });
      if (r.ok) {
        const lista = r.comandosInstalados.map((c) => `• *${prefix}${c.name}* — ${c.description || 'sin descripcion'}`).join('\n');
        await sock.sendMessage(jid, {
          text: `✅ *Listo, ya quedo arreglado y activo* (sin reiniciar el bot).\n\n${lista}\n\n📄 Archivo: ${r.archivo}\n💾 Respaldo del original: ${r.rutaRespaldo.split('/').pop()}\n\nPruebalo. Si sigue fallando dime que pasa con *${prefix}arreglarcmd ${plan.arreglo.nombre} <que pasa>*.`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          text: `❌ No pude dejarlo funcionando (lo intente ${r.intentos === 2 ? '2 veces' : '1 vez'}).\n\n${corto(r.error)}\n\nEl original quedo como estaba. Dime que ajustar con *${prefix}crearcmd <que esta mal>* y lo reintento con ese error a la vista.`
        }, { quoted: msg });
      }
    } else {
      const r = await ejecutarNuevoOEstado(plan, { jid, comandos });
      if (r.ok) {
        const lista = r.comandosInstalados.length > 8
          ? `• *${r.comandosInstalados.length} comandos* creados: ${r.comandosInstalados.map((c) => prefix + c.name).join(' ')}`
          : r.comandosInstalados.map((c) => {
              const alias = c.aliases && c.aliases.length ? ` (alias: ${c.aliases.map((a) => prefix + a).join(', ')})` : '';
              return `• *${prefix}${c.name}*${alias} — ${c.description || 'sin descripcion'}`;
            }).join('\n');
        const archivo = require('path').relative(require('path').join(__dirname, '..'), r.rutaDestino);
        await sock.sendMessage(jid, {
          text: `✅ *Listo, ya quedo creado y activo* (sin reiniciar el bot).\n\n${lista}\n\n📂 Categoria: ${r.categoria}\n📄 Archivo: ${archivo}\n\nPruebalo. Si quieres cambiar algo dime con *${prefix}crearcmd <lo que quieres cambiar>*.`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          text: `❌ No pude dejarlo funcionando${r.intentos ? ` (lo intente ${r.intentos === 2 ? '2 veces' : '1 vez'})` : ''}.\n\n${corto(r.mensajeError)}\n\nNo se instalo nada roto. Dime que ajustar con *${prefix}crearcmd <que esta mal>* y lo reintento con ese error a la vista.`
        }, { quoted: msg });
      }
    }
  } catch (err) {
    console.error('[crearcmd-plan] error ejecutando:', err);
    await sock.sendMessage(jid, { text: `❌ ${textoErrorIA(err, 'terminar el comando')}` }, { quoted: msg });
  } finally {
    if (planes.get(jid) === plan) planes.delete(jid);
  }
}

// ---------- seguir la charla ----------

// Lo que el owner contesta a un plan: confirmar, cancelar o pedir cambios.
async function continuar({ sock, jid, msg, texto, comandos, prefix }) {
  const plan = obtenerPlan(jid);
  if (!plan) return false;

  if (plan.ocupado) {
    await sock.sendMessage(jid, { text: '⏳ Ya lo estoy escribiendo, dame un momento.' }, { quoted: msg });
    return true;
  }

  if (esCancelacion(texto)) {
    planes.delete(jid);
    await sock.sendMessage(jid, { text: '👍 Listo, lo descarte. No cree ni cambie nada.' }, { quoted: msg });
    return true;
  }

  if (esConfirmacion(texto)) {
    await ejecutar(plan, { sock, jid, msg, comandos, prefix });
    return true;
  }

  if (esNegativaSimple(texto)) {
    plan.actualizado = Date.now();
    await sock.sendMessage(jid, { text: `Va, ¿que quieres cambiar? Dimelo y ajusto el plan (o escribe *cancelar* para descartarlo).` }, { quoted: msg });
    return true;
  }

  // Cualquier otra cosa: es un cambio o una pregunta -> plan actualizado
  plan.conversacion.push({ role: 'user', content: texto });
  plan.actualizado = Date.now();
  plan.ocupado = true;
  try {
    try { await revisarEndpoints(plan, texto); } catch (err) { console.error('[crearcmd-plan] endpoints:', err); }
    await responderConPlan(sock, jid, msg, plan, comandos, prefix);
  } finally {
    plan.ocupado = false;
  }
  return true;
}

// Hook de index.js: el owner responde (citando) a un mensaje de plan del bot
async function manejarRespuesta({ sock, jid, msg, texto, comandos, prefix }) {
  const stanzaId = msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.stanzaId;
  if (!stanzaId) return false;
  const plan = obtenerPlan(jid);
  if (!plan || !plan.ids.has(stanzaId)) return false;
  if (!(await esOwnerBot(sock, leerConfig(), msg))) return false;
  return continuar({ sock, jid, msg, texto, comandos, prefix });
}

module.exports = {
  iniciarPlanNuevo, iniciarPlanEstado, iniciarPlanArreglo,
  continuar, manejarRespuesta, obtenerPlan, descartarPlan,
  esConfirmacion, esCancelacion
};
