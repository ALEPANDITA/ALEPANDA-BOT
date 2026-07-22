const { getApiKey } = require('./apikeys');

const MODELOS_CHAT = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const MODEL_IMAGEN = 'gemini-3.1-flash-image';

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
  return m.includes('high demand') || m.includes('overloaded') || m.includes('unavailable') || m.includes('503') || m.includes('429');
}

async function llamarModelo(modelo, body, apiKey) {
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

async function conReintentos(body) {
  const apiKey = requireApiKey();
  let ultimoError;

  for (const modelo of MODELOS_CHAT) {
    for (let intento = 1; intento <= 2; intento++) {
      try {
        return await llamarModelo(modelo, body, apiKey);
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

  throw ultimoError || new Error('No se pudo obtener respuesta de ningun modelo.');
}

async function generarTexto(prompt, { imagenBase64, mimeType } = {}) {
  const parts = [];
  if (imagenBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imagenBase64 } });
  }
  parts.push({ text: prompt });

  return conReintentos({ contents: [{ parts }] });
}

async function chatConPersonalidad(systemInstruction, historial, mensajeNuevo) {
  const contents = [
    ...historial.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: mensajeNuevo }] }
  ];

  return conReintentos({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents
  });
}

async function generarImagen(prompt) {
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
