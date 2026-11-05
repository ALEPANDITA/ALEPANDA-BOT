// Revisa (sin generar logos) que cada diseno de commands/logo/logos.js y commands/logovideo/logovideo.js siga siendo una
// pagina de ephoto360 que acepta texto. Uso en la VPS:  node scripts/verificar-logos.js
// Para ver solo un comando:  node scripts/verificar-logos.js logooro
const comandos = [...require('../commands/logo/logos.js'), ...require('../commands/logovideo/logovideo.js')];
const { revisarEfecto } = require('../lib/logomaker');

(async () => {
  const solo = (process.argv[2] || '').replace(/^\./, '').toLowerCase();
  let buenos = 0;
  let malos = 0;
  for (const c of comandos) {
    if (solo && c.name !== solo) continue;
    const efectos = c._efectos || [];
    console.log(`\n.${c.name}${c._video ? ' [video]' : ''} (${efectos.length} diseno${efectos.length === 1 ? '' : 's'})`);
    for (const [i, url] of efectos.entries()) {
      const r = await revisarEfecto(url);
      if (r.ok) buenos++; else malos++;
      console.log(`  ${r.ok ? 'OK ' : 'MAL'} #${i + 1} ${url.replace('https://en.ephoto360.com/', '')} -> ${r.motivo}`);
      await new Promise((ok) => setTimeout(ok, 400));
    }
  }
  console.log(`\nResumen: ${buenos} bien, ${malos} mal. Los "MAL" el bot los salta solo; puedes quitarlos de la lista "efectos" de commands/logo/logos.js o commands/logovideo/logovideo.js.`);
})();
