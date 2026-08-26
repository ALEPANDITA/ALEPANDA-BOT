// lib/vorContenido.js
// Banco de preguntas (verdades) y retos para el comando .vor (Verdad o Reto).
// Separado en su propio archivo a proposito, para que sea facil agregar,
// quitar o editar contenido sin tocar la logica del juego.
//
// Cada item tiene un "id" fijo (no lo cambies una vez que ya este en uso,
// o el sistema de "no repetir" para esa persona ya no lo reconocera bien).
//
// Sobre la categoria "picante": aqui va contenido atrevido/con doble sentido,
// pero NO explicito. Si quieres subirle el tono a algo mas fuerte, agrega tus
// propios items directo en los arreglos PICANTE_* de aqui abajo, siguiendo el
// mismo formato { id, texto }.

const VERDAD_NORMAL = [
  { id: 'vn1', texto: '¿Cual es la mentira mas grande que le has dicho a un profesor o jefe?' },
  { id: 'vn2', texto: '¿A quien del grupo stalkeaste mas en redes sociales?' },
  { id: 'vn3', texto: '¿Cual es tu ex mas vergonzoso?' },
  { id: 'vn4', texto: '¿Que es lo mas raro que has buscado en internet?' },
  { id: 'vn5', texto: '¿Alguna vez te hiciste el enfermo para no ir a algo?' },
  { id: 'vn6', texto: '¿Cual es el apodo mas vergonzoso que te han puesto?' },
  { id: 'vn7', texto: '¿Que app tienes mas tiempo usada hoy y por cuanto tiempo?' },
  { id: 'vn8', texto: '¿Cual es la nota mas baja que has sacado en tu vida?' },
  { id: 'vn9', texto: '¿A quien de este grupo le copiarias la tarea sin dudarlo?' },
  { id: 'vn10', texto: '¿Cual es tu mayor miedo irracional?' },
  { id: 'vn11', texto: '¿Alguna vez leiste el chat privado de alguien sin permiso?' },
  { id: 'vn12', texto: '¿Cual es la cancion que escuchas a escondidas porque te da pena que sepan que te gusta?' },
  { id: 'vn13', texto: '¿Cuanto tiempo llevas sin bañarte en tu record personal?' },
  { id: 'vn14', texto: '¿Le has revisado el celular a tu pareja o ex alguna vez?' },
  { id: 'vn15', texto: '¿Cual es tu comida favorita que casi nadie sabe que te gusta?' }
];

const RETO_NORMAL = [
  { id: 'rn1', texto: 'Manda el ultimo meme que guardaste en tu galeria.' },
  { id: 'rn2', texto: 'Manda un audio cantando la primera cancion que salga en tu playlist.' },
  { id: 'rn3', texto: 'Cambia tu foto de perfil por 10 minutos a algo que elija el grupo.' },
  { id: 'rn4', texto: 'Escribe tu proximo mensaje solo con emojis por los siguientes 5 minutos.' },
  { id: 'rn5', texto: 'Manda una foto de como estas vestido ahorita mismo.' },
  { id: 'rn6', texto: 'Dile a la persona de arriba en el chat algo que admires de ella.' },
  { id: 'rn7', texto: 'Manda un audio imitando a algun animal por 10 segundos.' },
  { id: 'rn8', texto: 'Cuenta hasta 20 en el idioma que menos domines.' },
  { id: 'rn9', texto: 'Manda el ultimo video que grabaste (sin borrar nada antes).' },
  { id: 'rn10', texto: 'Escribe un poema corto sobre el grupo, ahorita, en el chat.' },
  { id: 'rn11', texto: 'Manda tu ultima foto tomada, sea la que sea.' },
  { id: 'rn12', texto: 'Habla como robot en tus proximos 3 mensajes en el grupo.' }
];

// Atrevido/con doble sentido, pero sin llegar a explicito.
const VERDAD_PICANTE = [
  { id: 'vp1', texto: '¿Cual ha sido tu cita mas incomoda?' },
  { id: 'vp2', texto: '¿Le has mandado un mensaje de mas a la persona equivocada?' },
  { id: 'vp3', texto: '¿Cual es el piropo mas malo que te han dicho?' },
  { id: 'vp4', texto: '¿A quien de este grupo le coquetearias si estuvieras soltero/a?' },
  { id: 'vp5', texto: '¿Cual es tu tipo ideal, en una sola frase?' },
  { id: 'vp6', texto: '¿Alguna vez te "stalkeaste" a un ex despues de terminar?' },
  { id: 'vp7', texto: '¿Que fue lo mas atrevido que has hecho por alguien que te gustaba?' }
];

// Placeholder intencional: NO se incluyen retos explicitos de fabrica. Si
// quieres agregar contenido +18 mas fuerte, hazlo aqui con el mismo formato:
// { id: 'rp_tuyo1', texto: 'Tu reto aqui' }
const RETO_PICANTE = [
  { id: 'rp1', texto: 'Manda la ultima foto en la que sales mas guapo/a segun tu.' },
  { id: 'rp2', texto: 'Describe a tu crush actual sin decir el nombre, a ver si adivinan.' },
  { id: 'rp3', texto: 'Manda un audio diciendo un piropo a la persona que elija el grupo.' }
];

module.exports = {
  VERDAD_NORMAL,
  RETO_NORMAL,
  VERDAD_PICANTE,
  RETO_PICANTE
};
