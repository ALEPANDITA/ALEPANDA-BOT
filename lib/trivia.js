// Banco de preguntas de trivia y logica de comparacion de respuestas.

const PREGUNTAS = [
  { pregunta: '¿Cual es el planeta mas grande del sistema solar?', respuestas: ['jupiter'] },
  { pregunta: '¿En que continente esta Egipto?', respuestas: ['africa'] },
  { pregunta: '¿Cuantos lados tiene un hexagono?', respuestas: ['6', 'seis'] },
  { pregunta: '¿Cual es el idioma mas hablado del mundo como lengua nativa?', respuestas: ['chino', 'mandarin', 'chino mandarin'] },
  { pregunta: '¿Que gas respiran principalmente los humanos para vivir?', respuestas: ['oxigeno'] },
  { pregunta: '¿Cual es el rio mas largo del mundo?', respuestas: ['nilo', 'amazonas'] },
  { pregunta: '¿En que pais esta la Torre Eiffel?', respuestas: ['francia'] },
  { pregunta: '¿Cuantos huesos tiene el cuerpo humano adulto?', respuestas: ['206'] },
  { pregunta: '¿Cual es el animal terrestre mas rapido?', respuestas: ['guepardo', 'chita'] },
  { pregunta: '¿Que oceano es el mas grande del mundo?', respuestas: ['pacifico'] },
  { pregunta: '¿En que anio llego el hombre a la luna por primera vez?', respuestas: ['1969'] },
  { pregunta: '¿Cual es la capital de Japon?', respuestas: ['tokio', 'tokyo'] },
  { pregunta: '¿Cuantos jugadores tiene un equipo de futbol en cancha?', respuestas: ['11', 'once'] },
  { pregunta: '¿Que instrumento mide la temperatura?', respuestas: ['termometro'] },
  { pregunta: '¿Cual es el metal liquido a temperatura ambiente?', respuestas: ['mercurio'] },
  { pregunta: '¿En que pais se originó el anime?', respuestas: ['japon'] },
  { pregunta: '¿Cuantos colores tiene el arcoiris?', respuestas: ['7', 'siete'] },
  { pregunta: '¿Cual es el organo mas grande del cuerpo humano?', respuestas: ['piel'] },
  { pregunta: '¿Que animal es conocido como el rey de la selva?', respuestas: ['leon'] },
  { pregunta: '¿Cual es la moneda oficial de Japon?', respuestas: ['yen'] },
  { pregunta: '¿Cuantos continentes hay en el mundo?', respuestas: ['6', 'seis', '7', 'siete'] },
  { pregunta: '¿Que planeta es conocido como el planeta rojo?', respuestas: ['marte'] },
  { pregunta: '¿Cual es el pais mas grande del mundo por territorio?', respuestas: ['rusia'] },
  { pregunta: '¿Cuantas patas tiene una arania?', respuestas: ['8', 'ocho'] },
  { pregunta: '¿Que gas expulsan las plantas durante la fotosintesis?', respuestas: ['oxigeno'] },
  { pregunta: '¿Cual es el hueso mas largo del cuerpo humano?', respuestas: ['femur'] },
  { pregunta: '¿En que pais esta la Gran Muralla?', respuestas: ['china'] },
  { pregunta: '¿Cual es el numero de patas de un insecto?', respuestas: ['6', 'seis'] },
  { pregunta: '¿Que fruta es amarilla y curva?', respuestas: ['platano', 'banana'] },
  { pregunta: '¿Cuantos dias tiene un anio bisiesto?', respuestas: ['366'] }
];

function normalizar(texto = '') {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function preguntaAleatoria() {
  return PREGUNTAS[Math.floor(Math.random() * PREGUNTAS.length)];
}

function esRespuestaCorrecta(pregunta, intento) {
  const normalizado = normalizar(intento);
  return pregunta.respuestas.some((r) => normalizar(r) === normalizado);
}

module.exports = { PREGUNTAS, normalizar, preguntaAleatoria, esRespuestaCorrecta };
