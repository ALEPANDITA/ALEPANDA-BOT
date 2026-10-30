const { enviarReaccion } = require('../../lib/animereact');

const reacciones = [
  { name: 'comfort', emoji: '🫂', desc: 'Consolar', action: 'consola a' },
  { name: 'sniff', emoji: '👃', desc: 'Olfatear', action: 'olfatea a' },
  { name: 'stare', emoji: '👀', desc: 'Mirar fijamente', action: 'mira fijamente a' },
  { name: 'blowkiss', emoji: '💋', desc: 'Lanzar un beso', action: 'le lanza un beso a' },
  { name: 'bleh', emoji: '😛', desc: 'Sacar la lengua', action: 'le saca la lengua a' },
  { name: 'cold', emoji: '❄️', desc: 'Sentir frío', action: 'siente frío junto a' },
  { name: 'impregnate', emoji: '😳', desc: 'Dejar embarazada', action: 'deja embarazada a' },
  { name: 'kisscheek', emoji: '😚', desc: 'Dar un beso en la mejilla', action: 'le da un beso en la mejilla a' },
  { name: 'sing', emoji: '🎤', desc: 'Cantar', action: 'le canta a' },
  { name: 'tickle', emoji: '✍️', desc: 'Hacer cosquillas', action: 'le hace cosquillas a' },
  { name: 'scream', emoji: '😱', desc: 'Gritar', action: 'le grita a' },
  { name: 'push', emoji: '🫷', desc: 'Empujar', action: 'empuja a' },
  { name: 'nope', emoji: '🙅', desc: 'Negar con firmeza', action: 'le niega algo con firmeza a' },
  { name: 'jump', emoji: '🦘', desc: 'Saltar', action: 'salta junto a' },
  { name: 'heat', emoji: '🔥', desc: 'Sentir calor', action: 'siente calor junto a' },
  { name: 'gaming', emoji: '🎮', desc: 'Jugar videojuegos', action: 'juega videojuegos con' },
  { name: 'draw', emoji: '🎨', desc: 'Dibujar', action: 'dibuja a' },
  { name: 'call', emoji: '📞', desc: 'Hacer una llamada', action: 'llama por teléfono a' },
  { name: 'laugh', emoji: '😆', desc: 'Reír', action: 'se ríe de' },
  { name: 'pout', emoji: '😒', desc: 'Hacer pucheros', action: 'le hace pucheros a' },
  { name: 'run', emoji: '🏃', desc: 'Correr', action: 'corre junto a' },
  { name: 'sad', emoji: '😢', desc: 'Sentirse triste', action: 'se siente triste junto a' },
  { name: 'scared', emoji: '😨', desc: 'Sentirse asustado', action: 'se siente asustado por' },
  { name: 'seduce', emoji: '😏', desc: 'Intentar seducir', action: 'intenta seducir a' },
  { name: 'shy', emoji: '😳', desc: 'Sentir timidez', action: 'siente timidez ante' },
  { name: 'sleep', emoji: '💤', desc: 'Dormir', action: 'duerme junto a' },
  { name: 'smoke', emoji: '🚬', desc: 'Fumar', action: 'fuma con' },
  { name: 'spit', emoji: '💦', desc: 'Escupir', action: 'le escupe a' },
  { name: 'step', emoji: '👣', desc: 'Pisar', action: 'pisa a' },
  { name: 'think', emoji: '🤔', desc: 'Pensar', action: 'piensa en' },
  { name: 'walk', emoji: '🚶', desc: 'Caminar', action: 'camina con' },
  { name: 'eat', emoji: '🍽️', desc: 'Comer', action: 'come con' },
  { name: 'wink', emoji: '😉', desc: 'Guiñar el ojo', action: 'le guiña el ojo a' },
  { name: 'bully', emoji: '😈', desc: 'Molestar en tono juguetón', action: 'molesta en tono juguetón a' },
  { name: 'wave', emoji: '👋', desc: 'Saludar con la mano', action: 'saluda con la mano a' },
  { name: 'bath', emoji: '🛁', desc: 'Darse un baño', action: 'se baña junto a' },
  { name: 'smug', emoji: '😏', desc: 'Mostrarse presumido', action: 'se muestra presumido ante' },
  { name: 'smile', emoji: '😊', desc: 'Sonreír', action: 'le sonríe a' },
  { name: 'highfive', emoji: '✋', desc: 'Chocar los cinco', action: 'choca los cinco con' },
  { name: 'handhold', emoji: '🤝', desc: 'Tomarse de las manos', action: 'se toma de las manos con' },
  { name: 'cringe', emoji: '😬', desc: 'Sentir vergüenza ajena', action: 'siente vergüenza ajena por' },
  { name: 'bonk', emoji: '🔨', desc: 'Golpear en la cabeza por travesura', action: 'le da un sape en la cabeza a' },
  { name: 'yawn', emoji: '🥱', desc: 'Bostezar', action: 'bosteza junto a' },
  { name: 'talk', emoji: '🗣️', desc: 'Hablar', action: 'habla con' },
  { name: 'study', emoji: '📚', desc: 'Estudiar', action: 'estudia junto a' },
  { name: 'sneeze', emoji: '🤧', desc: 'Estornudar', action: 'estornuda cerca de' },
  { name: 'sick', emoji: '🤒', desc: 'Estar enfermo', action: 'está enfermo junto a' },
  { name: 'scrub', emoji: '🧽', desc: 'Frotar / Restregar', action: 'frota a' },
  { name: 'psycho', emoji: '🔪', desc: 'Comportarse como un psicópata', action: 'se comporta como un psicópata con' },
  { name: 'poke', emoji: '👉', desc: 'Dar un toque con el dedo', action: 'le da un poke a' },
  { name: 'lewd', emoji: '🔥', desc: 'Actitud lasciva', action: 'tiene una actitud lasciva con' },
  { name: 'kisshead', emoji: '😘', desc: 'Besar en la cabeza', action: 'le da un beso en la cabeza a' },
  { name: 'kicked', emoji: '🦵', desc: 'Ser pateado', action: 'patea a' },
  { name: 'facepalm', emoji: '🤦', desc: 'Hacer facepalm', action: 'hace facepalm por culpa de' },
  { name: 'cook', emoji: '👨‍🍳', desc: 'Cocinar', action: 'le cocina a' }
];

module.exports = reacciones.map((r) => ({
  name: r.name,
  category: 'anime',
  description: `${r.desc} (ej: .${r.name} @usuario)`,
  execute: async (sock, jid, msg, ctx) => {
    return enviarReaccion(sock, jid, msg, {
      tipo: r.name,
      emoji: r.emoji,
      conObjetivo: (yo, el) => `@${yo} ${r.action} @${el}`,
      sinObjetivo: (yo) => `@${yo} ${r.action} a alguien`,
      obtener: async () => {
        const res = await fetch(`https://api.evogb.org/sfw/interaction?key=evogb-WPHlBOdu&type=${r.name}`);
        const json = await res.json();
        const url = json.url || json.result || json.reaction || (json.data && json.data.url);
        return { url };
      }
    });
  }
}));