// Aplica TODO: negocios nuevos, multiplicadores, misiones (idempotente). Correr dentro de la carpeta del bot.
// Parche 2: gancho de misiones en index.js, avisos de multiplicador, y el mapa con los negocios nuevos (idempotente)
const fs = require('fs');
const { execSync } = require('child_process');
function parchar(f, marca, fn) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes(marca)) { console.log(f + ': ya estaba'); return; }
  fs.copyFileSync(f, f + '.bak-misiones-' + Date.now());
  const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(f + ': no encontre (' + n + ') ' + a.slice(0, 70)); s = s.replace(a, () => b); };
  fn(rep);
  s += '\n// ' + marca + '\n';
  fs.writeFileSync(f, s);
  console.log(f + ': ok');
}

parchar('lib/eco-negocios.js', 'MISIONES-EXTRA', (rep) => {

rep(`const NEGOCIOS = [
  ...ANTIGUAS.map((id) => normales.find((n) => n.id === id)),
  ...normales.filter((n) => !ANTIGUAS.includes(n.id)),
  ...exclusivas,
  ...elite
];`, `// MISIONES-EXTRA: 3 categorías, 22 exclusivas y 3 súper exclusivas al FINAL (los números viejos no cambian)
const EXTRA = require('./negocios-extra');
CATEGORIAS.push(...EXTRA.CATEGORIAS);
const NEGOCIOS_BASE = [
  ...ANTIGUAS.map((id) => normales.find((n) => n.id === id)),
  ...normales.filter((n) => !ANTIGUAS.includes(n.id)),
  ...exclusivas,
  ...elite
];
const NEGOCIOS = [...NEGOCIOS_BASE, ...EXTRA.construir(armar, NEGOCIOS_BASE, BONO_PAREJA)];`);

rep(`function porCobrar(u, db, ahora = Date.now()) {
  const desde = Number(u.negocioCobro) || ahora;
  const horas = Math.min(MAX_HORAS, Math.max(0, (ahora - desde) / 3600000));
  return Math.floor((Number(u.negocioPendiente) || 0) + horas * ingresoPorHora(u, db));
}`, `// ---- Multiplicadores: u.multiplicadores = [{ mult, desde, hasta, fuente }] y db.multiplicadorGlobal = { mult, desde, hasta }
// Valen solo desde que se activan (no cambian lo ya juntado) y se multiplican entre sí.
function eventosMult(db, u) {
  const l = Array.isArray(u && u.multiplicadores) ? u.multiplicadores.slice() : [];
  const g = db && db.multiplicadorGlobal;
  if (g && g.mult) l.push(g);
  return l.filter((e) => e && Number(e.mult) > 0 && Number(e.hasta) > Number(e.desde));
}
function multEn(eventos, t) {
  let m = 1;
  for (const e of eventos) if (e.desde <= t && t < e.hasta) m *= Number(e.mult);
  return Math.min(m, 1e6);
}
function horasEfectivas(db, u, desde, hasta) {
  if (!(hasta > desde)) return 0;
  const ev = eventosMult(db, u);
  const pts = new Set([desde, hasta]);
  for (const e of ev) { if (e.desde > desde && e.desde < hasta) pts.add(e.desde); if (e.hasta > desde && e.hasta < hasta) pts.add(e.hasta); }
  const o = [...pts].sort((a, b) => a - b);
  let h = 0;
  for (let i = 0; i < o.length - 1; i++) h += ((o[i + 1] - o[i]) / 3600000) * multEn(ev, (o[i] + o[i + 1]) / 2);
  return h;
}
const multiplicadorAhora = (db, u, ahora = Date.now()) => multEn(eventosMult(db, u), ahora);
const multiplicadorHasta = (db, u, ahora = Date.now()) => {
  const act = eventosMult(db, u).filter((e) => e.desde <= ahora && ahora < e.hasta && Number(e.mult) !== 1);
  return act.length ? Math.max(...act.map((e) => e.hasta)) : 0;
};
function podarMult(u, ahora = Date.now()) {
  if (!Array.isArray(u.multiplicadores)) return;
  const corte = Math.min(Number(u.negocioCobro) || ahora, ahora);
  u.multiplicadores = u.multiplicadores.filter((e) => e && Number(e.hasta) > corte);
}

function porCobrar(u, db, ahora = Date.now()) {
  const desde = Number(u.negocioCobro) || ahora;
  const fin = Math.min(ahora, desde + MAX_HORAS * 3600000);
  return Math.floor((Number(u.negocioPendiente) || 0) + horasEfectivas(db, u, desde, fin) * ingresoPorHora(u, db));
}`);

rep(`  const porHora = inv.items.reduce((t, e) => t + e.hora, 0);
  return {
    inv, porHora, en24: Math.floor(porHora * MAX_HORAS),`, `  const base = inv.items.reduce((t, e) => t + e.hora, 0);
  const mult = multiplicadorAhora(db, u, ahora);
  const porHora = Math.round(base * mult);
  return {
    inv, porHora, base, mult, multHasta: multiplicadorHasta(db, u, ahora), en24: Math.floor(porHora * MAX_HORAS),`);

rep(`propios, nivelDe, parejaDe, inventario, ingresoPorHora, porCobrar, fijar,`, `propios, nivelDe, parejaDe, inventario, ingresoPorHora, porCobrar, fijar, horasEfectivas, multiplicadorAhora, multiplicadorHasta, podarMult,`);
});

parchar('index.js', 'MISIONES-GANCHO', (rep) => {
  rep(`      await comando.execute(require('./lib/iaRespuestas').envolverSockSiEsIA(sock, comando), jid, msg, { prefix, texto, comandos });`,
    `      await require('./lib/misiones').medir(sock, jid, msg, comando, texto, () => comando.execute(require('./lib/iaRespuestas').envolverSockSiEsIA(sock, comando), jid, msg, { prefix, texto, comandos })); // MISIONES-GANCHO`);
});

parchar('commands/economia/negocio.js', 'MISIONES-AVISO', (rep) => {
  rep("    `🏘️ Tienes *${r.cantidad}* de ${r.total} propiedades · ${eco.dinero(r.porHora)} por hora`,",
    "    `🏘️ Tienes *${r.cantidad}* de ${r.total} propiedades · ${eco.dinero(r.porHora)} por hora${r.mult > 1 ? ` ⚡x${Math.round(r.mult * 100) / 100}` : ''}`,\n    ...(r.mult > 1 ? [`⚡ Multiplicador activo: quedan ${Math.ceil((r.multHasta - Date.now()) / 60000)} min · mira *${prefix}misiones*`] : []),");
});

parchar('commands/economia/recolectar.js', 'MISIONES-AVISO', (rep) => {
  rep("        `🏘️ ${r.resumen.cantidad} propiedades ganan ${eco.dinero(r.resumen.porHora)} por hora`,",
    "        `🏘️ ${r.resumen.cantidad} propiedades ganan ${eco.dinero(r.resumen.porHora)} por hora`,\n        ...(r.resumen.mult > 1 ? [`⚡ Multiplicador activo: x${Math.round(r.resumen.mult * 100) / 100} · quedan ${Math.ceil((r.resumen.multHasta - Date.now()) / 60000)} min`] : []),");
});

parchar('lib/mapa-mundo.js', 'MISIONES-MAPA', (rep) => {
  rep('COLS = 7, FILAS = 7; // PARCHE-MAPA-ELITE (antes 5 filas)', 'COLS = 7, FILAS = 9; // MISIONES-MAPA (antes 7; más espacio para los negocios nuevos)');
  rep("const CUADRANTES = [['comercio', 'diversion', 'capital'], ['tecnologia', 'finanzas', 'exclusivas', 'elite'], ['industria', 'transporte', 'servicios', 'elite'], ['comida', 'turismo', 'elite']];",
    "const CUADRANTES = [['comercio', 'diversion', 'capital', 'deportes'], ['tecnologia', 'finanzas', 'exclusivas', 'elite'], ['industria', 'transporte', 'servicios', 'ciencia', 'elite'], ['comida', 'turismo', 'arte', 'elite']];");
});

parchar('lib/mapa-edificios.js', 'MISIONES-MAPA', (rep) => {
  rep("  cosmos: 'estrella', absoluto: 'corona'\n};", `  cosmos: 'estrella', absoluto: 'corona'
};
// MISIONES-MAPA: dibujo e icono de los negocios nuevos
Object.assign(ASIGNACION, {
  canchafut: ['campo', {}], tiendadeporte: ['tienda', {}], alberca: ['acuatico', {}], padel: ['campo', {}], boxeo: ['tienda', {}], pistakarts: ['campo', {}],
  arenalucha: ['estadio', {}], ligaesports: ['neon', {}], estadiobeis: ['estadio', {}], complejoolimp: ['estadio', {}],
  galeria: ['tienda', {}], tatuajes: ['tienda', {}], imprenta: ['fabrica', {}], radio: ['oficina', {}], fotografia: ['tienda', {}], grabacion: ['teatro', {}],
  periodico: ['oficina', {}], productora: ['teatro', {}], orquesta: ['teatro', {}], conciertos: ['estadio', {}],
  dentista: ['tienda', {}], optica: ['tienda', {}], labclinico: ['hospital', {}], fisio: ['hospital', {}], nutricion: ['tienda', {}], planetario: ['oficina', { domo: true, pisos: 2 }],
  cirugia: ['hospital', {}], biotech: ['oficina', {}], investigacion: ['oficina', { domo: true, pisos: 3 }], genetica: ['torre', {}],
  cafeteriaoro: ['restaurante', { pisos: 2, sim: 'taza' }], acuario: ['acuatico', {}], circo: ['parque', {}], biblioteca: ['teatro', {}], carnaval: ['parque', {}],
  observatorio: ['torre', { antena: true }], faro: ['torre', {}], dojo: ['taller', {}], jardinbotanico: ['invernadero', {}], tesoropirata: ['puerto', {}], templo: ['santuario', {}],
  volcan: ['mina', {}], ruinas: ['castillo', {}], sellomusical: ['teatro', {}], zeppelin: ['aeropuerto', {}], palaciohielo: ['castillo', {}], mundoanime: ['neon', {}],
  selva: ['zoo', {}], piramide: ['castillo', {}], estrellapop: ['teatro', {}], platillos: ['espacial', { satelite: true }], guaridadragon: ['castillo', {}],
  manantial: ['banco', { bolsa: true }], midas: ['castillo', {}], singularidad: ['espacial', { cohete: true }]
});
Object.assign(ICONO, {
  canchafut: 'pelota', tiendadeporte: 'pelota', alberca: 'gota', padel: 'pelota', boxeo: 'pesa', pistakarts: 'taxi', arenalucha: 'corona', ligaesports: 'control', estadiobeis: 'pelota', complejoolimp: 'estrella',
  galeria: 'columna', tatuajes: 'estrella', imprenta: 'libro', radio: 'nota', fotografia: 'estrella', grabacion: 'nota', periodico: 'libro', productora: 'claqueta', orquesta: 'nota', conciertos: 'nota',
  dentista: 'cruz', optica: 'estrella', labclinico: 'cruz', fisio: 'pesa', nutricion: 'hoja', planetario: 'estrella', cirugia: 'cruz', biotech: 'chip', investigacion: 'engranaje', genetica: 'chip',
  cafeteriaoro: 'taza', acuario: 'pez', circo: 'estrella', biblioteca: 'libro', carnaval: 'nota', observatorio: 'estrella', faro: 'estrella', dojo: 'pesa', jardinbotanico: 'flor', tesoropirata: 'barco', templo: 'columna',
  volcan: 'rayo', ruinas: 'columna', sellomusical: 'nota', zeppelin: 'avion', palaciohielo: 'diamante', mundoanime: 'estrella', selva: 'hoja', piramide: 'corona', estrellapop: 'corazon', platillos: 'estrella', guaridadragon: 'corona',
  manantial: 'diamante', midas: 'corona', singularidad: 'estrella'
});`);
});

// el panel web del mapa usa un bundle minificado: se regenera (o se borra para que use los archivos tal cual)
try {
  const min = 'assets/mapa/mapa-panel.min.js';
  if (fs.existsSync(min) && !fs.existsSync('assets/mapa/.regenerado-misiones')) {
    fs.copyFileSync(min, min + '.bak-misiones');
    try {
      execSync('cat lib/mapa-edificios.js lib/mapa-mundo.js assets/mapa/cliente.js | npx --yes esbuild --minify --target=es2018 > assets/mapa/mapa-panel.min.js.nuevo', { stdio: 'pipe', timeout: 120000, shell: '/bin/bash' });
      if (fs.statSync(min + '.nuevo').size > 1000) { fs.renameSync(min + '.nuevo', min); console.log('panel del mapa: regenerado'); }
      else throw new Error('salida vacia');
    } catch (e) {
      try { fs.unlinkSync(min + '.nuevo'); } catch (_) {}
      fs.unlinkSync(min); // sin el bundle, el panel usa los 3 archivos tal cual (funciona igual, solo pesa más)
      console.log('panel del mapa: sin esbuild, se uso los archivos tal cual (' + String(e.message).slice(0, 60) + ')');
    }
    fs.writeFileSync('assets/mapa/.regenerado-misiones', '1');
  }
} catch (e) { console.log('panel del mapa: ' + e.message); }
