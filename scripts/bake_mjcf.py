"""Bake official Pollen MJCF into slim, browser-ready physics XMLs.

Strips visual CAD meshes (Three.js already draws the GLBs). Keeps joints,
inertials, actuators, equality constraints. Replaces mesh colliders with
boxes when LFS collision STLs are missing/empty.

Usage:
    uv run --with mujoco python scripts/bake_mjcf.py
"""

from __future__ import annotations

import shutil
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "physics"
REACHY_MJCF = (
    ROOT
    / "vendor"
    / "reachy_pkg"
    / "reachy_mini"
    / "descriptions"
    / "reachy_mini"
    / "mjcf"
)
DUCK_MJCF = (
    ROOT
    / "vendor"
    / "microduck_rl"
    / "src"
    / "mjlab_microduck"
    / "robot"
    / "microduck"
)


def _is_usable_stl(path: Path) -> bool:
    """Return True if path looks like a real binary STL (not empty/LFS stub)."""
    if not path.is_file() or path.stat().st_size < 84:
        return False
    data = path.read_bytes()
    # Binary STL: bytes 80..83 = uint32 triangle count; reject all-zero headers.
    ntris = int.from_bytes(data[80:84], "little")
    if ntris < 1 or ntris > 2_000_000:
        return False
    expected = 84 + ntris * 50
    return abs(path.stat().st_size - expected) < 200 or path.stat().st_size >= expected


def _strip_visual_geoms(root: ET.Element) -> None:
    """Remove visual mesh geoms so we do not ship CAD STLs."""
    for parent in root.iter():
        doomed = []
        for child in list(parent):
            if child.tag != "geom":
                continue
            cls = child.get("class", "")
            contype = child.get("contype")
            conaff = child.get("conaffinity")
            is_visual = cls == "visual" or (
                contype == "0" and conaff == "0" and child.get("type") == "mesh"
            )
            # Keep self_collision_only / collision mesh geoms for now.
            if is_visual and cls != "self_collision_only":
                doomed.append(child)
        for child in doomed:
            parent.remove(child)


def _replace_mesh_colliders_with_boxes(root: ET.Element, body_sizes: dict[str, tuple]) -> None:
    """Swap mesh collision geoms for AABB boxes when STLs are unusable."""
    for body in root.iter("body"):
        name = body.get("name") or ""
        size = body_sizes.get(name)
        if not size:
            continue
        hx, hy, hz = size
        doomed = []
        for geom in list(body):
            if geom.tag != "geom":
                continue
            cls = geom.get("class", "")
            if geom.get("type") == "mesh" and cls in ("collision", "self_collision_only", ""):
                # Keep named foot collisions as explicit boxes.
                if "collision" in cls or geom.get("name", "").endswith("_collision"):
                    doomed.append(geom)
        if not doomed:
            continue
        for geom in doomed:
            body.remove(geom)
        # One box per body is enough for browser contact.
        ET.SubElement(
            body,
            "geom",
            {
                "name": f"{name}_box_col",
                "type": "box",
                "class": "collision",
                "size": f"{hx:.5f} {hy:.5f} {hz:.5f}",
                "friction": "1 0.5 0.01",
            },
        )


def _body_half_extents(model: mujoco.MjModel) -> dict[str, tuple[float, float, float]]:
    """Approximate each body with half-extents from geom AABBs (or inertial fallback)."""
    out: dict[str, tuple[float, float, float]] = {}
    for bid in range(1, model.nbody):  # skip world
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, bid) or f"body_{bid}"
        # Gather geom sizes belonging to this body.
        extents = []
        for gid in range(model.ngeom):
            if int(model.geom_bodyid[gid]) != bid:
                continue
            if int(model.geom_contype[gid]) == 0 and int(model.geom_conaffinity[gid]) == 0:
                continue
            size = model.geom_size[gid]
            gtype = int(model.geom_type[gid])
            if gtype == mujoco.mjtGeom.mjGEOM_BOX:
                extents.append((float(size[0]), float(size[1]), float(size[2])))
            elif gtype == mujoco.mjtGeom.mjGEOM_SPHERE:
                r = float(size[0])
                extents.append((r, r, r))
            elif gtype in (mujoco.mjtGeom.mjGEOM_CAPSULE, mujoco.mjtGeom.mjGEOM_CYLINDER):
                r, half = float(size[0]), float(size[1])
                extents.append((r, r, half + r))
            elif gtype == mujoco.mjtGeom.mjGEOM_MESH:
                # Empty/broken mesh -> tiny placeholder; replaced later.
                extents.append((0.02, 0.02, 0.02))
        if extents:
            hx = max(e[0] for e in extents)
            hy = max(e[1] for e in extents)
            hz = max(e[2] for e in extents)
        else:
            # Inertial-based guess: cube of similar mass density ~1000 kg/m3
            mass = float(model.body_mass[bid])
            side = max((mass / 1000.0) ** (1.0 / 3.0) / 2.0, 0.015)
            hx = hy = hz = side
        out[name] = (max(hx, 0.01), max(hy, 0.01), max(hz, 0.01))
    return out


def _prune_unused_assets(root: ET.Element) -> None:
    """Drop mesh/material/texture assets no longer referenced by geoms."""
    used_meshes: set[str] = set()
    used_materials: set[str] = set()
    for geom in root.iter("geom"):
        if geom.get("mesh"):
            used_meshes.add(geom.get("mesh"))
        if geom.get("material"):
            used_materials.add(geom.get("material"))
    asset = root.find("asset")
    if asset is None:
        return
    for el in list(asset):
        if el.tag == "mesh" and el.get("name", el.get("file", "").replace(".stl", "")) not in used_meshes:
            # mesh name defaults to filename stem
            name = el.get("name")
            if not name:
                fname = el.get("file", "")
                name = Path(fname).stem
            if name not in used_meshes:
                asset.remove(el)
        elif el.tag == "material" and el.get("name") not in used_materials:
            asset.remove(el)
        elif el.tag == "texture":
            # textures only used by materials we may have dropped
            asset.remove(el)


def _ensure_compiler(root: ET.Element, meshdir: str = "assets") -> None:
    """Ensure compiler has discardvisual and meshdir."""
    compiler = root.find("compiler")
    if compiler is None:
        compiler = ET.Element("compiler")
        root.insert(0, compiler)
    compiler.set("angle", "radian")
    compiler.set("autolimits", "true")
    compiler.set("discardvisual", "true")
    compiler.set("meshdir", meshdir)


def _copy_usable_meshes(src_assets: Path, dst_assets: Path, names: list[str]) -> list[str]:
    """Copy usable STLs; return list of names that were copied."""
    dst_assets.mkdir(parents=True, exist_ok=True)
    ok = []
    for name in names:
        src = src_assets / f"{name}.stl"
        # Also try collision/coarse/
        if not src.is_file():
            alt = src_assets / "collision" / "coarse" / f"{name}.stl"
            if alt.is_file():
                src = alt
        if _is_usable_stl(src):
            shutil.copy2(src, dst_assets / f"{name}.stl")
            ok.append(name)
    return ok


def _foot_box_sizes_from_kin() -> dict[str, tuple[float, float, float]]:
    """Sensible default half-extents for Microduck links (meters)."""
    return {
        "trunk_base": (0.06, 0.05, 0.04),
        "yaw2roll": (0.02, 0.02, 0.02),
        "hip_l": (0.02, 0.02, 0.02),
        "upper_leg_left": (0.025, 0.02, 0.04),
        "leg": (0.02, 0.02, 0.04),
        "ankle_left": (0.04, 0.025, 0.015),
        "bearing_roll": (0.02, 0.02, 0.02),
        "hip_l_2": (0.02, 0.02, 0.02),
        "upper_leg_right": (0.025, 0.02, 0.04),
        "leg_2": (0.02, 0.02, 0.04),
        "ankle_right": (0.04, 0.025, 0.015),
        "neck": (0.02, 0.02, 0.02),
        "neck_pitch": (0.02, 0.02, 0.02),
        "yaw_roll_motion": (0.04, 0.04, 0.04),
        "jaw_soft": (0.02, 0.015, 0.015),
    }


def bake_reachy() -> None:
    """Bake Reachy Mini empty scene into public/physics/reachy_mini.xml."""
    scene_path = REACHY_MJCF / "scenes" / "empty.xml"
    assert scene_path.is_file(), f"missing {scene_path}"

    # Load official model (validates joints/actuators even if some STLs are stubs).
    model = mujoco.MjModel.from_xml_path(str(scene_path))
    assert model.nq > 0
    yaw_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, "yaw_body")
    assert yaw_id >= 0, "yaw_body joint missing"

    # Work on a merged XML via mj_saveLastXML then strip visuals.
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        saved = tmp_path / "reachy_full.xml"
        mujoco.mj_saveLastXML(str(saved), model)
        tree = ET.parse(saved)
        root = tree.getroot()

        _ensure_compiler(root, meshdir="assets")
        _strip_visual_geoms(root)

        # ponytail: LFS collision STLs are often empty stubs — boxes are enough
        # for a welded-base Reachy (no locomotion contact needed).
        sizes = _body_half_extents(model)
        sizes.setdefault("body_foot_3dprint", (0.08, 0.08, 0.02))
        sizes.setdefault("body_down_3dprint", (0.08, 0.08, 0.1))
        sizes.setdefault("xl_330", (0.06, 0.06, 0.06))
        # Strip every remaining mesh geom (saved XML often omits type="mesh").
        for parent in root.iter():
            for geom in list(parent):
                if geom.tag == "geom" and geom.get("mesh") is not None:
                    parent.remove(geom)
        for bname, (hx, hy, hz) in sizes.items():
            body = None
            for b in root.iter("body"):
                if b.get("name") == bname:
                    body = b
                    break
            if body is None:
                continue
            # Skip tiny antenna holders etc. — only main collision bodies.
            if bname not in (
                "body_foot_3dprint",
                "body_down_3dprint",
                "xl_330",
                "head_one_3dprint",
            ):
                continue
            ET.SubElement(
                body,
                "geom",
                {
                    "name": f"{bname}_box_col",
                    "type": "box",
                    "size": f"{hx:.5f} {hy:.5f} {hz:.5f}",
                    "contype": "1",
                    "conaffinity": "1",
                    "friction": "1 0.5 0.01",
                },
            )
        asset = root.find("asset")
        if asset is not None:
            for mesh in list(asset.findall("mesh")):
                asset.remove(mesh)
            for mat in list(asset.findall("material")):
                if mat.get("name") != "groundplane":
                    asset.remove(mat)

        # Drop sensors/cameras that need textures; keep floor from scene.
        out_xml = OUT / "reachy_mini.xml"
        OUT.mkdir(parents=True, exist_ok=True)
        tree.write(out_xml, encoding="utf-8", xml_declaration=True)

        # Verify reload.
        m2 = mujoco.MjModel.from_xml_path(str(out_xml))
        assert m2.nq > 0
        assert mujoco.mj_name2id(m2, mujoco.mjtObj.mjOBJ_JOINT, "yaw_body") >= 0
        print(f"reachy_mini.xml: nq={m2.nq} nu={m2.nu} ngeom={m2.ngeom} size={out_xml.stat().st_size}")


def bake_microduck() -> None:
    """Bake Microduck walk scene into public/physics/microduck.xml."""
    scene_path = DUCK_MJCF / "scene_walk.xml"
    assert scene_path.is_file(), f"missing {scene_path} — clone pollen-robotics/microduck_rl"

    model = mujoco.MjModel.from_xml_path(str(scene_path))
    assert model.nq > 0
    knee_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, "left_knee")
    assert knee_id >= 0, "left_knee joint missing"

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        saved = tmp_path / "duck_full.xml"
        mujoco.mj_saveLastXML(str(saved), model)
        tree = ET.parse(saved)
        root = tree.getroot()

        _ensure_compiler(root, meshdir="assets")
        _strip_visual_geoms(root)

        # Always use box feet — LFS soles are usually stubs in shallow clones.
        sizes = _foot_box_sizes_from_kin()
        # Force foot boxes even if mesh geoms remain.
        for body in root.iter("body"):
            bname = body.get("name") or ""
            if bname in ("ankle_left", "ankle_right"):
                for geom in list(body):
                    if geom.tag == "geom" and (
                        geom.get("class") == "collision"
                        or (geom.get("name") or "").endswith("_collision")
                    ):
                        body.remove(geom)
                hx, hy, hz = sizes[bname]
                ET.SubElement(
                    body,
                    "geom",
                    {
                        "name": f"{bname}_box_col",
                        "type": "box",
                        "class": "collision",
                        "size": f"{hx:.5f} {hy:.5f} {hz:.5f}",
                        "pos": "0 0 -0.01",
                        "friction": "1.2 0.5 0.01",
                    },
                )

        # Remove remaining mesh collision / self-collision geoms + mesh assets.
        for parent in root.iter():
            for geom in list(parent):
                if geom.tag == "geom" and geom.get("mesh") is not None:
                    parent.remove(geom)
        asset = root.find("asset")
        if asset is not None:
            for mesh in list(asset.findall("mesh")):
                asset.remove(mesh)
            for mat in list(asset.findall("material")):
                # keep groundplane material
                if mat.get("name") != "groundplane":
                    asset.remove(mat)

        # Keep STAND keyframe (already in saved XML from scene).
        out_xml = OUT / "microduck.xml"
        OUT.mkdir(parents=True, exist_ok=True)
        tree.write(out_xml, encoding="utf-8", xml_declaration=True)

        m2 = mujoco.MjModel.from_xml_path(str(out_xml))
        assert m2.nq > 0
        assert mujoco.mj_name2id(m2, mujoco.mjtObj.mjOBJ_JOINT, "left_knee") >= 0
        print(f"microduck.xml: nq={m2.nq} nu={m2.nu} ngeom={m2.ngeom} size={out_xml.stat().st_size}")

        # Write keyframe ctrl hint for the JS runtime.
        meta = OUT / "microduck_stand.json"
        # STAND ctrl from scene_walk.xml
        stand_ctrl = [
            0,
            -0.08726646259971647,
            -0.457924,
            -0.004940,
            0.452984,
            0.3490658503988659,
            0.3490658503988659,
            0,
            0,
            0,
            0.08726646259971647,
            0.457924,
            0.004940,
            -0.452984,
        ]
        stand_qpos = [
            0,
            0,
            0.12,
            1,
            0,
            0,
            0,
            0,
            -0.08726646259971647,
            -0.457924,
            -0.004940,
            0.452984,
            0.3490658503988659,
            0.3490658503988659,
            0,
            0,
            0,
            0.08726646259971647,
            0.457924,
            0.004940,
            -0.452984,
        ]
        import json

        meta.write_text(
            json.dumps({"ctrl": stand_ctrl, "qpos": stand_qpos}, indent=2),
            encoding="utf-8",
        )
        print(f"wrote {meta.name}")


def main() -> None:
    """Bake both robots and self-check named joints."""
    OUT.mkdir(parents=True, exist_ok=True)
    bake_reachy()
    bake_microduck()
    print("ok")


if __name__ == "__main__":
    main()
