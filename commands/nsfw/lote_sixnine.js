const { enviarReaccion } = require('../../lib/animereact');

const reacciones = [
  { name: 'sixnine', emoji: '🔥', desc: 'Posición donde ambos se estimulan oralmente al mismo tiempo.' },
  { name: 'cummoth', emoji: '💦', desc: 'Eyaculación dentro de la boca durante el sexo oral.' },
  { name: 'cumshot', emoji: '💦', desc: 'Eyaculación externa sobre el cuerpo o rostro.' },
  { name: 'lickpussy', emoji: '👅', desc: 'Estimular la vulva con la lengua.' },
  { name: 'lickdick', emoji: '👅', desc: 'Lamer el pene para excitación.' },
  { name: 'lickass', emoji: '👅', desc: 'Lamer el ano para placer sexual.' },
  { name: 'grope', emoji: '✋', desc: 'Acariciar o apretar las nalgas de forma sexual.' },
  { name: 'grabboobs', emoji: '🍒', desc: 'Agarar los pechos con las manos para estimulación.' },
  { name: 'blowjob', emoji: '🍌', desc: 'Sexo oral en el pene hasta la eyaculación.' },
  { name: 'boobjob', emoji: '🍈', desc: 'Estimular el pene entre los pechos.' },
  { name: 'fap', emoji: '✊', desc: 'Masturbación solitaria del pene.' },
  { name: 'footjob', emoji: '👣', desc: 'Estimular el pene usando los pies.' },
  { name: 'fingering', emoji: '👉', desc: 'Introducir y mover los dedos en la vagina o ano para estimular.' },
  { name: 'creampie', emoji: '🍼', desc: 'Eyaculación interna en la vagina.' },
  { name: 'facesitting', emoji: '🪑', desc: 'Sentarse sobre la cara de la pareja.' },
  { name: 'futanari', emoji: '✨', desc: 'Personaje futanari realizando actos sexuales.' },
  { name: 'pegging', emoji: '🍑', desc: 'Mujer que penetra analmente a un hombre usando un strap-on.' },
  { name: 'bondage', emoji: '⛓️', desc: 'Atar o inmovilizar a la pareja con cuerdas o esposas.' },
  { name: 'deepthroat', emoji: '🎤', desc: 'Introducir el pene completamente hasta la garganta.' },
  { name: 'thighjob', emoji: '🦵', desc: 'Estimular el pene frotándolo entre los muslos cerrados.' },
  { name: 'yaoi', emoji: '💫', desc: 'Posición gay masculina.' },
  { name: 'bukkake', emoji: '💦', desc: 'Múltiples hombres eyaculan simultáneamente sobre una persona.' },
  { name: 'orgy', emoji: '🔥', desc: 'Sexo grupal.' },
  { name: 'squirting', emoji: '🌊', desc: 'Expulsión de líquido durante el clímax femenino.' }
];

module.exports = reacciones.map((r) => ({
  name: r.name,
  category: 'nsfw',
  description: `Reacción NSFW (${r.name}): ${r.desc}`,
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: r.name,
    emoji: r.emoji,
    conObjetivo: (yo, el) => `@${yo} usa ${r.name} con @${el}`,
    sinObjetivo: (yo) => `@${yo} realiza ${r.name}`,
    obtener: async () => {
      const res = await fetch(`https://api.evogb.org/nsfw/interaction?key=evogb-WPHlBOdu&type=${r.name}`);
      const json = await res.json();
      const url = json.url || json.result || json.image || json.link;
      return { url };
    }
  })
}));