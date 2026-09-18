/**
 * Six beginner robotics lessons grounded in Reachy Mini and Microduck.
 * Angles in lesson configs are degrees; the UI converts to radians for the API.
 * Titles/bodies/labels are bilingual via b(en, es); resolve with tx() at render time.
 */

import { b } from "../i18n.js";

/** @typedef {{ id: string, label: import("../i18n.js").Bilingual, min: number, max: number, step?: number }} SliderDef */

/**
 * @typedef {object} Lesson
 * @property {string} id
 * @property {import("../i18n.js").Bilingual} title
 * @property {string} robot 'reachy' | 'microduck' | 'both'
 * @property {import("../i18n.js").Bilingual} body
 * @property {string} notesPath
 * @property {SliderDef[]} [sliders]
 * @property {{ id: string, label: import("../i18n.js").Bilingual, joints: Record<string, number> }[]} [presets]
 * @property {{ jointId: string, targetDeg: number, toleranceDeg: number, hint: import("../i18n.js").Bilingual } | null} [challenge]
 * @property {string[]} [highlightNames]
 * @property {boolean} [showGait]
 * @property {boolean} [tinyHeadLook]
 */

/** @type {Lesson[]} */
export const LESSONS = [
  {
    id: "01-links-joints",
    title: b("1. Parts, links, and joints", "1. Piezas, eslabones y juntas"),
    robot: "both",
    notesPath: "/notes/01-links-joints.md",
    body: b(
      `A robot is a chain of rigid bodies called links, connected by joints.

Hover a part in the scene. The inspector shows the part name, which robot it belongs to, and its parent joint.

• Link — a rigid piece (shell, servo housing, foot).
• Joint — the allowed motion between links (usually a revolute hinge here).
• DOF — degrees of freedom: how many independent joint angles the robot has.

Reachy Mini and Microduck are different mechanisms, but both are built from named links in a CAD/URDF tree.`,
      `Un robot es una cadena de cuerpos rígidos llamados eslabones (links), unidos por juntas.

Pasa el cursor sobre una pieza. El inspector muestra el nombre, a qué robot pertenece y su junta padre.

• Eslabón (link) — una pieza rígida (carcasa, servo, pie).
• Junta (joint) — el movimiento permitido entre eslabones (aquí suele ser una revoluta).
• GDL (DOF) — grados de libertad: cuántos ángulos independientes tiene el robot.

Reachy Mini y Microduck son mecanismos distintos, pero ambos se arman con eslabones nombrados en un árbol CAD/URDF.`
    ),
    challenge: null
  },
  {
    id: "02-revolute",
    title: b("2. One revolute joint", "2. Una junta revoluta"),
    robot: "reachy",
    notesPath: "/notes/02-revolute.md",
    body: b(
      `A revolute joint rotates around a fixed axis — like a hinge.

Drag the slider to yaw Reachy Mini’s body. The whole upper body turns on the base joint (yaw_body → body_down).

Angle is shown in degrees. Inside the app we convert to radians (π rad = 180°).

Try the antennas too: each is its own revolute DOF.`,
      `Una junta revoluta gira alrededor de un eje fijo — como una bisagra.

Mueve el deslizador para rotar el cuerpo de Reachy Mini (yaw). Todo el torso gira sobre la junta de la base (yaw_body → body_down).

El ángulo se muestra en grados. Dentro de la app lo convertimos a radianes (π rad = 180°).

Prueba también las antenas: cada una es su propio GDL revoluto.`
    ),
    sliders: [
      { id: "bodyYaw", label: b("Body yaw", "Yaw del cuerpo"), min: -40, max: 40, step: 1 },
      { id: "leftAntenna", label: b("Left antenna", "Antena izquierda"), min: -60, max: 60, step: 1 },
      { id: "rightAntenna", label: b("Right antenna", "Antena derecha"), min: -60, max: 60, step: 1 }
    ],
    challenge: null
  },
  {
    id: "03-serial-fk",
    title: b("3. Serial chain & forward kinematics", "3. Cadena serial y cinemática directa"),
    robot: "microduck",
    notesPath: "/notes/03-serial-fk.md",
    body: b(
      `Microduck’s leg is a serial chain: each joint’s motion moves everything below it.

Order (hip → foot): hip roll → hip pitch → knee → ankle.

Forward kinematics (FK): given joint angles, compute where the foot ends up. You are doing FK by hand with these sliders.

Challenge: set the left knee to about 35°. Next unlocks when you are within 5°.`,
      `La pierna de Microduck es una cadena serial: cada junta mueve todo lo que cuelga debajo.

Orden (cadera → pie): roll de cadera → pitch de cadera → rodilla → tobillo.

Cinemática directa (FK): dados los ángulos, calcular dónde queda el pie. Eso es lo que haces a mano con estos deslizadores.

Reto: deja la rodilla izquierda cerca de 35°. Siguiente se desbloquea si estás a ±5°.`
    ),
    sliders: [
      { id: "leftHipRoll", label: b("Left hip roll", "Roll cadera izq."), min: -25, max: 25, step: 1 },
      { id: "leftHipPitch", label: b("Left hip pitch", "Pitch cadera izq."), min: -45, max: 45, step: 1 },
      { id: "leftKnee", label: b("Left knee", "Rodilla izquierda"), min: 0, max: 80, step: 1 },
      { id: "leftAnkle", label: b("Left ankle", "Tobillo izquierdo"), min: -40, max: 40, step: 1 }
    ],
    challenge: {
      jointId: "leftKnee",
      targetDeg: 35,
      toleranceDeg: 5,
      hint: b("Move Left knee near 35°", "Lleva la rodilla izquierda cerca de 35°")
    }
  },
  {
    id: "04-parallel",
    title: b("4. Parallel mechanisms (Stewart neck)", "4. Mecanismos paralelos (cuello Stewart)"),
    robot: "reachy",
    notesPath: "/notes/04-parallel.md",
    body: b(
      `Reachy Mini’s neck is a Stewart platform: six legs (rods) support the head in parallel.

In a serial chain, one joint failure or one wrong angle cascades. In a parallel mechanism, several actuators share the load and constrain the same end-effector (the head).

Highlighted: Stewart rods. We only nudge the head a few degrees — freely spinning the head without solving the rods would pull the mechanism apart. Real Reachy software uses IK/CCD for full head poses.`,
      `El cuello de Reachy Mini es una plataforma Stewart: seis varillas sostienen la cabeza en paralelo.

En una cadena serial, un fallo o un ángulo malo se propaga. En un mecanismo paralelo, varios actuadores comparten la carga y restringen el mismo efector (la cabeza).

Resaltado: varillas Stewart. Solo movemos la cabeza unos pocos grados — girarla libremente sin resolver las varillas rompería el mecanismo. El software real de Reachy usa IK/CCD para poses completas.`
    ),
    highlightNames: ["stewart_link_rod", "stewart_link"],
    tinyHeadLook: true,
    sliders: [
      { id: "head", label: b("Head look (tiny)", "Mirada (pequeña)"), min: -8, max: 8, step: 0.5 }
    ],
    challenge: null
  },
  {
    id: "05-configuration",
    title: b("5. Configuration space", "5. Espacio de configuración"),
    robot: "microduck",
    notesPath: "/notes/05-configuration.md",
    body: b(
      `A configuration is the full list of joint angles. That vector lives in configuration space (C-space).

Presets snap Microduck to named poses. Watch the joint readouts — each pose is just a point in C-space.

Joint limits bound the legal region (you cannot fold a servo past its stop).`,
      `Una configuración es la lista completa de ángulos de junta. Ese vector vive en el espacio de configuración (C-space).

Los presets colocan a Microduck en poses con nombre. Mira los valores — cada pose es un punto en C-space.

Los límites de junta acotan la región legal (un servo no puede pasar de su tope).`
    ),
    sliders: [
      { id: "leftHipPitch", label: b("L hip pitch", "Pitch cadera I"), min: -45, max: 45, step: 1 },
      { id: "leftKnee", label: b("L knee", "Rodilla I"), min: 0, max: 80, step: 1 },
      { id: "rightHipPitch", label: b("R hip pitch", "Pitch cadera D"), min: -45, max: 45, step: 1 },
      { id: "rightKnee", label: b("R knee", "Rodilla D"), min: 0, max: 80, step: 1 },
      { id: "neckPitch", label: b("Neck pitch", "Pitch cuello"), min: -20, max: 30, step: 1 },
      { id: "beak", label: b("Beak", "Pico"), min: 0, max: 35, step: 1 }
    ],
    presets: [
      {
        id: "stand",
        label: b("Stand", "De pie"),
        joints: {
          leftHipPitch: 8,
          leftKnee: 15,
          rightHipPitch: 8,
          rightKnee: 15,
          neckPitch: 0,
          beak: 8
        }
      },
      {
        id: "crouch",
        label: b("Crouch", "Agachado"),
        joints: {
          leftHipPitch: 25,
          leftKnee: 55,
          rightHipPitch: 25,
          rightKnee: 55,
          neckPitch: 10,
          beak: 5
        }
      },
      {
        id: "look",
        label: b("Look up", "Mirar arriba"),
        joints: {
          leftHipPitch: 8,
          leftKnee: 15,
          rightHipPitch: 8,
          rightKnee: 15,
          neckPitch: 22,
          beak: 12
        }
      }
    ],
    challenge: null
  },
  {
    id: "06-gait",
    title: b("6. Gait basics", "6. Marcha básica"),
    robot: "microduck",
    notesPath: "/notes/06-gait.md",
    body: b(
      `Walking is coordinated joint trajectories over time — a gait.

Microduck’s demo uses a kinematic walk cycle: left and right legs are phase-shifted by π (half cycle). While one leg swings, the other supports (stance).

Phase readout: ωt for the left leg. This is not the onboard RL policy — it is a teaching approximation of stance/swing timing.`,
      `Caminar son trayectorias de juntas coordinadas en el tiempo — una marcha (gait).

La demo de Microduck usa un ciclo cinemático: las piernas van desfasadas π (medio ciclo). Mientras una balancea, la otra apoya (stance).

Lectura de fase: ωt de la pierna izquierda. No es la política RL del robot — es una aproximación didáctica de stance/swing.`
    ),
    showGait: true,
    challenge: null
  }
];
