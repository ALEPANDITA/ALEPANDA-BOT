const { getApiKey } = require('./apikeys');

// --- Gemini (proveedor principal, gratis) ---
const MODELOS_CHAT_GEMINI = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const MODEL_IMAGEN = 'gemini-3.1-flash-image';

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
function mensajesABodyGemini(mensajes, { imagenBase64, mimeType } = {}) {
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
  if (systemMsgs) body.system_instruction = { parts: [{ text: systemMsgs }] };
  return body;
}

async function intentarGemini(mensajes, opciones) {
  const apiKey = getApiKey('gemini');
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };

  const body = mensajesABodyGemini(mensajes, opciones);
  let ultimoError;

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

  console.error('[IA] Gemini fallo, se intenta con el siguiente proveedor:', ultimoError?.message);
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

async function conCascadaDeProveedores(mensajes, opciones = {}) {
  const intentos = [];

  // Groq y OpenRouter (texto plano, formato OpenAI) no reciben la imagen si la hay;
  // si el mensaje trae imagen, solo Gemini puede procesarla.
  const puedeUsarTextoPlano = !opciones.imagenBase64;

  const resultadoGemini = await intentarGemini(mensajes, opciones);
  if (resultadoGemini.ok) return resultadoGemini.texto;
  intentos.push(resultadoGemini);

  if (puedeUsarTextoPlano) {
    const resultadoGroq = await intentarGroq(mensajes);
    if (resultadoGroq.ok) return resultadoGroq.texto;
    intentos.push(resultadoGroq);

    const resultadoOpenRouter = await intentarOpenRouter(mensajes);
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
  throw ultimoConError?.error || new Error('Ningun proveedor de IA pudo responder.');
}

// ================= FUNCIONES PUBLICAS (mismo nombre e interfaz de siempre) =================

async function generarTexto(prompt, { imagenBase64, mimeType } = {}) {
  const mensajes = [{ role: 'user', content: prompt }];
  return conCascadaDeProveedores(mensajes, { imagenBase64, mimeType });
}

async function chatConPersonalidad(systemInstruction, historial, mensajeNuevo) {
  const mensajes = [
    { role: 'system', content: systemInstruction },
    ...historial.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
    { role: 'user', content: mensajeNuevo }
  ];
  return conCascadaDeProveedores(mensajes);
}

async function generarImagen(prompt) {
  // La generacion de imagenes se queda solo en Gemini (Groq/OpenRouter no la soportan igual).
  const apiKey = requireApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IMAGEN}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
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

module.exports = { generarTexto, generarImagen, chatConPersonalidad };
