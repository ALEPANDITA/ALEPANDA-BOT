// Mide velocidad de internet real usando los endpoints publicos de Cloudflare
// (los mismos que usa speed.cloudflare.com). Se usa curl para las peticiones
// porque es lo mas confiable en este entorno (ver notas de otras libs del bot).
const { execFile } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const execFileAsync = util.promisify(execFile);

const BASE = 'https://speed.cloudflare.com';

async function medirTiempo(url, args = []) {
  const { stdout } = await execFileAsync('curl', [
    '-s', '-o', '/dev/null',
    '-w', '%{time_total}',
    ...args,
    url
  ]);
  return parseFloat(stdout.trim());
}

async function medirPing(intentos = 5) {
  const tiempos = [];
  for (let i = 0; i < intentos; i++) {
    const segundos = await medirTiempo(`${BASE}/__down?bytes=0`);
    tiempos.push(segundos * 1000);
  }
  const ping = Math.min(...tiempos);
  const jitter = Math.max(...tiempos) - Math.min(...tiempos);
  return { ping: Math.round(ping), jitter: Math.round(jitter) };
}

async function medirDescarga(bytes = 25_000_000) {
  const segundos = await medirTiempo(`${BASE}/__down?bytes=${bytes}`);
  const mbps = (bytes * 8) / segundos / 1_000_000;
  return Math.round(mbps * 100) / 100;
}

async function medirSubida(bytes = 10_000_000) {
  const rutaTemp = path.join(os.tmpdir(), `speedtest-up-${Date.now()}.bin`);
  fs.writeFileSync(rutaTemp, crypto.randomBytes(bytes));

  try {
    const segundos = await medirTiempo(`${BASE}/__up`, [
      '-X', 'POST',
      '--data-binary', `@${rutaTemp}`
    ]);
    const mbps = (bytes * 8) / segundos / 1_000_000;
    return Math.round(mbps * 100) / 100;
  } finally {
    if (fs.existsSync(rutaTemp)) fs.unlinkSync(rutaTemp);
  }
}

async function correrSpeedtest() {
  const { ping, jitter } = await medirPing();
  const descarga = await medirDescarga();
  const subida = await medirSubida();
  return { ping, jitter, descarga, subida };
}

module.exports = { correrSpeedtest, medirPing, medirDescarga, medirSubida };
