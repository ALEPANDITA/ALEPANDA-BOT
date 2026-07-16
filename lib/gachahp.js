// Arquetipos genericos de un mundo de magia y hechiceria (sin nombres de personajes con copyright).
// Cada uno tiene un avatar unico generado con DiceBear (ver lib/avatarhp.js).
const PERSONAJES = {
  comun: [
    { nombre: 'Aprendiz de Encantamientos', casa: 'Gryffindor', emoji: '🦁', frase: 'Apenas empieza a controlar su varita.' },
    { nombre: 'Estudiante Curioso', casa: 'Ravenclaw', emoji: '🦅', frase: 'Siempre con la nariz metida en un libro.' },
    { nombre: 'Guardian de Criaturas', casa: 'Staff', emoji: '🐉', frase: 'Cuida de las mascotas magicas de la escuela.' },
    { nombre: 'Vendedor del Callejon', casa: 'Diagon Alley', emoji: '🪄', frase: 'Conoce cada tienda del callejon magico.' },
    { nombre: 'Bibliotecario Nocturno', casa: 'Ravenclaw', emoji: '📚', frase: 'Vigila los pasillos de la biblioteca al anochecer.' },
    { nombre: 'Fan del Quidditch', casa: 'Hufflepuff', emoji: '🦡', frase: 'No se pierde ni un partido.' },
    { nombre: 'Aprendiz de Pociones', casa: 'Slytherin', emoji: '🐍', frase: 'Su caldero explota mas de lo que deberia.' },
    { nombre: 'Explorador de Pasillos', casa: 'Gryffindor', emoji: '🦁', frase: 'Busca pasadizos secretos entre clase y clase.' },
    { nombre: 'Coleccionista de Cromos', casa: 'Hufflepuff', emoji: '🦡', frase: 'Tiene cromos de magos repetidos por montones.' },
    { nombre: 'Conserje Vigilante', casa: 'Staff', emoji: '🐈', frase: 'Nada se le escapa en los pasillos.' }
  ],
  rara: [
    { nombre: 'Bruja Encantadora', casa: 'Ravenclaw', emoji: '🦅', frase: 'Ve mas alla de lo que otros pueden imaginar.' },
    { nombre: 'Mago Bromista', casa: 'Gryffindor', emoji: '🦁', frase: 'Sus inventos son tan geniales como peligrosos.' },
    { nombre: 'Cazadora Valiente', casa: 'Gryffindor', emoji: '🦁', frase: 'Vuela mas rapido que nadie en su equipo.' },
    { nombre: 'Sonadora Excentrica', casa: 'Ravenclaw', emoji: '🦅', frase: 'Cree en criaturas que nadie mas ha visto.' },
    { nombre: 'Campeon del Torneo', casa: 'Hufflepuff', emoji: '🦡', frase: 'Gano su lugar con honor y valentia.' },
    { nombre: 'Animago Misterioso', casa: 'Gryffindor', emoji: '🐺', frase: 'Puede transformarse en un imponente perro negro.' },
    { nombre: 'Profesor Lunar', casa: 'Gryffindor', emoji: '🌙', frase: 'Ensena Defensa aunque guarda un secreto.' },
    { nombre: 'Metamorfomaga Habil', casa: 'Hufflepuff', emoji: '🦡', frase: 'Cambia de apariencia con solo desearlo.' },
    { nombre: 'Guardian Leal', casa: 'Gryffindor', emoji: '🦁', frase: 'Siempre esta ahi cuando se le necesita.' }
  ],
  epica: [
    { nombre: 'Bruja Mas Brillante', casa: 'Gryffindor', emoji: '🦁', frase: 'La estudiante mas inteligente de su generacion.' },
    { nombre: 'Heredero Orgulloso', casa: 'Slytherin', emoji: '🐍', frase: 'Ambicioso, con un pasado complicado.' },
    { nombre: 'Maestro de Pociones', casa: 'Slytherin', emoji: '🐍', frase: 'Su lealtad se oculta hasta el final.' },
    { nombre: 'Subdirectora Firme', casa: 'Gryffindor', emoji: '🦁', frase: 'Protege la escuela con mano firme.' },
    { nombre: 'Guardabosques Gigante', casa: 'Staff', emoji: '🐉', frase: 'Tiene un corazon tan grande como el mismo.' },
    { nombre: 'Seguidora Fanatica', casa: 'Slytherin', emoji: '🐍', frase: 'Leal hasta la locura a su señor oscuro.' },
    { nombre: 'Campeona Veela', casa: 'Beauxbatons', emoji: '💫', frase: 'Trae consigo un encanto irresistible.' }
  ],
  legendaria: [
    { nombre: 'El Elegido', casa: 'Gryffindor', emoji: '⚡', frase: 'El niño que sobrevivio.' },
    { nombre: 'El Mago Mas Sabio', casa: 'Gryffindor', emoji: '🧙', frase: 'El mas poderoso y sabio de su tiempo.' },
    { nombre: 'El Innombrable', casa: 'Slytherin', emoji: '☠️', frase: 'Aquel que no debe ser nombrado.' },
    { nombre: 'El Alquimista Inmortal', casa: 'Alquimista', emoji: '💎', frase: 'Creador de la Piedra Filosofal.' }
  ]
};

const PROBABILIDADES = [
  { rareza: 'legendaria', peso: 3 },
  { rareza: 'epica', peso: 12 },
  { rareza: 'rara', peso: 25 },
  { rareza: 'comun', peso: 60 }
];

function elegirRareza() {
  const total = PROBABILIDADES.reduce((sum, p) => sum + p.peso, 0);
  let random = Math.random() * total;
  for (const p of PROBABILIDADES) {
    if (random < p.peso) return p.rareza;
    random -= p.peso;
  }
  return 'comun';
}

function tirarGacha() {
  const rareza = elegirRareza();
  const lista = PERSONAJES[rareza];
  const personaje = lista[Math.floor(Math.random() * lista.length)];
  return { ...personaje, rareza };
}

const EMOJI_RAREZA = {
  comun: '⚪',
  rara: '🔵',
  epica: '🟣',
  legendaria: '🟡'
};

function buscarPersonaje(nombre) {
  const buscado = String(nombre || '').trim().toLowerCase();
  for (const [rareza, lista] of Object.entries(PERSONAJES)) {
    const encontrado = lista.find(p => p.nombre.toLowerCase() === buscado);
    if (encontrado) return { ...encontrado, rareza };
  }
  return null;
}

module.exports = { tirarGacha, PERSONAJES, EMOJI_RAREZA, buscarPersonaje };
