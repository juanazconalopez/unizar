import type { Season, TacticsBoardData, TacticsElement, TacticsElementType, TrainingPlanValues } from '../../types'

export function preseasonTrainingPlanValues(seasons: Season[]): TrainingPlanValues[] {
  const dates = ['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10']
  const seasonFor = (date: string) => seasons.find((season) => season.start_date <= date && season.end_date >= date)?.id ?? seasons[0]?.id ?? ''

  return [
    {
      seasonId: seasonFor(dates[0]), sessionDate: dates[0], status: 'draft',
      title: 'Pretemporada 01 · Volver a correr jugando',
      objectives: 'Recuperar ritmo de carrera, comunicación y manejo de balón mediante juegos competitivos sin contacto.',
      material: '20 conos, petos y balones suficientes para trabajar en grupos pequeños.',
      exercises: [
        exercise('Pilla-pilla por colores', 15, 'Todo el grupo dentro del cuadrado. Dos cazadoras con peto intentan tocar a una corredora; al ser tocada, recoge un cono del color indicado y vuelve corriendo. Cambiar cazadoras cada 60 segundos.', board('half', [
          zone('z1', 250, 145), cone('c1', 250, 145), cone('c2', 410, 145), cone('c3', 250, 225), cone('c4', 410, 225),
          player('p1', 300, 185, '1'), player('p2', 365, 190, '2'), opponent('o1', 330, 245, 'C'), run('r1', 335, 245, -65),
        ])),
        exercise('Relevos de pase y apoyo', 20, 'Carriles de cuatro. La portadora corre 15 m, pasa antes de la puerta de conos y continúa por detrás para volver a apoyar. Puntúa el primer equipo que completa seis idas sin caída.', board('full', [
          cone('c1', 220, 145), cone('c2', 220, 355), cone('c3', 660, 145), cone('c4', 660, 355),
          player('p1', 280, 210, '1'), player('p2', 390, 260, '2'), player('p3', 500, 310, '3'), pass('pa1', 300, 220, 22), pass('pa2', 410, 270, 22), run('r1', 520, 310, 0),
        ])),
        exercise('Laberinto de evasión', 25, 'Dos equipos cruzan un laberinto de puertas. Cada jugadora elige una puerta distinta y debe llegar a la zona final sin que una defensora le toque con dos manos. Tras cada carrera cambian los roles.', board('half', [
          cone('c1', 300, 130), cone('c2', 300, 200), cone('c3', 430, 210), cone('c4', 430, 280), cone('c5', 560, 130), cone('c6', 560, 200),
          player('p1', 220, 255, 'A'), opponent('o1', 380, 245, 'D'), run('r1', 240, 250, -18), run('r2', 455, 255, -28), zone('z1', 650, 200),
        ])),
        exercise('Touch a las cuatro esquinas', 30, 'Partido 6 contra 6. Se marca apoyando en cualquiera de las cuatro esquinas. Tras toque a dos manos hay pase inmediato y la defensa retrocede tres metros. Cambiar rival cada 6 minutos; últimos 5 minutos para trotar y movilidad.', board('full', [
          zone('z1', 45, 45), zone('z2', 695, 45), zone('z3', 45, 375), zone('z4', 695, 375),
          player('p1', 330, 200, '1'), player('p2', 270, 300, '2'), player('p3', 390, 320, '3'), opponent('o1', 500, 190, '1'), opponent('o2', 510, 290, '2'),
          pass('pa1', 350, 210, 36), run('r1', 410, 315, -35),
        ])),
      ],
    },
    {
      seasonId: seasonFor(dates[1]), sessionDate: dates[1], status: 'draft',
      title: 'Pretemporada 02 · Velocidad, persecución y apoyo',
      objectives: 'Acumular carreras rápidas cortas y aprender a mantener apoyos útiles sin introducir contacto intenso.',
      material: 'Conos para puertas y carriles, petos y un balón por pareja.',
      exercises: [
        exercise('Semáforo rugby', 15, 'Todas se desplazan con balón por el campo: verde acelera, amarillo cambia dirección, rojo deja el balón y busca otro. Añadir señales de pase y persecución.', board('half', [
          player('p1', 270, 180, '1'), player('p2', 370, 260, '2'), player('p3', 500, 180, '3'), ball('b1', 305, 180), ball('b2', 405, 260), run('r1', 290, 180, 5), run('r2', 390, 260, -25), text('t1', 360, 100, 'VERDE = CORRER'),
        ])),
        exercise('Cazadoras por parejas', 20, 'Parejas separadas dos metros. A la señal, la primera elige una puerta y la perseguidora intenta tocarla antes de cruzarla. Distancias de 15–25 m; alternar cinco salidas por lado.', board('half', [
          player('p1', 250, 260, 'A'), opponent('o1', 210, 260, 'C'), cone('c1', 600, 120), cone('c2', 600, 190), cone('c3', 600, 330), cone('c4', 600, 400), run('r1', 275, 250, -20), run('r2', 275, 270, 20),
        ])),
        exercise('Olas de apoyo 3 contra 1', 25, 'Tres atacantes salen en oleadas de 35 m contra una defensora que solo puede interceptar o tocar. Al terminar, vuelven trotando por fuera y cambian defensora.', board('half', [
          player('p1', 220, 170, '1'), player('p2', 220, 260, '2'), player('p3', 220, 350, '3'), opponent('o1', 470, 260, 'D'),
          run('r1', 245, 170, 0), run('r2', 245, 350, 0), pass('pa1', 250, 245, -18), zone('z1', 650, 205),
        ])),
        exercise('Ultimate rugby continuo', 30, 'Partido sin contacto. No se puede correr con el balón más de tres pasos; se avanza pasando hacia cualquier dirección y se marca recibiendo en zona. Tras pérdida, cambio inmediato de rol. Últimos 5 minutos de vuelta a la calma.', board('full', [
          zone('z1', 30, 150), zone('z2', 710, 150), player('p1', 300, 180, '1'), player('p2', 360, 320, '2'), player('p3', 440, 220, '3'),
          opponent('o1', 500, 160, '1'), opponent('o2', 520, 310, '2'), pass('pa1', 330, 185, 35), pass('pa2', 450, 225, -28), run('r1', 380, 325, -25),
        ])),
      ],
    },
    {
      seasonId: seasonFor(dates[2]), sessionDate: dates[2], status: 'draft',
      title: 'Pretemporada 03 · Defender corriendo y contraatacar',
      objectives: 'Trabajar conexión defensiva, reacción y transición a ataque mediante juegos de alta movilidad y contacto mínimo.',
      material: 'Conos, petos o cintas y balones para las transiciones.',
      exercises: [
        exercise('Espejos por calles', 15, 'Parejas frente a frente en una calle. Una lidera con desplazamientos laterales y aceleraciones de cinco metros; la otra imita. Bloques de 25 segundos con 20 de recuperación.', board('half', [
          cone('c1', 250, 160), cone('c2', 250, 350), cone('c3', 600, 160), cone('c4', 600, 350), player('p1', 370, 220, 'A'), opponent('o1', 460, 220, 'D'), defense('d1', 450, 250, 90), run('r1', 380, 250, 90),
        ])),
        exercise('Cerrar puertas', 20, 'Cuatro defensoras protegen tres puertas. La entrenadora señala una puerta y el ataque trata de cruzarla; la defensa suma punto si llega conectada antes. Sin choque: basta tocar cono y jugadora.', board('half', [
          cone('c1', 610, 130), cone('c2', 610, 190), cone('c3', 610, 245), cone('c4', 610, 305), cone('c5', 610, 360),
          player('p1', 250, 160, '1'), player('p2', 250, 260, '2'), player('p3', 250, 360, '3'), opponent('o1', 430, 150, '1'), opponent('o2', 430, 250, '2'), opponent('o3', 430, 350, '3'), defense('d1', 455, 150, 0), defense('d2', 455, 350, 0),
        ])),
        exercise('Transición 4 contra 3', 25, 'Cuatro atacan una zona contra tres. Cuando hay toque, caída o interceptación, la entrenadora lanza un segundo balón hacia el sentido contrario y todas cambian de rol corriendo.', board('full', [
          player('p1', 300, 150, '1'), player('p2', 300, 230, '2'), player('p3', 300, 310, '3'), player('p4', 300, 390, '4'),
          opponent('o1', 470, 190, '1'), opponent('o2', 470, 270, '2'), opponent('o3', 470, 350, '3'), ball('b1', 550, 90), run('r1', 490, 190, -145), run('r2', 490, 350, 145),
        ])),
        exercise('Conquista de territorios', 30, 'Campo dividido en tres franjas. Un equipo suma un punto por completar tres pases en una franja y otro por avanzar a la siguiente. Touch a dos manos y repliegue inmediato de cinco metros. Últimos 5 minutos suaves.', board('full', [
          zone('z1', 55, 90), zone('z2', 360, 90), zone('z3', 665, 90), text('t1', 95, 55, '1'), text('t2', 400, 55, '2'), text('t3', 705, 55, '3'),
          player('p1', 250, 210, '1'), player('p2', 310, 330, '2'), opponent('o1', 480, 210, '1'), opponent('o2', 530, 330, '2'), run('r1', 330, 325, -15),
        ])),
      ],
    },
    {
      seasonId: seasonFor(dates[3]), sessionDate: dates[3], status: 'draft',
      title: 'Pretemporada 04 · Festival de juegos con balón',
      objectives: 'Cerrar las dos primeras semanas con una sesión divertida, competitiva y de gran volumen de carrera.',
      material: 'Conos de colores, petos y al menos cuatro balones.',
      exercises: [
        exercise('Roba-conos', 15, 'Cuatro equipos en las esquinas. A la señal sale una jugadora por equipo, roba un cono del centro o de otra base y vuelve. Solo se puede transportar uno cada vez.', board('half', [
          zone('z1', 80, 55), zone('z2', 650, 55), zone('z3', 80, 350), zone('z4', 650, 350),
          cone('c1', 410, 220), cone('c2', 440, 250), cone('c3', 410, 280), player('p1', 180, 130, '1'), player('p2', 690, 130, '2'), run('r1', 200, 135, 20), run('r2', 690, 150, 160),
        ])),
        exercise('Caos de balones', 20, 'Tres equipos y cuatro balones. Para puntuar hay que recibir en una de las zonas exteriores. Al marcar, el balón queda allí y se busca inmediatamente otro. No hay contacto.', board('full', [
          zone('z1', 40, 70), zone('z2', 700, 70), zone('z3', 40, 355), zone('z4', 700, 355), ball('b1', 410, 150), ball('b2', 510, 260), ball('b3', 380, 360),
          player('p1', 280, 180, '1'), player('p2', 300, 320, '2'), opponent('o1', 580, 180, '1'), opponent('o2', 590, 330, '2'), pass('pa1', 320, 180, 25), run('r1', 325, 320, -25),
        ])),
        exercise('Touch continuo con dos balones', 25, 'Partido con dos balones activos. Se marca en zona de ensayo; después de un touch a dos manos se pasa en menos de dos segundos. Si ambos balones coinciden en la misma mitad, uno debe cambiar de lado.', board('full', [
          zone('z1', 25, 120), zone('z2', 715, 120), ball('b1', 390, 160), ball('b2', 500, 350),
          player('p1', 300, 140, '1'), player('p2', 300, 360, '2'), player('p3', 420, 260, '3'), opponent('o1', 550, 150, '1'), opponent('o2', 580, 350, '2'), pass('pa1', 320, 150, 10), pass('pa2', 500, 350, 165),
        ])),
        exercise('Mini torneo: marcar y salir', 30, 'Partidos de cuatro minutos en campos reducidos. Quien marca sale y entra el equipo que espera, obligando a recolocarse rápido. Touch a dos manos, cinco posesiones máximas. Reservar los últimos 5 minutos para vuelta a la calma conjunta.', board('half', [
          zone('z1', 40, 145), zone('z2', 705, 145), player('p1', 290, 180, '1'), player('p2', 290, 320, '2'), opponent('o1', 520, 180, '1'), opponent('o2', 520, 320, '2'),
          run('r1', 310, 175, 8), run('r2', 310, 325, -8), pass('pa1', 340, 190, 35), text('t1', 365, 70, '4 MIN · CAMBIO RÁPIDO'),
        ])),
      ],
    },
  ]
}

function exercise(title: string, durationMinutes: number, description: string, diagramData: TacticsBoardData) {
  return { title, durationMinutes, description, diagramData }
}

function board(template: TacticsBoardData['template'], elements: TacticsElement[]): TacticsBoardData {
  return { version: 1, template, elements }
}

function element(id: string, type: TacticsElementType, x: number, y: number, rotation?: number, label?: string): TacticsElement {
  return { id, type, x, y, ...(rotation === undefined ? {} : { rotation }), ...(label ? { label } : {}) }
}

const player = (id: string, x: number, y: number, label: string) => element(id, 'player', x, y, 0, label)
const opponent = (id: string, x: number, y: number, label: string) => element(id, 'opponent', x, y, 0, label)
const cone = (id: string, x: number, y: number) => element(id, 'cone', x, y)
const ball = (id: string, x: number, y: number) => element(id, 'ball', x, y)
const run = (id: string, x: number, y: number, rotation: number) => element(id, 'run', x, y, rotation)
const pass = (id: string, x: number, y: number, rotation: number) => element(id, 'pass', x, y, rotation)
const defense = (id: string, x: number, y: number, rotation: number) => element(id, 'defense', x, y, rotation)
const zone = (id: string, x: number, y: number) => element(id, 'zone', x, y)
const text = (id: string, x: number, y: number, label: string) => element(id, 'text', x, y, 0, label)
