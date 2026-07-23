// Pollinations.ai: genera imagenes gratis sin necesidad de ninguna API key.
// Se usa como respaldo cuando Gemini se queda sin cupo para generar imagenes.
// Limite: aprox. 1 peticion cada 15 segundos en uso anonimo, asi que no sirve
// para trafico masivo, pero es perfecto como plan B.

async function generarImagenPollinations(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Pollinations respondio con estado ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error('Pollinations no devolvio ninguna imagen.');
  }

  return buffer;
}

module.exports = { generarImagenPollinations };
