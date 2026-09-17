# 1. Parts, links, and joints

## The idea

A robot mechanism is a tree of **rigid bodies** (links) connected by **joints**. The explorer’s part inspector maps hovered CAD meshes back to that tree.

```
        [base / trunk]
              |
         (revolute)
              |
         [upper body]
           /     \
     (joint)   (joint)
        |         |
     [limb]    [limb]
```

| Term | Meaning |
|------|---------|
| **Link** | Rigid piece: shell, servo housing, foot, antenna horn |
| **Joint** | Allowed relative motion between two links |
| **DOF** | Degrees of freedom — independent joint angles the robot can set |

## In this scene

- **Reachy Mini** — desktop humanoid head/body CAD; body yaw, antennas, Stewart neck.
- **Microduck** — biped with serial legs, neck, and beak.

Hover a mesh: the inspector shows a human-readable part name, which robot it belongs to, and a coarse **parent joint** label (hip, knee, body_yaw, …). That label is inferred from CAD names for teaching, not a full URDF parser.

## Why names matter

Official CAD / URDF exports keep stable node names (`hip_l`, `ankle_left`, `body_down_3dprint`, …). Playback and tutorials bind to those names so motion is **mechanism-true**, not skinned animation.

## Further reading

- [Reachy Mini overview](https://www.pollen-robotics.com/reachy-mini/)
- Classical intro: Siciliano & Khatib, *Springer Handbook of Robotics* — ch. on kinematic structures (library / bookstore).
