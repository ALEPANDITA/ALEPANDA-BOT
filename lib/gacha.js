// Sistema de gacha de waifus/personajes, usando la API publica de Jikan
// (MyAnimeList no oficial) para traer personajes reales con imagen oficial.

const JIKAN_BASE = 'https://api.jikan.moe/v4';

function calcularRareza(favoritos = 0) {
  if (favoritos >= 20000) return { nombre: 'LEGENDARIA', emoji: '🌟', valor: 2000, peso: 1 };
  if (favoritos >= 5000) return { nombre: 'EPICA', emoji: '💜', valor: 800, peso: 3 };
  if (favoritos >= 1000) return { nombre: 'RARA', emoji: '💙', valor: 300, peso: 8 };
  return { nombre: 'COMUN', emoji: '⚪', valor: 100, peso: 15 };
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function personajeAleatorio() {
  let ultimoError;

  for (let intento = 0; intento < 5; intento++) {
    try {
      const res = await fetch(`${JIKAN_BASE}/random/characters`);

      if (!res.ok) {
        ultimoError = new Error(`HTTP ${res.status}`);
        console.warn(`[GACHA] Intento ${intento + 1}: ${ultimoError.message}`);
        const retryAfter = Number(res.headers?.get?.('retry-after'));
        const espera = retryAfter > 0 ? retryAfter * 1000 : (res.status === 429 ? 1500 : 800) * (intento + 1);
        await esperar(espera);
        continue;
      }

      const json = await res.json();
      const data = json?.data;
      const imagen = data?.images?.webp?.image_url || data?.images?.jpg?.image_url;
      const nombre = data?.name;

      if (!data || !imagen || !nombre) {
        ultimoError = new Error('Respuesta sin imagen o nombre valido');
        console.warn(`[GACHA] Intento ${intento + 1}: ${ultimoError.message}`);
        continue;
      }

      const serie = data?.anime?.[0]?.anime?.title || data?.manga?.[0]?.manga?.title || 'Desconocida';
      const rareza = calcularRareza(data?.favorites || 0);

      return {
        id: data.mal_id,
        nombre,
        serie,
        imagen,
        favoritos: data?.favorites || 0,
        rareza
      };
    } catch (err) {
      ultimoError = err;
      console.warn(`[GACHA] Intento ${intento + 1} fallo de red:`, err.message);
    }

    await esperar(400);
  }

  throw new Error(`No se pudo obtener un personaje despues de varios intentos. Ultimo error: ${ultimoError?.message || 'desconocido'}`);
}

module.exports = { personajeAleatorio, calcularRareza };
