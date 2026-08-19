// lib/vigilanteConexion.js
// Vigila que la conexion con WhatsApp siga respondiendo DE VERDAD, no solo
// que el proceso siga corriendo. Es un problema conocido de Baileys: a veces
// el socket se queda "zombie" -- WhatsApp corto la conexion de su lado, pero
// el bot nunca recibe un evento de cierre limpio para enterarse. PM2 sigue
// viendo el proceso como "online" y todo se ve normal, pero ya no procesa
// nada nuevo.
//
// Cada REVISION_MS minutos se hace una prueba activa y liviana (actualizar
// la presencia) con un limite de tiempo corto. Si falla dos veces seguidas,
// se asume que la conexion esta muerta y se reinicia el proceso limpio (PM2,
// con autorestart activado, lo vuelve a levantar solo y genera una conexion
// nueva).

const REVISION_MS = 10 * 60 * 1000; // cada 10 minutos
const TIMEOUT_PRUEBA_MS = 20 * 1000; // 20s de margen para que responda
const FALLOS_PARA_REINICIAR = 2; // 2 fallos seguidos (~20 min) antes de reiniciar, para no reiniciar por un hipo de red puntual

let intervaloVigilante = null;
let fallosSeguidos = 0;

function conTimeout(promesa, ms, mensaje) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensaje)), ms))
  ]);
}

function iniciarVigilanteConexion(sock) {
  if (intervaloVigilante) clearInterval(intervaloVigilante);
  fallosSeguidos = 0;

  intervaloVigilante = setInterval(async () => {
    try {
      await conTimeout(
        sock.sendPresenceUpdate('available'),
        TIMEOUT_PRUEBA_MS,
        'La conexion no respondio a tiempo'
      );
      if (fallosSeguidos > 0) {
        console.log('🛡️ [vigilante] La conexion volvio a responder normal.');
      }
      fallosSeguidos = 0;
    } catch (err) {
      fallosSeguidos++;
      console.warn(`🛡️ [vigilante] Prueba de conexion fallo (${fallosSeguidos}/${FALLOS_PARA_REINICIAR}). Detalle: ${err.message}`);

      if (fallosSeguidos >= FALLOS_PARA_REINICIAR) {
        console.error('🛡️ [vigilante] La conexion parece muerta (zombie). Reiniciando el proceso para reconectar limpio...');
        process.exit(1); // PM2 (con autorestart) lo vuelve a levantar solo
      }
    }
  }, REVISION_MS);

  console.log(`🛡️ [vigilante] Vigilante de conexion activo (revisa cada ${REVISION_MS / 60000} min, reinicia tras ${FALLOS_PARA_REINICIAR} fallos seguidos).`);
}

module.exports = { iniciarVigilanteConexion };
