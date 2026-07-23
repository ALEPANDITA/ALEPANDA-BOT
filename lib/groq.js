const { getApiKeys } = require('./apikeys');

// Se prueban en este orden. Groq cambia de vez en cuando cuales modelos deja
// gratis, asi que dejamos varios de respaldo por si alguno ya no existe.
const MODELOS_CHAT = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant'
];

function requireApiKeys() {
  const claves = getApiKeys('groq');
  if (!claves.length) {
    const err = new Error('NO_API_KEY_GROQ');
    err.code = 'NO_API_KEY_GROQ';
    throw err;
  }
  return claves;
}

// Igual que en gemini.js: si el error es de ESTA clave (o de este modelo con
// esta clave), pasamos a la siguiente en vez de rendirnos.
function esErrorDeClave(mensaje = '', status) {
  const m = mensaje.toLowerCase();
  return (
    status === 429 ||
    status === 403 ||
    status === 404 ||
    m.includes('rate limit') ||
    m.includes('quota') ||
    m.includes('invalid api key') ||
    m.includes('invalid_api_key') ||
    m.includes('unauthorized') ||
    m.includes('decommissioned') ||
    m.includes('does not exist')
  );
}

async function llamarModelo(modelo, messages, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: modelo, messages })
  });

  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Error desconocido de la API de Groq');
    err.errorDeClave = esErrorDeClave(err.message, res.status);
    throw err;
  }

  const texto = data?.choices?.[0]?.message?.content;
  if (!texto) throw new Error('Groq no devolvio texto.');
  return texto;
}

async function conRotacionDeClaves(intentar) {
  const claves = requireApiKeys();
  let ultimoError;

  for (const apiKey of claves) {
    try {
      return await intentar(apiKey);
    } catch (err) {
      ultimoError = err;
      if (err.errorDeClave) continue;
      throw err;
    }
  }

  const errFinal = new Error(
    ultimoError ? `Todas las claves de Groq fallaron. Ultimo error: ${ultimoError.message}` : 'No se pudo obtener respuesta con ninguna clave de Groq.'
  );
  errFinal.todasLasClavesFallaron = true;
  throw errFinal;
}

async function conModelos(messages) {
  return conRotacionDeClaves(async (apiKey) => {
    let ultimoError;
    for (const modelo of MODELOS_CHAT) {
      try {
        return await llamarModelo(modelo, messages, apiKey);
      } catch (err) {
        ultimoError = err;
        if (err.errorDeClave) continue; // este modelo no sirve con esta clave, probamos el siguiente
        throw err;
      }
    }
    throw ultimoError || new Error('No se pudo obtener respuesta de ningun modelo de Groq.');
  });
}

async function generarTextoGroq(prompt) {
  return conModelos([{ role: 'user', content: prompt }]);
}

async function chatConPersonalidadGroq(systemInstruction, historial, mensajeNuevo) {
  const messages = [
    { role: 'system', content: systemInstruction },
    ...historial.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
    { role: 'user', content: mensajeNuevo }
  ];
  return conModelos(messages);
}

// Para el comando de diagnostico (misma idea que probarClave de gemini.js)
async function probarClaveGroq(apiKey) {
  const modelo = MODELOS_CHAT[0];
  const inicio = Date.now();

  try {
    const texto = await llamarModelo(modelo, [{ role: 'user', content: 'hola' }], apiKey);
    return { ok: true, ms: Date.now() - inicio, modelo, texto };
  } catch (err) {
    return { ok: false, modelo, esCuota: err.errorDeClave || false, mensaje: err.message };
  }
}

module.exports = { generarTextoGroq, chatConPersonalidadGroq, probarClaveGroq };
