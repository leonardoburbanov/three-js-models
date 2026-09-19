import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { initTutorial } from "./tutorial/tutorial.js";
import { PhysicsWorld } from "./physics.js";
import { applyDom, onLangChange, t, toggleLang } from "./i18n.js";
import "./style.css";

applyDom();
document.querySelector("#lang-toggle")?.addEventListener("click", () => toggleLang());

start().catch((error) => {
  console.error(error);
  window.showRobotError(error);
});

/**
 * Boot the explorer: studio scene, official CAD GLBs, inspector, and tutorial.
 */
async function start() {
  const viewport = document.querySelector("#viewport");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#12151c");

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  viewport.appendChild(renderer.domElement);

  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    window.showRobotError(
      new Error("The WebGL context was lost. Reload this page.")
    );
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.8;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.enablePan = false;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  scene.add(new THREE.HemisphereLight("#f4f6fb", "#8b93a3", 1.15));

  const key = new THREE.DirectionalLight("#fff7ee", 1.7);
  key.position.set(2.4, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.radius = 3;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight("#e8eef8", 0.55);
  fill.position.set(-3.2, 2.4, -1.6);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: "#1a1f2a",
      roughness: 1,
      metalness: 0
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(8, 16, "#3a4558", "#252b38");
  grid.position.y = -0.018;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  const pickable = [];
  /** @type {THREE.Mesh[]} */
  let tutorialHighlights = [];
  /** @type {Array<() => void>} */
  const frameHooks = [];

  function group(parent, position = [0, 0, 0]) {
    const result = new THREE.Group();
    result.position.set(...position);
    parent.add(result);
    return result;
  }

  function pedestal(x, accent) {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.04, 64),
      new THREE.MeshStandardMaterial({
        color: "#6d7582",
        roughness: 0.7,
        metalness: 0.08
      })
    );
    platform.position.set(x, 0.0, 0);
    platform.receiveShadow = true;
    scene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.006, 8, 96),
      new THREE.MeshBasicMaterial({ color: accent })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.022, 0);
    scene.add(ring);
  }

  function prettyName(name) {
    return name
      .replace(/^.*?__/, "")
      .replace(/\.stl(_\d+)?$/i, "")
      .replace(/_3dprint/gi, "")
      .replace(/wj-wk00-\d+/gi, "servo housing")
      .replace(/dc15_a01_/gi, "servo ")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function namedAncestor(object) {
    let node = object;
    while (node) {
      const name = node.name || "";
      if (
        name &&
        !name.includes(".stl") &&
        name !== "Scene" &&
        name !== "world"
      ) {
        return name;
      }
      node = node.parent;
    }
    return object.name || "part";
  }

  function inferJoint(name) {
    const n = name.toLowerCase();
    if (n.includes("beak") || n.includes("jaw")) return ["beak", "revolute"];
    if (n.includes("antenna")) return ["antenna", "revolute"];
    if (n.includes("stewart") || n.includes("passive")) return ["neck", "revolute"];
    if (n.includes("xl_330") || n.includes("head") || n.includes("camera") || n.includes("lens") || n.includes("glasses") || n.includes("neck") || n.includes("yaw_roll") || n.includes("noenoeil")) {
      return ["head", "revolute"];
    }
    if (n.includes("yaw_body") || n.includes("turning") || n.includes("dummy_torso") || n.includes("body_down")) {
      return ["body_yaw", "revolute"];
    }
    if (n.includes("knee") || n === "leg" || n.includes("leg_2") || n.endsWith(" leg")) {
      return [n.includes("right") || n.includes("_2") ? "right_knee" : "left_knee", "revolute"];
    }
    if (n.includes("ankle") || n.includes("foot") || n.includes("sole")) {
      return [n.includes("right") ? "right_ankle" : "left_ankle", "revolute"];
    }
    if (n.includes("hip") || n.includes("roll_to_pitch") || n.includes("yaw2roll") || n.includes("bearing_roll") || n.includes("upper_leg")) {
      return [n.includes("right") || n.includes("_2") ? "right_hip" : "left_hip", "revolute"];
    }
    if (n.includes("trunk") || n.includes("body") || n.includes("pelvis") || n.includes("shell")) return ["base", "fixed"];
    return ["base", "fixed"];
  }

  function tuneMaterial(mesh, material) {
    const next = material.clone();
    next.side = THREE.DoubleSide;
    if (material.vertexColors) {
      next.vertexColors = true;
      if ("color" in next) next.color.set(0xffffff);
    }
    const name = mesh.name.toLowerCase();

    if ("roughness" in next) {
      if (name.includes("lens") || name.includes("glass") || name.includes("noenoeil")) {
        next.roughness = 0.08;
        next.metalness = 0.18;
      } else if (
        name.includes("horn") ||
        name.includes("dc15") ||
        name.includes("wj-wk") ||
        name.includes("palonier") ||
        name.includes("bearing") ||
        name.includes("xl330")
      ) {
        next.roughness = 0.32;
        next.metalness = 0.58;
      } else {
        next.roughness = 0.5;
        next.metalness = 0.05;
      }
    }

    if (next.opacity < 0.99) {
      next.transparent = true;
      next.depthWrite = false;
    }

    if ("emissive" in next) {
      next.emissive.setHex(0x000000);
      next.emissiveIntensity = 0;
    }

    return next;
  }

  function prepareRobot(root, robotName) {
    root.traverse((object) => {
      if (!object.isMesh) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const tuned = materials.map((material) => tuneMaterial(object, material));
      object.material = Array.isArray(object.material) ? tuned : tuned[0];
      object.castShadow = true;
      object.receiveShadow = true;

      const source = object.name || namedAncestor(object);
      const [joint, type] = inferJoint(`${namedAncestor(object)} ${source}`);
      object.userData = {
        robot: robotName,
        name: prettyName(source) || "Part",
        joint,
        type
      };
      pickable.push(object);
    });
  }

  function findNode(root, names) {
    let found = null;
    root.traverse((object) => {
      if (!found && names.includes(object.name)) found = object;
    });
    return found;
  }

  /**
   * Cache a named assembly and its rest rotation for FK playback.
   * @param {THREE.Object3D} root
   * @param {string} name
   * @param {"x"|"y"|"z"} axis
   */
  function bindJoint(root, name, axis = "z") {
    const node = findNode(root, [name]);
    if (!node) {
      console.warn(`Missing joint node: ${name}`);
      return null;
    }
    return {
      node,
      axis,
      rest: node.rotation.clone()
    };
  }

  /**
   * Apply a delta angle on top of a joint's rest pose.
   * @param {{node: THREE.Object3D, axis: string, rest: THREE.Euler}|null} joint
   * @param {number} angle
   */
  function applyJoint(joint, angle) {
    if (!joint) return;
    joint.node.rotation.copy(joint.rest);
    joint.node.rotation[joint.axis] += angle;
  }

  function placeOnPedestal(root, x) {
    const box = new THREE.Box3().setFromObject(root);
    root.position.x = x;
    root.position.y += 0.02 - box.min.y;
    root.position.z = 0;
  }

  const loader = new GLTFLoader();
  const loadGltf = (url) =>
    new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

  const [reachyGltf, duckGltf] = await Promise.all([
    loadGltf("/models/reachy_mini.glb"),
    loadGltf("/models/microduck.glb")
  ]);

  const reachyModel = reachyGltf.scene;
  const duckModel = duckGltf.scene;

  const duckSize = new THREE.Box3().setFromObject(duckModel).getSize(new THREE.Vector3());
  const displayScale = 1.35 / Math.max(duckSize.y, 0.01);
  reachyModel.scale.setScalar(displayScale);
  duckModel.scale.setScalar(displayScale);

  prepareRobot(reachyModel, "Reachy Mini");
  prepareRobot(duckModel, "Microduck");

  pedestal(-0.85, "#2f9e7b");
  const reachy = group(scene, [0, 0, 0]);
  reachy.add(reachyModel);
  placeOnPedestal(reachy, -0.85);

  pedestal(0.85, "#c2782c");
  const duck = group(scene, [0, 0, 0]);
  duck.add(duckModel);
  placeOnPedestal(duck, 0.85);

  const kinematicHome = {
    reachy: {
      x: reachy.position.x,
      y: reachy.position.y,
      z: reachy.position.z
    },
    duck: {
      x: duck.position.x,
      y: duck.position.y,
      z: duck.position.z,
      yaw: duck.rotation.y
    }
  };

  const duckJoints = {
    leftHipYaw: bindJoint(duckModel, "yaw2roll"),
    leftHipRoll: bindJoint(duckModel, "hip_l"),
    leftHipPitch: bindJoint(duckModel, "upper_leg_left"),
    leftKnee: bindJoint(duckModel, "leg"),
    leftAnkle: bindJoint(duckModel, "ankle_left"),
    rightHipYaw: bindJoint(duckModel, "bearing_roll"),
    rightHipRoll: bindJoint(duckModel, "hip_l_2"),
    rightHipPitch: bindJoint(duckModel, "upper_leg_right"),
    rightKnee: bindJoint(duckModel, "leg_2"),
    rightAnkle: bindJoint(duckModel, "ankle_right"),
    neck: bindJoint(duckModel, "neck"),
    neckPitch: bindJoint(duckModel, "neck_pitch"),
    head: bindJoint(duckModel, "yaw_roll_motion"),
    beak: bindJoint(duckModel, "jaw_soft")
  };

  const reachyJoints = {
    bodyYaw: bindJoint(reachyModel, "body_down_3dprint"),
    head: bindJoint(reachyModel, "xl_330"),
    rightAntenna: bindJoint(reachyModel, "dc15_a01_horn_dummy_7"),
    leftAntenna: bindJoint(reachyModel, "dc15_a01_horn_dummy_8")
  };

  /** @type {Record<string, ReturnType<typeof bindJoint>>} */
  const jointRegistry = { ...duckJoints, ...reachyJoints };

  const duckHome = {
    x: kinematicHome.duck.x,
    y: kinematicHome.duck.y,
    z: kinematicHome.duck.z,
    yaw: kinematicHome.duck.yaw
  };

  let motionPlaying = true;
  let tutorialMode = false;
  let gaitDemo = false;
  let gaitPhase = 0;
  let physicsMode = false;

  /** @type {Map<THREE.Object3D, {pos: THREE.Vector3, quat: THREE.Quaternion, scale: THREE.Vector3}>} */
  const glbRestPose = new Map();
  function captureRestPoses(root) {
    root.traverse((obj) => {
      glbRestPose.set(obj, {
        pos: obj.position.clone(),
        quat: obj.quaternion.clone(),
        scale: obj.scale.clone()
      });
    });
  }
  captureRestPoses(reachyModel);
  captureRestPoses(duckModel);

  function restoreRestPoses() {
    for (const [obj, rest] of glbRestPose) {
      obj.position.copy(rest.pos);
      obj.quaternion.copy(rest.quat);
      obj.scale.copy(rest.scale);
    }
  }

  const physics = new PhysicsWorld();
  const physicsBtn = document.querySelector("#physics-toggle");
  try {
    await physics.init({
      reachyRoot: reachyModel,
      duckRoot: duckModel,
      // MuJoCo models are authored at the origin; offset matches pedestals.
      reachyOrigin: new THREE.Vector3(-0.85, 0, 0),
      duckOrigin: new THREE.Vector3(0.85, 0, 0),
      visualScale: displayScale
    });
  } catch (err) {
    console.warn("MuJoCo physics unavailable:", err);
    if (physicsBtn) {
      physicsBtn.disabled = true;
      physicsBtn.title = t("physics") + " (MuJoCo WASM failed)";
    }
  }

  /**
   * Toggle MuJoCo physics; keep the same displayScale as kinematic mode.
   * @param {boolean} on
   */
  function setPhysicsMode(on) {
    if (!physics.mujoco) return;
    physicsMode = on;
    const btn = document.querySelector("#physics-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? t("physicsOn") : t("physics");
    }

    if (on) {
      restoreRestPoses();
      // Keep displayScale on GLB roots; pose sync scales MuJoCo meters to match.
      reachyModel.scale.setScalar(displayScale);
      duckModel.scale.setScalar(displayScale);
      // Parent groups stay at pedestal X; Y/Z zeroed — body sync owns height.
      reachy.position.set(kinematicHome.reachy.x, 0, 0);
      duck.position.set(kinematicHome.duck.x, 0, 0);
      duck.rotation.y = 0;
      motionPlaying = true;
      syncPlayButton();
      physics.enable();
    } else {
      physics.disable();
      restoreRestPoses();
      reachyModel.scale.setScalar(displayScale);
      duckModel.scale.setScalar(displayScale);
      reachy.position.set(
        kinematicHome.reachy.x,
        kinematicHome.reachy.y,
        kinematicHome.reachy.z
      );
      duck.position.set(
        kinematicHome.duck.x,
        kinematicHome.duck.y,
        kinematicHome.duck.z
      );
      duck.rotation.y = kinematicHome.duck.yaw;
      resetMotion();
    }
  }

  /**
   * Walk cycle for Microduck — kinematic joint write, or MuJoCo ctrl when physics is on.
   * @param {number} time
   */
  function updateDuckWalk(time) {
    const cadence = 3.2;
    const phaseL = time * cadence;
    gaitPhase = phaseL;
    const phaseR = phaseL + Math.PI;

    const hipA = 0.38;
    const kneeB = 0.72;
    const ankleA = 0.28;
    const rollC = 0.08;
    const stance = 0.12;
    const crouch = 0.25;

    function leg(phase, sign) {
      const swing = Math.sin(phase);
      return {
        hipPitch: stance + hipA * swing * sign,
        knee: crouch + kneeB * Math.max(0, -swing),
        ankle: -ankleA * swing * sign,
        hipRoll: rollC * Math.sin(phase)
      };
    }

    const left = leg(phaseL, 1);
    const right = leg(phaseR, -1);

    /** @param {string} id @param {number} angle */
    function drive(id, angle) {
      if (physicsMode) physics.setJoint(id, angle);
      else applyJoint(jointRegistry[id] ?? null, angle);
    }

    drive("leftHipYaw", 0);
    drive("leftHipRoll", left.hipRoll);
    drive("leftHipPitch", left.hipPitch);
    drive("leftKnee", left.knee);
    drive("leftAnkle", left.ankle);

    drive("rightHipYaw", 0);
    drive("rightHipRoll", -right.hipRoll);
    drive("rightHipPitch", right.hipPitch);
    drive("rightKnee", right.knee);
    drive("rightAnkle", right.ankle);

    drive("neck", Math.sin(time * 0.55) * 0.12);
    drive("neckPitch", Math.sin(time * 0.7 + 0.3) * 0.15);
    drive("head", Math.sin(time * 0.9 + 0.4) * 0.2);
    drive("beak", 0.15 + Math.sin(time * 1.6) * 0.12);

    // Freejoint owns the body pose under physics — do not orbit the group.
    if (physicsMode) return;

    if (!gaitDemo) {
      const orbit = time * 0.22;
      const radius = 0.18;
      duck.position.x = duckHome.x + Math.cos(orbit) * radius;
      duck.position.z = duckHome.z + Math.sin(orbit) * radius;
      duck.position.y = duckHome.y + Math.abs(Math.sin(phaseL * 2)) * 0.025;
      duck.rotation.y = duckHome.yaw - orbit + Math.PI / 2;
    } else {
      duck.position.x = duckHome.x;
      duck.position.z = duckHome.z;
      duck.position.y = duckHome.y + Math.abs(Math.sin(phaseL * 2)) * 0.025;
      duck.rotation.y = duckHome.yaw;
    }
  }

  /**
   * Reachy Mini expression without Stewart CCD.
   * @param {number} time
   */
  function updateReachyIdle(time) {
    applyJoint(reachyJoints.bodyYaw, Math.sin(time * 0.45) * 0.35);
    applyJoint(reachyJoints.head, Math.sin(time * 0.65 + 0.5) * 0.1);
    if (reachyJoints.head) {
      reachyJoints.head.node.rotation.x =
        reachyJoints.head.rest.x + Math.sin(time * 0.8) * 0.06;
    }
    applyJoint(reachyJoints.leftAntenna, Math.sin(time * 1.8) * 0.55);
    applyJoint(reachyJoints.rightAntenna, Math.sin(time * 1.8 + 1.1) * 0.55);
  }

  function resetMotion() {
    for (const joint of Object.values(jointRegistry)) {
      if (joint) joint.node.rotation.copy(joint.rest);
    }
    duck.position.set(duckHome.x, duckHome.y, duckHome.z);
    duck.rotation.y = duckHome.yaw;
  }

  function materialsOf(mesh) {
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  }

  function clearHighlight() {
    for (const mesh of tutorialHighlights) {
      for (const material of materialsOf(mesh)) {
        if (material.emissive) {
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        }
      }
    }
    tutorialHighlights = [];
  }

  /**
   * Highlight meshes whose name contains any of the needles.
   * @param {string[]} needles
   */
  function highlightByName(needles) {
    clearHighlight();
    const lower = needles.map((n) => n.toLowerCase());
    for (const mesh of pickable) {
      const hay = `${mesh.name} ${namedAncestor(mesh)}`.toLowerCase();
      if (!lower.some((n) => hay.includes(n))) continue;
      tutorialHighlights.push(mesh);
      for (const material of materialsOf(mesh)) {
        if (material.emissive) {
          material.emissive.set("#f0b429");
          material.emissiveIntensity = 0.45;
        }
      }
    }
  }

  function syncPlayButton() {
    playButton.textContent = motionPlaying ? t("pause") : t("play");
    playButton.setAttribute("aria-pressed", String(motionPlaying));
  }

  const fields = {
    name: document.querySelector("#part-name"),
    robot: document.querySelector("#robot-name"),
    joint: document.querySelector("#joint-name"),
    type: document.querySelector("#joint-type")
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerActive = false;
  let selected = null;

  function select(mesh) {
    if (mesh === selected) return;

    if (selected && !tutorialHighlights.includes(selected)) {
      for (const material of materialsOf(selected)) {
        if (material.emissive) {
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        }
      }
    }

    selected = mesh;
    renderer.domElement.style.cursor = mesh ? "pointer" : "grab";

    if (!mesh) {
      fields.name.textContent = t("hoverPrompt");
      fields.robot.textContent = "—";
      fields.joint.textContent = "—";
      fields.type.textContent = "—";
      return;
    }

    if (!tutorialHighlights.includes(mesh)) {
      for (const material of materialsOf(mesh)) {
        if (material.emissive) {
          material.emissive.set("#3d8f73");
          material.emissiveIntensity = 0.28;
        }
      }
    }

    for (const [key, element] of Object.entries(fields)) {
      element.textContent = mesh.userData[key];
    }
  }

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerActive = true;
  }

  renderer.domElement.addEventListener("pointermove", updatePointer);
  renderer.domElement.addEventListener("pointerdown", updatePointer);
  renderer.domElement.addEventListener("pointerleave", () => {
    pointerActive = false;
    select(null);
  });

  function resetView() {
    const target = new THREE.Vector3(0, 0.72, 0);
    const halfHeight = 1.15;
    const halfWidth = 1.7;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distance =
      Math.max(
        halfHeight / Math.tan(verticalFov / 2),
        halfWidth / (Math.tan(verticalFov / 2) * camera.aspect)
      ) * 1.18;

    const direction = new THREE.Vector3(0.22, 0.28, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.far = Math.max(40, distance * 4);
    camera.updateProjectionMatrix();
    controls.maxDistance = Math.max(8, distance * 2);
    controls.target.copy(target);
    controls.update();
  }

  /**
   * Frame the camera on one robot or both.
   * @param {"reachy"|"microduck"|"both"} which
   */
  function focusRobot(which) {
    let target;
    let halfWidth = 1.7;
    let halfHeight = 1.15;

    if (which === "reachy") {
      target = new THREE.Vector3(reachy.position.x, 0.75, 0);
      halfWidth = 0.7;
      halfHeight = 1.0;
    } else if (which === "microduck") {
      target = new THREE.Vector3(duck.position.x, 0.55, 0);
      halfWidth = 0.7;
      halfHeight = 0.9;
    } else {
      target = new THREE.Vector3(0, 0.72, 0);
    }

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distance =
      Math.max(
        halfHeight / Math.tan(verticalFov / 2),
        halfWidth / (Math.tan(verticalFov / 2) * camera.aspect)
      ) * 1.25;

    const direction = new THREE.Vector3(0.22, 0.28, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance);
    controls.target.copy(target);
    controls.update();
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!tutorialMode) resetView();
  }

  window.addEventListener("resize", resize);
  document.querySelector("#reset").addEventListener("click", () => {
    if (physicsMode) physics.reset();
    if (tutorialMode) focusRobot("both");
    else resetView();
  });

  document.querySelector("#physics-toggle")?.addEventListener("click", () => {
    setPhysicsMode(!physicsMode);
  });

  const playButton = document.querySelector("#play-pause");
  playButton.addEventListener("click", () => {
    if (tutorialMode && !gaitDemo && !physicsMode) return;
    motionPlaying = !motionPlaying;
    syncPlayButton();
    if (!motionPlaying && !physicsMode) resetMotion();
  });

  /** Thin API for the tutorial panel. */
  const robotApi = {
    setJoint(id, radians) {
      if (physicsMode) {
        physics.setJoint(id, radians);
        return;
      }
      applyJoint(jointRegistry[id] ?? null, radians);
    },
    getJointDegrees(id) {
      if (physicsMode) return physics.getJointDegrees(id);
      const joint = jointRegistry[id];
      if (!joint) return 0;
      const delta = joint.node.rotation[joint.axis] - joint.rest[joint.axis];
      return (delta * 180) / Math.PI;
    },
    resetPose() {
      if (physicsMode) physics.reset();
      else resetMotion();
    },
    focusRobot,
    highlightByName,
    clearHighlight,
    pauseIdle() {
      motionPlaying = false;
      syncPlayButton();
      if (!physicsMode) resetMotion();
    },
    resumeIdle() {
      if (tutorialMode) return;
      motionPlaying = true;
      syncPlayButton();
    },
    setTutorialMode(on) {
      tutorialMode = on;
      playButton.disabled = on && !gaitDemo && !physicsMode;
    },
    setGaitDemo(on) {
      gaitDemo = on;
      playButton.disabled = tutorialMode && !on && !physicsMode;
      if (on) {
        if (!physicsMode) resetMotion();
        motionPlaying = true;
        syncPlayButton();
      } else if (tutorialMode) {
        motionPlaying = false;
        syncPlayButton();
        if (!physicsMode) resetMotion();
      }
    },
    getGaitPhase() {
      return gaitPhase;
    },
    onFrame(fn) {
      frameHooks.push(fn);
    }
  };

  initTutorial(robotApi);

  onLangChange(() => {
    syncPlayButton();
    const pBtn = document.querySelector("#physics-toggle");
    if (pBtn && !pBtn.disabled) {
      pBtn.textContent = physicsMode ? t("physicsOn") : t("physics");
    }
    const tutBtn = document.querySelector("#tutorial-toggle");
    // tutorial.js also updates this when active; cover idle state here
    if (tutBtn && tutBtn.getAttribute("aria-pressed") !== "true") {
      tutBtn.textContent = t("tutorial");
    }
    if (!selected) {
      fields.name.textContent = t("hoverPrompt");
    }
  });

  // Initial chrome labels (not data-i18n — state-dependent).
  document.querySelector("#tutorial-toggle").textContent = t("tutorial");
  document.querySelector("#physics-toggle").textContent = t("physics");
  syncPlayButton();

  resize();

  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const time = clock.getElapsedTime();

    if (physicsMode) {
      if (gaitDemo) updateDuckWalk(time);
      if (motionPlaying) physics.tick();
      else physics.sync();
    } else if (motionPlaying && (!tutorialMode || gaitDemo)) {
      if (!tutorialMode || gaitDemo) updateDuckWalk(time);
      if (!tutorialMode) updateReachyIdle(time);
    }

    for (const hook of frameHooks) hook();

    controls.update();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    if (pointerActive) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0];
      select(hit?.object ?? null);
    }

    renderer.render(scene, camera);
  });

  renderer.render(scene, camera);
  document.querySelector("#status").hidden = true;
}
