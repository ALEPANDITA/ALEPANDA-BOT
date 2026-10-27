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

${CAPACIDADES}`;
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

${contexto}`;
}

async function generarPlan(plan, comandos, prefix) {
  const mensajes = [{ role: 'system', content: sistemaDelPlan(plan, prefix) }, ...plan.conversacion];
  const bruto = await conversar(mensajes, OPCIONES_PLAN);

  const m = /##\s*NOMBRE\s*:\s*([a-z0-9_,\s-]+?)\s*##/i.exec(bruto);
  const nombres = m ? m[1].toLowerCase().split(/[\s,]+/).filter(Boolean) : [];
  const nombre = nombres[0] || null;
  let texto = String(bruto)
    .replace(/##\s*NOMBRE[^#]*##/gi, '')
    .replace(/```[a-z]*/gi, '')
    .trim()
    .slice(0, 3500);

  const extras = [];
  if (plan.kind === 'nuevo' && comandos) {
    const ocupados = nombres.filter((n) => comandos.has(n) && !comandos.get(n)._creadoPorIA);
    const deIA = nombres.filter((n) => comandos.has(n) && comandos.get(n)._creadoPorIA);
    if (ocupados.length) {
      extras.push(ocupados.length === 1
        ? `⚠️ Ojo: ya existe un comando llamado *${prefix}${ocupados[0]}* y no lo puedo reemplazar. Dime otro nombre y lo cambio en el plan.`
        : `⚠️ Ojo: estos ya existen y no los puedo reemplazar: ${ocupados.map((n) => prefix + n).join(', ')}. Dime si los salto o con que nombre los creo (ej. agregarles un 2) y lo cambio en el plan.`);
    }
    if (deIA.length) {
      extras.push(`ℹ️ Ya existen creados con IA: ${deIA.map((n) => prefix + n).join(', ')}; si sigues con esos nombres los reemplazo.`);
    }
  }
  if (plan.kind === 'estado') {
    const cual = plan.estadoPrevio.nombre ? `tu ultimo comando (*${prefix}${plan.estadoPrevio.nombre}*)` : 'el comando que acaba de fallar';
    extras.push(`ℹ️ Esto corrige ${cual}. Si querias crear otro distinto escribe *${prefix}crearcmd nuevo <descripcion>*.`);
  }
  if (extras.length) texto += '\n\n' + extras.join('\n');

  plan.nombrePlan = nombre;
  plan.nombresPlan = nombres;
  return texto;
}

// Genera el plan (o su version actualizada) y lo manda
async function responderConPlan(sock, jid, msg, plan, comandos, prefix) {
  let texto;
  try {
    texto = await generarPlan(plan, comandos, prefix);
  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ ${textoErrorIA(err, 'armar el plan')}` }, { quoted: msg });
    return false;
  }
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
  plan.ultimoPlan = '';
  plan.conversacion = [{ role: 'user', content: primerMensaje }];
  planes.set(jid, plan);

  await sock.sendMessage(jid, { text: aviso }, { quoted: msg });
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

  const descripcionOriginal = esEstado ? previo.descripcionOriginal : plan.descripcion;
  const rutaForzada = esEstado ? (previo.rutaArchivoFinal || null) : null;

  const prompt1 = esEstado
    ? construirPromptArreglo({
        descripcionOriginal: previo.descripcionOriginal,
        codigoAnterior: previo.codigo,
        errorAnterior: previo.error || '(el owner reporta que no funciona bien, sin error tecnico registrado)',
        aclaracionUsuario: `${plan.descripcion}\n\nPlan acordado con el owner:\n${plan.ultimoPlan}\n\nConversacion:\n${charla(plan)}`
      })
    : construirPromptNuevoDesdePlan({ descripcion: plan.descripcion, planFinal: plan.ultimoPlan, conversacion: plan.conversacion });

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
  const aclaracion = `${plan.descripcion}\n\nPlan acordado con el owner:\n${plan.ultimoPlan}\n\nConversacion:\n${charla(plan)}`;

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

async function ejecutar(plan, { sock, jid, msg, comandos, prefix }) {
  plan.ocupado = true;
  await sock.sendMessage(jid, { text: '👌 Va, me pongo a escribirlo y probarlo... (puede tardar un poco)' }, { quoted: msg });

  try {
    if (plan.kind === 'arreglo') {
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
