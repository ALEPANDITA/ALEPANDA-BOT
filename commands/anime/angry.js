const { enviarReaccion } = require('../../lib/animereact');

// Lista completa de reacciones de la API de evogb
const reacciones = [
  { name: 'peek', emoji: '👀', desc: 'espiar', sin: 'esfía', con: 'espía a' },
  { name: 'comfort', emoji: '🫂', desc: 'consolar', sin: 'busca consuelo', con: 'consuela a' },
  { name: 'thinkhard', emoji: '🤔', desc: 'pensar intensamente', sin: 'piensa intensamente', con: 'piensa intensamente en' },
  { name: 'curious', emoji: '🧐', desc: 'sentir curiosidad', sin: 'tiene curiosidad', con: 'siente curiosidad por' },
  { name: 'sniff', emoji: '👃', desc: 'olfatear', sin: 'olfatea el ambiente', con: 'olfatea a' },
  { name: 'stare', emoji: '👀', desc: 'mirar fijamente', sin: 'mira fijamente', con: 'mira fijamente a' },
  { name: 'trip', emoji: '💫', desc: 'tropezar', sin: 'tropieza', con: 'tropieza con' },
  { name: 'blowkiss', emoji: '💋', desc: 'lanzar un beso', sin: 'lanza un beso', con: 'le lanza un beso a' },
  { name: 'snuggle', emoji: '🥰', desc: 'acurrucarse', sin: 'busca acurrucarse', con: 'se acurruca con' },
  { name: 'angry', emoji: '😡', desc: 'sentirse enojado', sin: 'está muy enojado/a', con: 'está muy enojado/a con' },
  { name: 'bleh', emoji: '😛', desc: 'sacar la lengua', sin: 'saca la lengua', con: 'le saca la lengua a' },
  { name: 'bored', emoji: '🥱', desc: 'estar aburrido', sin: 'está aburrido/a', con: 'se aburre de' },
  { name: 'clap', emoji: '👏', desc: 'aplaudir', sin: 'aplaude', con: 'aplaude a' },
  { name: 'coffee', emoji: '☕', desc: 'tomar café', sin: 'toma café', con: 'toma café con' },
  { name: 'dramatic', emoji: '🎭', desc: 'actuar con dramatismo', sin: 'actúa con dramatismo', con: 'hace drama con' },
  { name: 'drunk', emoji: '🥴', desc: 'estar borracho', sin: 'está borracho/a', con: 'está borracho/a con' },
  { name: 'cold', emoji: '🥶', desc: 'sentir frío', sin: 'tiene frío', con: 'siente frío junto a' },
  { name: 'impregnate', emoji: '😳', desc: 'dejar embarazada', sin: 'busca dejar embarazada', con: 'sorprende a' },
  { name: 'kisscheek', emoji: '😚', desc: 'dar un beso en la mejilla', sin: 'da un beso al aire', con: 'le da un beso en la mejilla a' },
  { name: 'sing', emoji: '🎤', desc: 'cantar', sin: 'canta una canción', con: 'canta junto a' },
  { name: 'tickle', emoji: '😆', desc: 'hacer cosquillas', sin: 'quiere cosquillas', con: 'le hace cosquillas a' },
  { name: 'scream', emoji: '😱', desc: 'gritar', sin: 'pega un grito', con: 'le grita a' },
  { name: 'push', emoji: '➡️', desc: 'empujar', sin: 'empuja el aire', con: 'empuja a' },
  { name: 'nope', emoji: '🙅', desc: 'negar con firmeza', sin: 'niega rotundamente', con: 'le niega algo a' },
  { name: 'jump', emoji: '🦘', desc: 'saltar', sin: 'salta de alegría', con: 'salta junto a' },
  { name: 'heat', emoji: '🔥', desc: 'sentir calor', sin: 'siente mucho calor', con: 'siente calor con' },
  { name: 'gaming', emoji: '🎮', desc: 'jugar videojuegos', sin: 'se pone a jugar', con: 'juega videojuegos con' },
  { name: 'draw', emoji: '🎨', desc: 'dibujar', sin: 'se pone a dibujar', con: 'dibuja a' },
  { name: 'call', emoji: '📞', desc: 'hacer una llamada', sin: 'hace una llamada', con: 'llama por teléfono a' },
  { name: 'laugh', emoji: '😂', desc: 'reír', sin: 'se ríe a carcajadas', con: 'se ríe con' },
  { name: 'love', emoji: '❤️', desc: 'sentir amor', sin: 'siente mucho amor', con: 'ama mucho a' },
  { name: 'pout', emoji: '😒', desc: 'hacer pucheros', sin: 'hace pucheros', con: 'le hace pucheros a' },
  { name: 'punch', emoji: '👊', desc: 'dar un puñetazo', sin: 'lanza un puñetazo al aire', con: 'le da un puñetazo a' },
  { name: 'run', emoji: '🏃', desc: 'correr', sin: 'sale corriendo', con: 'corre tras' },
  { name: 'sad', emoji: '😢', desc: 'sentirse triste', sin: 'se siente triste', con: 'se siente triste por' },
  { name: 'scared', emoji: '😨', desc: 'sentirse asustado', sin: 'está asustado/a', con: 'se asusta de' },
  { name: 'seduce', emoji: '😏', desc: 'intentar seducir', sin: 'intenta seducir', con: 'intenta seducir a' },
  { name: 'shy', emoji: '😳', desc: 'sentir timidez', sin: 'se siente tímido/a', con: 'se avergüenza ante' },
  { name: 'sleep', emoji: '😴', desc: 'dormir', sin: 'se queda dormido/a', con: 'duerme junto a' },
  { name: 'smoke', emoji: '🚬', desc: 'fumar', sin: 'fuma un cigarrillo', con: 'comparte humo con' },
  { name: 'spit', emoji: '💦', desc: 'escupir', sin: 'escume con desprecio', con: 'le escupe a' },
  { name: 'step', emoji: '👣', desc: 'pisar', sin: 'da un paso', con: 'pisa a' },
  { name: 'think', emoji: '💭', desc: 'pensar', sin: 'se queda pensando', con: 'piensa en' },
  { name: 'walk', emoji: '🚶', desc: 'caminar', sin: 'sale a caminar', con: 'camina junto a' },
  { name: 'hug', emoji: '🤗', desc: 'abrazar', sin: 'da un abrazo', con: 'le da un abrazo a' },
  { name: 'kill', emoji: '🔪', desc: 'cometer un asesinato', sin: 'anda con sed de sangre', con: 'acabó con' },
  { name: 'eat', emoji: '🍽️', desc: 'comer', sin: 'se dispone a comer', con: 'comparte la comida con' },
  { name: 'kiss', emoji: '😘', desc: 'besar', sin: 'manda un beso', con: 'le da un beso a' },
  { name: 'wink', emoji: '😉', desc: 'guiñar el ojo', sin: 'guiña el ojo', con: 'le guiña el ojo a' },
  { name: 'pat', emoji: '🖐️', desc: 'acariciar la cabeza', sin: 'quiere mimos', con: 'está acariciando a' },
  { name: 'happy', emoji: '😄', desc: 'sentirse feliz', sin: 'está muy feliz', con: 'se alegra con' },
  { name: 'bully', emoji: '😈', desc: 'molestar en tono juguetón', sin: 'molesta a todos', con: 'molesta juguetonamente a' },
  { name: 'bite', emoji: '😬', desc: 'morder', sin: 'dio un mordisco', con: 'mordió a' },
  { name: 'blush', emoji: '😊', desc: 'sonrojarse', sin: 'se ha sonrojado', con: 'se sonroja por' },
  { name: 'wave', emoji: '👋', desc: 'saludar con la mano', sin: 'saluda con la mano', con: 'saluda efusivamente a' },
  { name: 'bath', emoji: '🛁', desc: 'darse un baño', sin: 'toma un baño relajante', con: 'se baña con' },
  { name: 'smug', emoji: '😏', desc: 'mostrarse presumido', sin: 'se muestra presumido/a', con: 'presume ante' },
  { name: 'smile', emoji: '😊', desc: 'sonreír', sin: 'sonríe alegremente', con: 'le sonríe a' },
  { name: 'highfive', emoji: '✋', desc: 'chocar los cinco', sin: 'busca chocar los cinco', con: 'choca los cinco con' },
  { name: 'handhold', emoji: '🤝', desc: 'tomarse de las manos', sin: 'busca tomarse de las manos', con: 'se toma de las manos con' },
  { name: 'cringe', emoji: '😬', desc: 'sentir vergüenza ajena', sin: 'siente vergüenza ajena', con: 'siente cringe por' },
  { name: 'bonk', emoji: '🔨', desc: 'golpear en la cabeza por travesura', sin: 'busca a quién golpear', con: 'le da un sape/bonk a' },
  { name: 'cry', emoji: '😢', desc: 'llorar', sin: 'rompe a llorar', con: 'llora junto a' },
  { name: 'lick', emoji: '👅', desc: 'lamer', sin: 'da un lametazo', con: 'lamió a' },
  { name: 'slap', emoji: '👋', desc: 'dar una bofetada', sin: 'dio una bofetada', con: 'le dio una bofetada a' },
  { name: 'dance', emoji: '💃', desc: 'bailar', sin: 'se puso a bailar', con: 'está bailando con' },
  { name: 'cuddle', emoji: '🫂', desc: 'acurrucarse', sin: 'se acurrucó', con: 'se acurrucó con' },
  { name: 'yawn', emoji: '🥱', desc: 'bostezar', sin: 'da un gran bostezo', con: 'bosteza junto a' },
  { name: 'talk', emoji: '🗣️', desc: 'hablar', sin: 'se pone a hablar', con: 'habla largamente con' },
  { name: 'study', emoji: '📚', desc: 'estudiar', sin: 'se pone a estudiar', con: 'estudia junto a' },
  { name: 'sneeze', emoji: '🤧', desc: 'estornudar', sin: 'suelta un estornudo', con: 'contagia su estornudo a' },
  { name: 'sick', emoji: '🤒', desc: 'estar enfermo', sin: 'se siente enfermo/a', con: 'cuida de' },
  { name: 'scrub', emoji: '🧽', desc: 'frotar / Restregar', sin: 'se pone a limpiar', con: 'frota y limpia a' },
  { name: 'psycho', emoji: '🤪', desc: 'comportarse como un psicópata', sin: 'actúa de forma psicópata', con: 'mira con locura a' },
  { name: 'poke', emoji: '👉', desc: 'dar un toque con el dedo', sin: 'da un toque', con: 'le da un poke a' },
  { name: 'lewd', emoji: '😳', desc: 'actitud lasciva', sin: 'tiene pensamientos lewd', con: 'mira con lujuria a' },
  { name: 'kisshead', emoji: '😘', desc: 'besar en la cabeza', sin: 'manda un beso al cielo', con: 'le da un beso en la cabeza a' },
  { name: 'kicked', emoji: '🦶', desc: 'Ser pateado', sin: 'recibe una patada', con: 'patea fuertemente a' },
  { name: 'facepalm', emoji: '🤦', desc: 'Hacer facepalm', sin: 'hace un facepalm', con: 'se arrepiente por culpa de' },
  { name: 'cook', emoji: '🍳', desc: 'Cocinar', sin: 'se pone a cocinar', con: 'le cocina algo rico a' }
];

module.exports = reacciones.map(r => ({
  name: r.name,
  category: 'anime',
  description: `Interacción de anime (${r.desc}). Uso: .${r.name} [@usuario]`,
  execute: async (sock, jid, msg, ctx) => {
    return enviarReaccion(sock, jid, msg, {
      tipo: r.name,
      emoji: r.emoji,
      conObjetivo: (yo, el) => `@${yo} ${r.con} @${el}`,
      sinObjetivo: (yo) => `@${yo} ${r.sin}`,
      obtener: async () => {
        try {
          const res = await fetch(`https://api.evogb.org/sfw/interaction?key=evogb-WPHlBOdu&type=${r.name}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const url = json?.url || json?.results?.[0]?.url || json?.result;
          if (url) return { url };
        } catch (e) {
          // Si falla la API principal, usar una alternativa para que nunca falle el comando
        }
        const alt = await fetch(`https://nekos.best/api/v2/${r.name}`);
        const data = await alt.json();
        return { url: data?.results?.[0]?.url };
      }
    });
  }
}));