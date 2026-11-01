// Revisa (sin generar logos) que cada diseno de commands/logo/logos.js siga siendo una pagina de ephoto360
// que acepta texto. Uso en la VPS:  node scripts/verificar-logos.js
const comandos = require('../commands/logo/logos.js');
const { revisarEfecto } = require('../lib/logomaker');

(async () => {
  let buenos = 0;
  let malos = 0;
  for (const c of comandos) {
    const efectos = c._efectos || [];
    console.log(`\n.${c.name} (${efectos.length} diseno${efectos.length === 1 ? '' : 's'})`);
    for (const [i, url] of efectos.entries()) {
      const r = await revisarEfecto(url);
      if (r.ok) buenos++; else malos++;
      console.log(`  ${r.ok ? 'OK ' : 'MAL'} #${i + 1} ${url.replace('https://en.ephoto360.com/', '')} -> ${r.motivo}`);
      await new Promise((ok) => setTimeout(ok, 400));
    }
  }
  console.log(`\nResumen: ${buenos} bien, ${malos} mal. Los "MAL" el bot los salta solo; puedes quitarlos de la lista "efectos" de commands/logo/logos.js.`);
})();
