"""Assemble Microduck from official kinematics.json + mesh GLB into a Y-up hierarchy."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import trimesh
from pygltflib import GLTF2

ROOT = Path(__file__).resolve().parents[1]
KIN = ROOT / "vendor" / "microduck" / "kinematics.json"
SRC_GLB = ROOT / "public" / "models" / "microduck_flat.glb"
OUT_GLB = ROOT / "public" / "models" / "microduck.glb"

# Pollen press-kit Sky colourway (user reference photo, leftmost)
SKY = {
    "shell": (0.663, 0.859, 0.910, 1.0),  # #a9dbe8
    "trim": (0.945, 0.627, 0.322, 1.0),  # orange beak/feet
    "eye": (0.95, 0.82, 0.2, 1.0),  # yellow lens ring cue
    "dark": (0.18, 0.18, 0.18, 1.0),
    "metal": (0.55, 0.58, 0.62, 1.0),
    "face": (0.45, 0.47, 0.5, 1.0),
}


def color_for(mesh_name: str, fallback: list[float]) -> tuple[float, float, float, float]:
    """Map mesh names to Sky colourway; fall back to kinematics color."""
    n = mesh_name.lower()
    if any(k in n for k in ("shell", "left_shell", "right_shell", "top_head", "bottom_head", "upper_leg", "leg.stl", "hip_l")):
        if "sole" in n:
            return SKY["trim"]
        return SKY["shell"]
    if any(k in n for k in ("foot", "jaw", "soft_mouth", "jaw_soft")):
        return SKY["trim"]
    if "sole" in n:
        return SKY["trim"]
    if "lens" in n or "noenoeil" in n:
        return SKY["eye"]
    if "face" in n:
        return SKY["face"]
    if any(k in n for k in ("xl330", "neck", "yaw", "motor", "bearing", "pcb", "np_f", "speaker", "trunk")):
        return SKY["dark"] if "trunk" not in n and "shell" not in n else SKY["metal"]
    if "trunk" in n:
        return SKY["metal"]
    return tuple(float(c) for c in fallback[:4])


def quat_wxyz_to_matrix(quat: list[float]) -> np.ndarray:
    """Convert [w,x,y,z] quaternion to 4x4 matrix."""
    w, x, y, z = quat
    return trimesh.transformations.quaternion_matrix([w, x, y, z])


def load_mesh_geometries(glb_path: Path) -> dict[str, trimesh.Trimesh]:
    """Load named meshes from the flat Microduck GLB."""
    scene = trimesh.load(glb_path, force="scene")
    out: dict[str, trimesh.Trimesh] = {}
    for name, geom in scene.geometry.items():
        key = name if name.endswith(".stl") else f"{name}.stl"
        if isinstance(geom, trimesh.Trimesh):
            out[key] = geom.copy()
            out[name] = geom.copy()
    return out


def main() -> None:
    """Build hierarchical coloured Microduck GLB."""
    data = json.loads(KIN.read_text(encoding="utf-8"))
    meshes = load_mesh_geometries(SRC_GLB)
    print(f"loaded {len(meshes)} mesh keys from {SRC_GLB.name}")

    # First pass: create empty frames for every body
    frames: dict[str, trimesh.Scene] = {}
    bodies = {b["name"]: b for b in data["bodies"]}

    # Build a single scene with graph edges matching kinematics parents
    scene = trimesh.Scene()
    # world root
    scene.graph.update(frame_to="world", matrix=np.eye(4))

    # Ensure parents come before children via iterative add
    pending = list(data["bodies"])
    placed: set[str] = set()
    guard = 0
    while pending and guard < 500:
        guard += 1
        body = pending.pop(0)
        parent = body.get("parent")
        if parent is not None and parent not in placed:
            pending.append(body)
            continue

        parent_frame = parent if parent is not None else "world"
        pos = body["pos"]
        quat = body["quat"]
        matrix = quat_wxyz_to_matrix(quat)
        matrix[:3, 3] = pos

        # Attach each geom as its own named node under the body frame
        body_name = body["name"]
        scene.graph.update(
            frame_to=body_name,
            frame_from=parent_frame,
            matrix=matrix,
        )

        for i, geom in enumerate(body.get("geoms", [])):
            mesh_name = geom["mesh"]
            mesh = meshes.get(mesh_name) or meshes.get(mesh_name.replace(".stl", ""))
            if mesh is None:
                print(f"  missing mesh: {mesh_name}")
                continue

            gpos = geom["pos"]
            gquat = geom["quat"]
            gmatrix = quat_wxyz_to_matrix(gquat)
            gmatrix[:3, 3] = gpos

            rgba = color_for(mesh_name, geom.get("color", [0.8, 0.8, 0.8, 1.0]))
            colored = mesh.copy()
            # ponytail: vertex colors avoid scipy face→vertex conversion on export
            byte = np.array(
                [int(rgba[0] * 255), int(rgba[1] * 255), int(rgba[2] * 255), int(rgba[3] * 255)],
                dtype=np.uint8,
            )
            colored.visual.vertex_colors = np.tile(byte, (len(colored.vertices), 1))

            node_name = f"{body_name}__{mesh_name}"
            if node_name in scene.graph.nodes:
                node_name = f"{node_name}_{i}"
            scene.add_geometry(
                colored,
                node_name=node_name,
                geom_name=node_name,
                parent_node_name=body_name,
                transform=gmatrix,
            )

        placed.add(body_name)

    print(f"placed bodies: {len(placed)}")

    # Z-up (MuJoCo) -> Y-up (Three.js)
    scene.apply_transform(
        trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
    )
    bounds = scene.bounds
    scene.apply_translation([0, -float(bounds[0][1]), 0])

    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    scene.export(OUT_GLB)
    print(
        f"{OUT_GLB.name}: {OUT_GLB.stat().st_size / 1e6:.2f} MB, "
        f"height {float(scene.extents[1]):.3f} m, geoms {len(scene.geometry)}"
    )


if __name__ == "__main__":
    main()
