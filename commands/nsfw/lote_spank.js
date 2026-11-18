const { enviarReaccion } = require('../../lib/animereact');
const fs = require('fs');
const path = require('path');

const API_KEY = 'evogb-WPHlBOdu';
const BASE_URL = 'https://api.evogb.org/nsfw/interaction';

const tabla = [
  {
    name: 'spank',
    emoji: '🤚',
    desc: 'Golpear las nalgas para excitación sexual.',
    conObj: (yo, el) => `@${yo} le da unas nalgadas a @${el}`,
    sinObj: (yo) => `@${yo} da unas nalgadas`
  },
  {
    name: 'undress',
    emoji: '👗',
    desc: 'Quitar la ropa para exponer el cuerpo desnudo.',
    conObj: (yo, el) => `@${yo} le quita la ropa a @${el}`,
    sinObj: (yo) => `@${yo} se quita la ropa`
  },
  {
    name: 'yuri',
    emoji: '💞',
    desc: 'Posición lésbica donde se frotan los genitales mutuamente.',
    conObj: (yo, el) => `@${yo} hace yuri con @${el}`,
    sinObj: (yo) => `@${yo} disfruta del yuri`
  },
  {
    name: 'sixnine',
    emoji: '💦',
    desc: 'Posición donde ambos se estimulan oralmente al mismo tiempo.',
    conObj: (yo, el) => `@${yo} hace un 69 con @${el}`,
    sinObj: (yo) => `@${yo} hace un 69`
  },
  {
    name: 'anal',
    emoji: '🍑',
    desc: 'Penetración sexual por el ano.',
    conObj: (yo, el) => `@${yo} le hace anal a @${el}`,
    sinObj: (yo) => `@${yo} hace anal`
  },
  {
    name: 'fuck',
    emoji: '🍆',
    desc: 'Acto de penetración sexual vigorosa.',
    conObj: (yo, el) => `@${yo} se folla a @${el}`,
    sinObj: (yo) => `@${yo} se folla a alguien`
  },
  {
    name: 'cummoth',
    emoji: '👄',
    desc: 'Eyaculación dentro de la boca durante el sexo oral.',
    conObj: (yo, el) => `@${yo} se viene en la boca de @${el}`,
    sinObj: (yo) => `@${yo} se viene en la boca`
  },
  {
    name: 'suckboobs',
    emoji: '🍼',
    desc: 'Estimular los pechos con la boca y lengua.',
    conObj: (yo, el) => `@${yo} le chupa los pechos a @${el}`,
    sinObj: (yo) => `@${yo} chupa pechos`
  },
  {
    name: 'cumshot',
    emoji: '💧',
    desc: 'Eyaculación externa sobre el cuerpo o rostro.',
    conObj: (yo, el) => `@${yo} se viene sobre @${el}`,
    sinObj: (yo) => `@${yo} se viene`
  },
  {
    name: 'lickpussy',
    emoji: '👅',
    desc: 'Estimular la vulva con la lengua.',
    conObj: (yo, el) => `@${yo} le lame el coño a @${el}`,
    sinObj: (yo) => `@${yo} lame un coño`
  },
  {
    name: 'lickdick',
    emoji: '👅',
    desc: 'Lamer el pene para excitación.',
    conObj: (yo, el) => `@${yo} le lame el pene a @${el}`,
    sinObj: (yo) => `@${yo} lame un pene`
  },
  {
    name: 'lickass',
    emoji: '👅',
    desc: 'Lamer el ano para placer sexual.',
    conObj: (yo, el) => `@${yo} le lame el culo a @${el}`,
    sinObj: (yo) => `@${yo} lame un culo`
  },
  {
    name: 'handjob',
    emoji: '🤲',
    desc: 'Masturbación manual del pene.',
    conObj: (yo, el) => `@${yo} le hace una paja a @${el}`,
    sinObj: (yo) => `@${yo} se hace una paja`
  },
  {
    name: 'grope',
    emoji: '🤏',
    desc: 'Acariciar o apretar las nalgas de forma sexual.',
    conObj: (yo, el) => `@${yo} le toca las nalgas a @${el}`,
    sinObj: (yo) => `@${yo} manosea nalgas`
  },
  {
    name: 'cum',
    emoji: '💦',
    desc: 'Eyaculación intensa o clímax sexual.',
    conObj: (yo, el) => `@${yo} se viene por @${el}`,
    sinObj: (yo) => `@${yo} se viene`
  },
  {
    name: 'grabboobs',
    emoji: '🤲',
    desc: 'Agarar los pechos con las manos para estimulación.',
    conObj: (yo, el) => `@${yo} le agarra los pechos a @${el}`,
    sinObj: (yo) => `@${yo} agarra pechos`
  },
  {
    name: 'blowjob',
    emoji: '👄',
    desc: 'Sexo oral en el pene hasta la eyaculación.',
    conObj: (yo, el) => `@${yo} le hace una mamada a @${el}`,
    sinObj: (yo) => `@${yo} hace una mamada`
  },
  {
    name: 'boobjob',
    emoji: '🍒',
    desc: 'Estimular el pene entre los pechos.',
    conObj: (yo, el) => `@${yo} le hace una paja con las tetas a @${el}`,
    sinObj: (yo) => `@${yo} hace una paja con las tetas`
  },
  {
    name: 'fap',
    emoji: '✊',
    desc: 'Masturbación solitaria del pene.',
    conObj: (yo, el) => `@${yo} se masturba pensando en @${el}`,
    sinObj: (yo) => `@${yo} se masturba`
  },
  {
    name: 'footjob',
    emoji: '🦶',
    desc: 'Estimular el pene usando los pies.',
    conObj: (yo, el) => `@${yo} le hace una paja con los pies a @${el}`,
    sinObj: (yo) => `@${yo} hace una paja con los pies`
  },
  {
    name: 'fingering',
    emoji: '🤏',
    desc: 'Introducir y mover los dedos en la vagina o ano.',
    conObj: (yo, el) => `@${yo} le mete los dedos a @${el}`,
    sinObj: (yo) => `@${yo} usa sus dedos`
  },
  {
    name: 'creampie',
    emoji: '🥧',
    desc: 'Eyaculación interna en la vagina durante o después de la penetración.',
    conObj: (yo, el) => `@${yo} le hace un creampie a @${el}`,
    sinObj: (yo) => `@${yo} hace un creampie`
  },
  {
    name: 'facesitting',
    emoji: '🪑',
    desc: 'Sentarse sobre la cara de la pareja para placer.',
    conObj: (yo, el) => `@${yo} se sienta en la cara de @${el}`,
    sinObj: (yo) => `@${yo} hace facesitting`
  },
  {
    name: 'futanari',
    emoji: '🧬',
    desc: 'Personaje futanari realizando actos sexuales.',
    conObj: (yo, el) => `@${yo} tiene un momento futanari con @${el}`,
    sinObj: (yo) => `@${yo} disfruta de algo futanari`
  },
  {
    name: 'pegging',
    emoji: '🍆',
    desc: 'Mujer que penetra analmente a un hombre usando un dildo.',
    conObj: (yo, el) => `@${yo} le hace pegging a @${el}`,
    sinObj: (yo) => `@${yo} hace pegging`
  },
  {
    name: 'bondage',
    emoji: '⛓️',
    desc: 'Atar o inmovilizar a la pareja con cuerdas o esposas.',
    conObj: (yo, el) => `@${yo} ata a @${el} para bondage`,
    sinObj: (yo) => `@${yo} practica bondage`
  },
  {
    name: 'deepthroat',
    emoji: '👄',
    desc: 'Introducir el pene completamente hasta la garganta.',
    conObj: (yo, el) => `@${yo} le hace garganta profunda a @${el}`,
    sinObj: (yo) => `@${yo} hace una garganta profunda`
  },
  {
    name: 'thighjob',
    emoji: '🦵',
    desc: 'Estimular el pene frotándolo entre los muslos cerrados.',
    conObj: (yo, el) => `@${yo} le hace una paja con los muslos a @${el}`,
    sinObj: (yo) => `@${yo} hace una paja con los muslos`
  },
  {
    name: 'yaoi',
    emoji: '👬',
    desc: 'Posición gay masculina donde dos hombres se estimulan.',
    conObj: (yo, el) => `@${yo} tiene un momento yaoi con @${el}`,
    sinObj: (yo) => `@${yo} disfruta del yaoi`
  },
  {
    name: 'bukkake',
    emoji: '💦',
    desc: 'Múltiples eyaculaciones sobre el rostro o cuerpo.',
    conObj: (yo, el) => `@${yo} le hace un bukkake a @${el}`,
    sinObj: (yo) => `@${yo} hace un bukkake`
  },
  {
    name: 'orgy',
    emoji: '👯‍♀️',
    desc: 'Sexo grupal donde varias personas participan.',
    conObj: (yo, el) => `@${yo} entra a una orgía con @${el}`,
    sinObj: (yo) => `@${yo} entra a una orgía`
  },
  {
    name: 'squirting',
    emoji: '💦',
    desc: 'Expulsión de líquido durante el clímax femenino.',
    conObj: (yo, el) => `@${yo} le hace squirt a @${el}`,
    sinObj: (yo) => `@${yo} hace squirt`
  }
];

// Helper to ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper to download and save gif if not exists
async function fetchAndSaveGif(commandName) {
  const url = `${BASE_URL}?key=${API_KEY}&type=${commandName}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    // API returns gif url in various possible fields; try common ones
    const gifUrl = json.url || json.result || json.media || json.urlGif || json.gif;
    if (!gifUrl) return null;

    const ext = path.extname(new URL(gifUrl).pathname) || '.gif';
    const dir = path.join(__dirname, commandName);
    ensureDir(dir);
    const fileName = `gif${ext}`;
    const filePath = path.join(dir, fileName);

    if (fs.existsSync(filePath)) {
      return filePath; // already cached
    }

    const gifRes = await fetch(gifUrl);
    const buffer = await gifRes.buffer();
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (e) {
    console.error(`Error fetching gif for ${commandName}:`, e);
    return null;
  }
}

// Helper to get a random local gif as fallback
function getRandomLocalGif(commandName) {
  const dir = path.join(__dirname, commandName);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => /\.(gif|mp4|webm)$/i.test(f));
  if (files.length === 0) return null;
  const chosen = files[Math.floor(Math.random() * files.length)];
  return path.join(dir, chosen);
}

module.exports = tabla.map(r => ({
  name: r.name,
  category: 'nsfw',
  description: `${r.desc} Uso: .${r.name} [@usuario]`,
  execute: async (sock, jid, msg, { prefix }) => {
    // Determine target user if mentioned
    const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const yo = msg?.key?.participant?.split('@')[0] || msg?.key?.remoteJid?.split('@')[0];
    const el = mentioned ? mentioned.split('@')[0] : null;

    // Try to fetch new gif and save
    let localPath = await fetchAndSaveGif(r.name);
    // If fetch failed, fallback to random local
    if (!localPath) {
      localPath = getRandomLocalGif(r.name);
    }

    // Prepare caption
    const caption = el ? r.conObj(yo, el) : r.sinObj(yo);

    // Send using enviarReaccion with local file if we have one
    await enviarReaccion(sock, jid, msg, {
      tipo: r.name,
      emoji: r.emoji,
      conObjetivo: r.conObj,
      sinObjetivo: r.sinObj,
      obtener: async () => {
        if (localPath) {
          return { url: `file://${localPath}` };
        }
        // As last resort, try API again without saving
        const res = await fetch(`${BASE_URL}?key=${API_KEY}&type=${r.name}`);
        const json = await res.json();
        const gifUrl = json.url || json.result || json.media || json.urlGif || json.gif;
        return { url: gifUrl };
      }
    });
  }
}));