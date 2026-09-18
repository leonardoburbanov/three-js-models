import * as THREE from "three";
import loadMujoco from "@mujoco/mujoco";
import wasmUrl from "@mujoco/mujoco/mujoco.wasm?url";

/** Tutorial UI id → MuJoCo actuator name. */
export const ACTUATOR_MAP = {
  bodyYaw: "yaw_body",
  leftAntenna: "left_antenna",
  rightAntenna: "right_antenna",
  leftHipYaw: "left_hip_yaw",
  leftHipRoll: "left_hip_roll",
  leftHipPitch: "left_hip_pitch",
  leftKnee: "left_knee",
  leftAnkle: "left_ankle",
  rightHipYaw: "right_hip_yaw",
  rightHipRoll: "right_hip_roll",
  rightHipPitch: "right_hip_pitch",
  rightKnee: "right_knee",
  rightAnkle: "right_ankle",
  neck: "neck_pitch",
  neckPitch: "head_pitch",
  head: "head_yaw",
  beak: "head_roll"
};

/** Rotation that maps MuJoCo Z-up frames into Three.js Y-up. */
const Z_UP_TO_Y_UP = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2
);

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _world = new THREE.Matrix4();
const _parentInv = new THREE.Matrix4();
const _local = new THREE.Matrix4();

/**
 * One MuJoCo model paired with a CAD GLB subtree.
 */
class RobotSim {
  /**
   * @param {any} mujoco
   * @param {any} model
   * @param {any} data
   * @param {THREE.Object3D} glbRoot
   * @param {THREE.Vector3} originYUp scene offset for this robot
   * @param {number} standKey keyframe index or -1
   */
  constructor(mujoco, model, data, glbRoot, originYUp, standKey) {
    this.mujoco = mujoco;
    this.model = model;
    this.data = data;
    this.glbRoot = glbRoot;
    this.originYUp = originYUp;
    this.standKey = standKey;
    /** @type {Map<number, THREE.Object3D>} */
    this.bodyNodes = new Map();
    /** @type {Map<string, number>} */
    this.actuatorIndex = new Map();

    const byName = new Map();
    glbRoot.traverse((obj) => {
      if (obj.name) byName.set(obj.name, obj);
    });

    for (let bid = 1; bid < model.nbody; bid++) {
      const name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY.value, bid);
      if (!name) continue;
      const node = byName.get(name);
      if (node) this.bodyNodes.set(bid, node);
    }

    for (let aid = 0; aid < model.nu; aid++) {
      const name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_ACTUATOR.value, aid);
      if (name) this.actuatorIndex.set(name, aid);
    }
  }

  /** Reset to keyframe (or qpos0) and hold actuator targets. */
  reset() {
    const { mujoco, model, data, standKey } = this;
    if (standKey >= 0) {
      mujoco.mj_resetDataKeyframe(model, data, standKey);
    } else {
      mujoco.mj_resetData(model, data);
    }
    mujoco.mj_forward(model, data);
  }

  /**
   * Set a position-actuator target by official name.
   * @param {string} actuatorName
   * @param {number} value radians
   */
  setCtrl(actuatorName, value) {
    const idx = this.actuatorIndex.get(actuatorName);
    if (idx === undefined) return;
    this.data.ctrl[idx] = value;
  }

  /**
   * Read hinge joint angle (skips freejoint).
   * @param {string} jointName
   * @returns {number}
   */
  getJointAngle(jointName) {
    const { mujoco, model, data } = this;
    const jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT.value, jointName);
    if (jid < 0) return 0;
    const adr = model.jnt_qposadr[jid];
    return data.qpos[adr];
  }

  /**
   * Step simulation for ~1/60 s of simulated time.
   */
  stepFrame() {
    const { mujoco, model, data } = this;
    const start = data.time;
    while (data.time - start < 1 / 60) {
      mujoco.mj_step(model, data);
    }
  }

  /**
   * Copy MuJoCo body poses onto the GLB nodes (Z-up → Y-up, local to parent).
   */
  syncVisuals() {
    const { model, data, originYUp } = this;
    // Parents must be updated bottom-up; iterate by body id (parents first).
    for (const [bid, node] of this.bodyNodes) {
      const px = data.xpos[3 * bid];
      const py = data.xpos[3 * bid + 1];
      const pz = data.xpos[3 * bid + 2];
      // MuJoCo quat is wxyz
      const qw = data.xquat[4 * bid];
      const qx = data.xquat[4 * bid + 1];
      const qy = data.xquat[4 * bid + 2];
      const qz = data.xquat[4 * bid + 3];

      _pos.set(px, pz, -py).add(originYUp);
      _quat.set(qx, qy, qz, qw).premultiply(Z_UP_TO_Y_UP);
      _scale.set(1, 1, 1);
      _world.compose(_pos, _quat, _scale);

      const parent = node.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        _parentInv.copy(parent.matrixWorld).invert();
        _local.multiplyMatrices(_parentInv, _world);
        _local.decompose(node.position, node.quaternion, node.scale);
      } else {
        _world.decompose(node.position, node.quaternion, node.scale);
      }
    }
  }

  /** Free WASM handles. */
  dispose() {
    this.data.delete();
    this.model.delete();
    this.bodyNodes.clear();
  }
}

/**
 * Browser MuJoCo runtime driving Reachy Mini + Microduck CAD visuals.
 */
export class PhysicsWorld {
  constructor() {
    /** @type {any} */
    this.mujoco = null;
    /** @type {RobotSim | null} */
    this.reachy = null;
    /** @type {RobotSim | null} */
    this.duck = null;
    this.enabled = false;
  }

  /**
   * Load WASM + baked XML models once.
   * @param {{ reachyRoot: THREE.Object3D, duckRoot: THREE.Object3D, reachyOrigin: THREE.Vector3, duckOrigin: THREE.Vector3 }} roots
   */
  async init(roots) {
    this.mujoco = await loadMujoco({
      locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path)
    });

    const [reachyXml, duckXml] = await Promise.all([
      fetch("/physics/reachy_mini.xml").then((r) => r.text()),
      fetch("/physics/microduck.xml").then((r) => r.text())
    ]);

    const reachyModel = this.mujoco.MjModel.from_xml_string(reachyXml);
    const reachyData = new this.mujoco.MjData(reachyModel);
    this.reachy = new RobotSim(
      this.mujoco,
      reachyModel,
      reachyData,
      roots.reachyRoot,
      roots.reachyOrigin.clone(),
      -1
    );

    const duckModel = this.mujoco.MjModel.from_xml_string(duckXml);
    const duckData = new this.mujoco.MjData(duckModel);
    const standKey = this.mujoco.mj_name2id(
      duckModel,
      this.mujoco.mjtObj.mjOBJ_KEY.value,
      "STAND"
    );
    this.duck = new RobotSim(
      this.mujoco,
      duckModel,
      duckData,
      roots.duckRoot,
      roots.duckOrigin.clone(),
      standKey
    );
  }

  /**
   * Enable physics: reset poses and start stepping.
   */
  enable() {
    if (!this.reachy || !this.duck) return;
    this.reachy.reset();
    this.duck.reset();
    this.enabled = true;
    this.sync();
  }

  /** Disable physics (caller restores kinematic rest poses). */
  disable() {
    this.enabled = false;
  }

  /**
   * Map a tutorial joint id to actuator ctrl.
   * @param {string} uiId
   * @param {number} radians
   */
  setJoint(uiId, radians) {
    const name = ACTUATOR_MAP[uiId];
    if (!name) return;
    this.reachy?.setCtrl(name, radians);
    this.duck?.setCtrl(name, radians);
  }

  /**
   * Read joint angle in degrees for tutorial challenges.
   * @param {string} uiId
   * @returns {number}
   */
  getJointDegrees(uiId) {
    const name = ACTUATOR_MAP[uiId];
    if (!name) return 0;
    const angle =
      this.duck?.getJointAngle(name) ?? this.reachy?.getJointAngle(name) ?? 0;
    return (angle * 180) / Math.PI;
  }

  /** One display frame of physics + visual sync. */
  tick() {
    if (!this.enabled) return;
    this.reachy?.stepFrame();
    this.duck?.stepFrame();
    this.sync();
  }

  /** Push current sim poses to the GLBs. */
  sync() {
    this.reachy?.syncVisuals();
    this.duck?.syncVisuals();
  }

  /** Reset both sims to home / STAND. */
  reset() {
    this.reachy?.reset();
    this.duck?.reset();
    this.sync();
  }

  dispose() {
    this.enabled = false;
    this.reachy?.dispose();
    this.duck?.dispose();
    this.reachy = null;
    this.duck = null;
  }
}
