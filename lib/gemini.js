const { getApiKey, getApiKeys } = require('./apikeys');

// --- Gemini (proveedor principal, gratis) ---
const MODELOS_CHAT_GEMINI = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const MODEL_IMAGEN = 'gemini-2.5-flash-image';

// --- Groq (respaldo #1, gratis) ---
const MODELO_GROQ = 'llama-3.3-70b-versatile';

// --- OpenRouter (respaldo #2, de pago pero muy barato) ---
// Puedes cambiar el modelo por cualquier otro slug de https://openrouter.ai/models
const MODELO_OPENROUTER = 'deepseek/deepseek-v3.2';

function requireApiKey() {
  const apiKey = getApiKey('gemini');
  if (!apiKey) {
    const err = new Error('NO_API_KEY');
    err.code = 'NO_API_KEY';
    throw err;
  }
  return apiKey;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function esErrorTemporal(mensaje = '') {
  const m = mensaje.toLowerCase();
  return m.includes('high demand') || m.includes('overloaded') || m.includes('unavailable') || m.includes('503') || m.includes('429') || m.includes('quota') || m.includes('resource_exhausted');
}

// ================= GEMINI =================

async function llamarModeloGemini(modelo, body, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Error desconocido de la API de Gemini');
    err.temporal = esErrorTemporal(err.message);
    throw err;
  }

  const texto = data?.candidates?.[0]?.content?.parts
    ?.map(p => p.text)
    .filter(Boolean)
    .join('\n');

  if (!texto) {
    const razon = data?.candidates?.[0]?.finishReason;
    throw new Error(razon ? `La API no devolvio texto (motivo: ${razon})` : 'La API no devolvio texto.');
  }

  return texto;
}

// Convierte la conversacion generica ({role, content}[]) al formato que espera Gemini
function mensajesABodyGemini(mensajes, opciones = {}) {
  const { imagenBase64, mimeType } = opciones;
  const systemMsgs = mensajes.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const resto = mensajes.filter(m => m.role !== 'system');

  const contents = resto.map((m, i) => {
    const esUltimo = i === resto.length - 1;
    const parts = [];
    if (esUltimo && imagenBase64) {
      parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imagenBase64 } });
    }
    parts.push({ text: m.content });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });

  const body = { contents };
  if (systemMsgs) {
    body.system_instruction = { parts: [{ text: systemMsgs }] };
    body.generationConfig = { temperature: 1.2 };
  }
  // Temperatura pedida por quien llama (ej. codigo = baja, para que no invente)
  if (typeof opciones.temperatura === 'number') {
    body.generationConfig = { ...(body.generationConfig || {}), temperature: opciones.temperatura };
  }
  return body;
}

async function intentarGemini(mensajes, opciones) {
  const claves = getApiKeys('gemini');
  if (!claves.length) return { ok: false, motivo: 'sin_api_key' };

  const body = mensajesABodyGemini(mensajes, opciones);
  let ultimoError;

  // Prueba CADA clave guardada (no solo la primera). Si una esta sin cupo o
  // invalida, pasa a la siguiente antes de rendirse con Gemini por completo.
  for (const apiKey of claves) {
    for (const modelo of MODELOS_CHAT_GEMINI) {
      for (let intento = 1; intento <= 2; intento++) {
        try {
          const texto = await llamarModeloGemini(modelo, body, apiKey);
          return { ok: true, texto };
        } catch (err) {
          ultimoError = err;
          if (err.temporal && intento < 2) {
            await esperar(1500 * intento);
            continue;
          }
          break;
        }
      }
    }
  }

  console.error('[IA] Gemini fallo con todas las claves guardadas, se intenta con el siguiente proveedor:', ultimoError?.message);
  return { ok: false, motivo: 'error', error: ultimoError };
}

// ================= GROQ (formato OpenAI-compatible) =================

async function intentarGroq(mensajes) {
  const apiKey = getApiKey('groq');
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: MODELO_GROQ, messages: mensajes })
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'Error desconocido de la API de Groq');
    }

    const texto = data?.choices?.[0]?.message?.content;
    if (!texto) throw new Error('Groq no devolvio texto.');

    return { ok: true, texto };
  } catch (err) {
    console.error('[IA] Groq fallo, se intenta con el siguiente proveedor:', err.message);
    return { ok: false, motivo: 'error', error: err };
  }
}

// ================= OPENROUTER (formato OpenAI-compatible) =================

async function intentarOpenRouter(mensajes) {
  const apiKey = getApiKey('openrouter');
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: MODELO_OPENROUTER, messages: mensajes })
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'Error desconocido de la API de OpenRouter');
    }

    const texto = data?.choices?.[0]?.message?.content;
    if (!texto) throw new Error('OpenRouter no devolvio texto.');

    return { ok: true, texto };
  } catch (err) {
    console.error('[IA] OpenRouter fallo:', err.message);
    return { ok: false, motivo: 'error', error: err };
  }
}

// ================= ORQUESTADOR: Gemini -> Groq -> OpenRouter =================

// ================= PROVEEDORES COMPATIBLES CON OPENAI (Groq, NVIDIA, OpenRouter) =================
// Prueba TODAS las claves guardadas de cada servicio. Si una clave se queda sin
// cupo/creditos o es invalida, se salta unos minutos y se pasa a la siguiente
// clave o al siguiente proveedor sin perder tiempo. Siempre manda max_tokens
// (sin eso OpenRouter rechaza la peticion por "creditos insuficientes").
const ENFRIAMIENTO_COMPAT = new Map();

const MODELOS_COMPAT = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelos: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant']
  },
  nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    modelos: ['google/gemma-4-31b-it', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3.5-lightning-30b-a3b']
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    modelos: [MODELO_OPENROUTER]
  }
};
const MODELO_BUENO = new Map(); // servicio -> ultimo modelo que si funciono (se prueba primero)

// Si un modelo ya no existe o esta retirado, prueba el siguiente de la lista.
// Si la clave no tiene cupo/creditos o es invalida, pasa a la siguiente clave.
async function intentarCompat(servicio, mensajes, opciones = {}) {
  const claves = getApiKeys(servicio);
  if (!claves.length) return { ok: false, motivo: 'sin_api_key' };

  const cfg = MODELOS_COMPAT[servicio];
  const modelos = [...cfg.modelos];
  const bueno = MODELO_BUENO.get(servicio);
  if (bueno && modelos.includes(bueno)) modelos.unshift(...modelos.splice(modelos.indexOf(bueno), 1));

  let ultimoError;
  for (const apiKey of claves) {
    const id = servicio + '|' + String(apiKey).slice(-8);
    if ((ENFRIAMIENTO_COMPAT.get(id) || 0) > Date.now()) continue;

    for (const modelo of modelos) {
      let res, data;
      try {
        res = await fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelo,
            messages: mensajes,
            max_tokens: opciones.maxTokens || 350,
            ...(typeof opciones.temperatura === 'number' ? { temperature: opciones.temperatura } : {})
          }),
          signal: AbortSignal.timeout(Math.max(20000, opciones.timeoutMs || 0))
        });
        data = await res.json().catch(() => ({}));
      } catch (err) {
        ultimoError = new Error(`${servicio}: ${err && err.name === 'TimeoutError' ? 'tardo demasiado' : ((err && err.cause && err.cause.code) || (err && err.message))}`);
        console.error('[IA]', ultimoError.message);
        break; // problema de red/tiempo: no insistir con mas modelos de esta clave
      }

      if (res.ok && !data.error) {
        const texto = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (texto) { MODELO_BUENO.set(servicio, modelo); return { ok: true, texto }; }
        ultimoError = new Error(`${servicio} (${modelo}): no devolvio texto`);
        continue;
      }

      const motivo = (data && data.error && data.error.message) || (data && data.detail) || (data && data.message) || `HTTP ${res.status}`;
      ultimoError = new Error(`${servicio} (${modelo}): ${motivo}`);
      console.error('[IA] ' + ultimoError.message);

      const problemaDeModelo = res.status === 404 || /does not exist|do not have access|end of life|decommission|deprecat|not found/i.test(String(motivo));
      if (problemaDeModelo) continue; // probar el siguiente modelo

      if ([401, 402, 403, 429].includes(res.status) || /quota|rate limit|credits/i.test(String(motivo))) {
        ENFRIAMIENTO_COMPAT.set(id, Date.now() + (res.status === 429 ? 60 : 5 * 60) * 1000);
      }
      break; // error de la clave u otro: pasar a la siguiente clave
    }
  }

  return { ok: false, motivo: 'error', error: ultimoError || new Error(servicio + ': todas las claves estan en espera') };
}

// Si Gemini falla o se tarda, se salta 60 s para que las respuestas pasen directo a los respaldos.
let PAUSA_GEMINI = 0;

async function conCascadaDeProveedores(mensajes, opciones = {}) {
  const intentos = [];

  // Groq y OpenRouter (texto plano, formato OpenAI) no reciben la imagen si la hay;
  // si el mensaje trae imagen, solo Gemini puede procesarla.
  const puedeUsarTextoPlano = !opciones.imagenBase64;

  let resultadoGemini;
  if (puedeUsarTextoPlano && Date.now() < PAUSA_GEMINI) {
    resultadoGemini = { ok: false, motivo: 'error', error: new Error('Gemini en pausa breve') };
  } else if (puedeUsarTextoPlano) {
    resultadoGemini = await Promise.race([
      intentarGemini(mensajes, opciones),
      new Promise((resolver) => setTimeout(() => resolver({ ok: false, motivo: 'error', error: new Error('Gemini tardo demasiado') }), opciones.timeoutMs || 12000))
    ]);
    if (!resultadoGemini.ok && resultadoGemini.motivo !== 'sin_api_key') PAUSA_GEMINI = Date.now() + 60 * 1000;
  } else {
    resultadoGemini = await intentarGemini(mensajes, opciones);
  }
  if (resultadoGemini.ok) return resultadoGemini.texto;
  intentos.push(resultadoGemini);

  if (puedeUsarTextoPlano) {
    const resultadoGroq = await intentarCompat('groq', mensajes, opciones);
    if (resultadoGroq.ok) return resultadoGroq.texto;
    intentos.push(resultadoGroq);

    const resultadoNvidia = await intentarCompat('nvidia', mensajes, opciones);
    if (resultadoNvidia.ok) return resultadoNvidia.texto;
    intentos.push(resultadoNvidia);

    const resultadoOpenRouter = await intentarCompat('openrouter', mensajes, opciones);
    if (resultadoOpenRouter.ok) return resultadoOpenRouter.texto;
    intentos.push(resultadoOpenRouter);
  }

  // Si NINGUN proveedor tiene api key configurada, avisamos que falta configuracion
  const algunoConfigurado = intentos.some(i => i.motivo !== 'sin_api_key');
  if (!algunoConfigurado) {
    const err = new Error('NO_API_KEY');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const ultimoConError = [...intentos].reverse().find(i => i.error);
  console.error('[IA] Ningun proveedor pudo responder:', intentos.map((i) => i.error && i.error.message).filter(Boolean).join(' | '));
  throw new Error('Todas las IAs estan sin cupo o fallando ahorita. Intenta de nuevo en unos minutos.');
}

// ================= FUNCIONES PUBLICAS (mismo nombre e interfaz de siempre) =================

// opciones: { imagenBase64, mimeType, maxTokens, timeoutMs, temperatura }
// (maxTokens/timeoutMs suben el limite de las respuestas largas, ej. cuando se pide codigo)
async function generarTexto(prompt, opciones = {}) {
  const mensajes = [{ role: 'user', content: prompt }];
  return conCascadaDeProveedores(mensajes, opciones);
}

// Conversacion con varios turnos: mensajes = [{ role: 'system'|'user'|'assistant', content }]
async function conversar(mensajes, opciones = {}) {
  return conCascadaDeProveedores(mensajes, opciones);
}

async function chatConPersonalidad(systemInstruction, historial, mensajeNuevo) {
  const nombrePersonaje = (/Eres "([^"]+)"/.exec(systemInstruction) || [])[1];
  const rasgosPersonaje = String(systemInstruction).split('\n').filter(l => l.startsWith('- ')).slice(0, 2).map(l => l.slice(2).trim()).join(' ');
  const recordatorioPersonaje = nombrePersonaje
    ? `\n\n[Recordatorio interno, no lo menciones: sigues siendo ${nombrePersonaje}. Tu tono SIEMPRE es este, sin suavizarlo ni volverte amable: ${rasgosPersonaje} Mantienes la misma personalidad y reglas de tus instrucciones. Nunca hables como un asistente de IA neutral, ni te disculpes por tu tono, ni expliques que eres un modelo. Responde corto, estilo WhatsApp.]`
    : '';
  const mensajes = [
    { role: 'system', content: systemInstruction },
    ...historial.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
    { role: 'user', content: mensajeNuevo + recordatorioPersonaje }
  ];
  return conCascadaDeProveedores(mensajes);
}

async function generarImagen(prompt, imagenEntrada) {
  const apiKey = requireApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IMAGEN}:generateContent?key=${apiKey}`;

  const parts = [];
  if (imagenEntrada) {
    parts.push({ inline_data: { mime_type: imagenEntrada.mimeType || 'image/jpeg', data: imagenEntrada.base64 } });
  }
  parts.push({ text: prompt });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { response_modalities: ['TEXT', 'IMAGE'] }
    })
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || 'Error desconocido de la API de Gemini');
  }

  const parte = data?.candidates?.[0]?.content?.parts?.find(p => p.inline_data || p.inlineData);
  const inline = parte?.inline_data || parte?.inlineData;

  if (!inline?.data) {
    throw new Error('La API no devolvio ninguna imagen. Intenta con otra descripcion.');
  }

  return Buffer.from(inline.data, 'base64');
}

// Prueba UNA clave especifica de Gemini contra la API real (usada por .apistatustest)
async function probarClave(clave) {
  const inicio = Date.now();
  const modelo = MODELOS_CHAT_GEMINI[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hola' }] }] })
    });

    const data = await res.json();

    if (!data.error) {
      const texto = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n');
      if (texto) {
        return { ok: true, ms: Date.now() - inicio, modelo };
      }
      return { ok: false, mensaje: 'La API no devolvio texto (respuesta vacia).' };
    }

    const mensaje = data.error.message || 'Error desconocido de la API de Gemini';
    const mensajeLower = mensaje.toLowerCase();
    const status = data.error.status || '';
    const codigo = data.error.code;

    const esCuota = status === 'RESOURCE_EXHAUSTED' || codigo === 429 || mensajeLower.includes('quota') || mensajeLower.includes('resource_exhausted');
    if (esCuota) {
      let esperaSegundos = null;
      const detalleRetry = (data.error.details || []).find(d => (d['@type'] || '').includes('RetryInfo'));
      const match = detalleRetry?.retryDelay ? String(detalleRetry.retryDelay).match(/(\d+)/) : null;
      if (match) esperaSegundos = parseInt(match[1], 10);
      return { ok: false, esCuota: true, esperaSegundos, mensaje };
    }

    if (esErrorTemporal(mensaje)) {
      return { ok: false, esTemporal: true, mensaje };
    }

    return { ok: false, mensaje };
  } catch (err) {
    return { ok: false, mensaje: err.message || 'No se pudo contactar la API de Gemini.' };
  }
}

module.exports = { generarTexto, conversar, generarImagen, chatConPersonalidad, probarClave };
