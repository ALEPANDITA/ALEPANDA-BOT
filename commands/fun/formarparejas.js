const { caja, error: cajaError } = require('../../lib/estilo');

const FRASES = [
  'El destino ha hablado...',
  'Las estrellas se han alineado para ustedes dos',
  'Cupido disparo su flecha sin piedad',
  'Que comience el romance (o el caos)',
  'Nadie escapa del amor forzado'
];

module.exports = {
  name: 'formarparejas',
  category: 'fun',
  description: 'El bot elige una pareja random entre los miembros del grupo',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    try {
      const metadata = await sock.groupMetadata(jid);
      const participantes = metadata.participants
        .map(p => p.id)
        .filter(id => !id.includes('status@broadcast'));

      if (participantes.length < 2) {
        return sock.sendMessage(jid, { text: cajaError('Se necesitan al menos 2 personas en el grupo para formar una pareja.') });
      }

      const mezclados = [...participantes].sort(() => Math.random() - 0.5);
      const [persona1, persona2] = mezclados;

      const frase = FRASES[Math.floor(Math.random() * FRASES.length)];
      const porcentaje = Math.floor(Math.random() * 41) + 60; // entre 60% y 100%

      const texto = caja([
        `💘 @${persona1.split('@')[0]}`,
        `💞           +           💞`,
        `💘 @${persona2.split('@')[0]}`,
        ``,
        `📊 Compatibilidad: ${porcentaje}%`,
        `✨ ${frase}`
      ], {
        titulo: 'PAREJA DEL DIA',
        pie: 'El amor (o la desgracia) es aleatorio',
        estilo: 'kawaii'
      });

      await sock.sendMessage(jid, {
        text: texto,
        mentions: [persona1, persona2]
      });
    } catch (err) {
      console.error('[formarparejas]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo formar la pareja, intenta de nuevo.') });
    }
  }
};
