"""Assemble official URDF visuals and export Y-up GLB files for Three.js."""

from pathlib import Path

import numpy as np
import trimesh
from yourdfpy import URDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models"


def resolve_mesh(urdf_dir: Path, filename: str) -> str:
    """Resolve package:// mesh paths relative to the URDF directory."""
    name = filename.replace("package://", "").lstrip("/")
    direct = urdf_dir / name
    if direct.exists():
        return str(direct)
    return str(urdf_dir / Path(name).name)


def export_robot(urdf_path: Path, glb_path: Path) -> None:
    """Load visual meshes from a URDF, rotate to Y-up, and write a GLB."""
    urdf_dir = urdf_path.parent
    robot = URDF.load(
        str(urdf_path),
        filename_handler=lambda fname: resolve_mesh(urdf_dir, fname),
        load_meshes=True,
        load_collision_meshes=False,
        build_scene_graph=True,
    )
    scene = robot.scene
    scene.apply_transform(
        trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
    )

    bounds = scene.bounds
    scene.apply_translation([0, -float(bounds[0][1]), 0])

    glb_path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(glb_path)
    height = float(scene.extents[1])
    print(f"{glb_path.name}: {glb_path.stat().st_size / 1e6:.1f} MB, height {height:.3f} m, geoms {len(scene.geometry)}")


def main() -> None:
    """Export Reachy Mini and Open Duck Mini v2 visualization GLBs."""
    export_robot(
        ROOT
        / "vendor"
        / "reachy_pkg"
        / "reachy_mini"
        / "descriptions"
        / "reachy_mini"
        / "urdf"
        / "robot_no_collision.urdf",
        OUT / "reachy_mini.glb",
    )
    export_robot(
        ROOT
        / "vendor"
        / "open_duck"
        / "mini_bdx"
        / "robots"
        / "open_duck_mini_v2"
        / "robot.urdf",
        OUT / "open_duck_mini_v2.glb",
    )


if __name__ == "__main__":
    main()
