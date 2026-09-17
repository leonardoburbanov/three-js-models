/**
 * Six beginner robotics lessons grounded in Reachy Mini and Microduck.
 * Angles in lesson configs are degrees; the UI converts to radians for the API.
 */

/** @typedef {{ id: string, label: string, min: number, max: number, step?: number }} SliderDef */

/**
 * @typedef {object} Lesson
 * @property {string} id
 * @property {string} title
 * @property {string} robot 'reachy' | 'microduck' | 'both'
 * @property {string} body HTML-safe plain text paragraphs (use \n\n)
 * @property {string} notesPath
 * @property {SliderDef[]} [sliders]
 * @property {{ id: string, label: string, joints: Record<string, number> }[]} [presets] joint angles in degrees
 * @property {{ jointId: string, targetDeg: number, toleranceDeg: number, hint: string } | null} [challenge]
 * @property {string[]} [highlightNames] substring match on mesh/node names
 * @property {boolean} [showGait]
 * @property {boolean} [tinyHeadLook]
 */

/** @type {Lesson[]} */
export const LESSONS = [
  {
    id: "01-links-joints",
    title: "1. Parts, links, and joints",
    robot: "both",
    notesPath: "/notes/01-links-joints.md",
    body: `A robot is a chain of rigid bodies called links, connected by joints.

Hover a part in the scene. The inspector shows the part name, which robot it belongs to, and its parent joint.

• Link — a rigid piece (shell, servo housing, foot).
• Joint — the allowed motion between links (usually a revolute hinge here).
• DOF — degrees of freedom: how many independent joint angles the robot has.

Reachy Mini and Microduck are different mechanisms, but both are built from named links in a CAD/URDF tree.`,
    challenge: null
  },
  {
    id: "02-revolute",
    title: "2. One revolute joint",
    robot: "reachy",
    notesPath: "/notes/02-revolute.md",
    body: `A revolute joint rotates around a fixed axis — like a hinge.

Drag the slider to yaw Reachy Mini’s body. The whole upper body turns on the base joint (yaw_body → body_down).

Angle is shown in degrees. Inside the app we convert to radians (π rad = 180°).

Try the antennas too: each is its own revolute DOF.`,
    sliders: [
      { id: "bodyYaw", label: "Body yaw", min: -40, max: 40, step: 1 },
      { id: "leftAntenna", label: "Left antenna", min: -60, max: 60, step: 1 },
      { id: "rightAntenna", label: "Right antenna", min: -60, max: 60, step: 1 }
    ],
    challenge: null
  },
  {
    id: "03-serial-fk",
    title: "3. Serial chain & forward kinematics",
    robot: "microduck",
    notesPath: "/notes/03-serial-fk.md",
    body: `Microduck’s leg is a serial chain: each joint’s motion moves everything below it.

Order (hip → foot): hip roll → hip pitch → knee → ankle.

Forward kinematics (FK): given joint angles, compute where the foot ends up. You are doing FK by hand with these sliders.

Challenge: set the left knee to about 35°. Next unlocks when you are within 5°.`,
    sliders: [
      { id: "leftHipRoll", label: "Left hip roll", min: -25, max: 25, step: 1 },
      { id: "leftHipPitch", label: "Left hip pitch", min: -45, max: 45, step: 1 },
      { id: "leftKnee", label: "Left knee", min: 0, max: 80, step: 1 },
      { id: "leftAnkle", label: "Left ankle", min: -40, max: 40, step: 1 }
    ],
    challenge: {
      jointId: "leftKnee",
      targetDeg: 35,
      toleranceDeg: 5,
      hint: "Move Left knee near 35°"
    }
  },
  {
    id: "04-parallel",
    title: "4. Parallel mechanisms (Stewart neck)",
    robot: "reachy",
    notesPath: "/notes/04-parallel.md",
    body: `Reachy Mini’s neck is a Stewart platform: six legs (rods) support the head in parallel.

In a serial chain, one joint failure or one wrong angle cascades. In a parallel mechanism, several actuators share the load and constrain the same end-effector (the head).

Highlighted: Stewart rods. We only nudge the head a few degrees — freely spinning the head without solving the rods would pull the mechanism apart. Real Reachy software uses IK/CCD for full head poses.`,
    highlightNames: ["stewart_link_rod", "stewart_link"],
    tinyHeadLook: true,
    sliders: [
      { id: "head", label: "Head look (tiny)", min: -8, max: 8, step: 0.5 }
    ],
    challenge: null
  },
  {
    id: "05-configuration",
    title: "5. Configuration space",
    robot: "microduck",
    notesPath: "/notes/05-configuration.md",
    body: `A configuration is the full list of joint angles. That vector lives in configuration space (C-space).

Presets snap Microduck to named poses. Watch the joint readouts — each pose is just a point in C-space.

Joint limits bound the legal region (you cannot fold a servo past its stop).`,
    sliders: [
      { id: "leftHipPitch", label: "L hip pitch", min: -45, max: 45, step: 1 },
      { id: "leftKnee", label: "L knee", min: 0, max: 80, step: 1 },
      { id: "rightHipPitch", label: "R hip pitch", min: -45, max: 45, step: 1 },
      { id: "rightKnee", label: "R knee", min: 0, max: 80, step: 1 },
      { id: "neckPitch", label: "Neck pitch", min: -20, max: 30, step: 1 },
      { id: "beak", label: "Beak", min: 0, max: 35, step: 1 }
    ],
    presets: [
      {
        id: "stand",
        label: "Stand",
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
        label: "Crouch",
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
        label: "Look up",
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
    title: "6. Gait basics",
    robot: "microduck",
    notesPath: "/notes/06-gait.md",
    body: `Walking is coordinated joint trajectories over time — a gait.

Microduck’s demo uses a kinematic walk cycle: left and right legs are phase-shifted by π (half cycle). While one leg swings, the other supports (stance).

Phase readout: ωt for the left leg. This is not the onboard RL policy — it is a teaching approximation of stance/swing timing.`,
    showGait: true,
    challenge: null
  }
];
