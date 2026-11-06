const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');

const COOLDOWN = 30 * 60 * 1000;
const PROB_PERDER = 0.30;

const GANA = [
  'Atendiste a un cliente vistiendo su cosplay favorito y te dieron',
  'Un cliente generoso te pago la noche completa y recibiste',
  'Grabaste contenido exclusivo y lo vendiste por',
  'Un extranjero te pago por una noche en su hotel y ganaste',
  'Hiciste un show privado por webcam y juntaste',
  'Un cliente te pago por acompañarlo a una cena y ganaste',
  'Te contrataron para una despedida de soltero y conseguiste',
  'Un cliente rico te dejo una propina enorme:'
];

const PIERDE = [
  'Un cliente se escapo sin pagarte y perdiste',
  'Te cayo la policia en plena noche y tuviste que sobornar con',
  'La cuenta se te bloqueo y perdiste',
  'Te robaron en la habitacion del hotel y perdiste',
  'Te cancelaron el show y perdiste',
  'La plataforma te cobro comisiones y perdiste',
  'Gastaste en un disfraz carisimo que nadie quiso y perdiste'
];

const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

module.exports = {
  name: 'slut',
  category: 'economia',
  description: 'Trabajo arriesgado de la noche: puedes ganar o perder dinero (cada 30 min)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = (usuario.lastSlut || 0) + COOLDOWN - ahora;
    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, {
        text: advertencia(`Descansa un rato. Espera ${minutos} minuto(s) para volver a salir.`, { titulo: 'ESPERA UN POCO' })
      }, { quoted: msg });
    }

    usuario.lastSlut = ahora;

    if (Math.random() < PROB_PERDER) {
      const perdida = Math.min(usuario.saldo, Math.floor(Math.random() * 150) + 50);
      usuario.saldo -= perdida;
      guardarDB(db);
      return sock.sendMessage(jid, {
        text: cajaError(`${elegir(PIERDE)} *$${perdida}*.\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'MALA NOCHE' })
      }, { quoted: msg });
    }

    const ganancia = Math.floor(Math.random() * 300) + 100;
    usuario.saldo += ganancia;
    guardarDB(db);
    await sock.sendMessage(jid, {
      text: exito(`${elegir(GANA)} *$${ganancia}*.\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'BUENA NOCHE' })
    }, { quoted: msg });
  }
};
