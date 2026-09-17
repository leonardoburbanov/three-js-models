# 2. One revolute joint

## Revolute = hinge

A **revolute** joint rotates around a fixed axis. One angle θ fully describes the relative pose of the child link (within joint limits).

```
        axis
          |
    ─────●─────   θ increases → child swings around ●
          |
```

Common notation: θ in **radians** in code; UIs often show **degrees**.

```
θ_rad = θ_deg × π / 180
180° = π rad ≈ 3.1416
```

## Reachy Mini examples

| Control | CAD / idea | Axis role |
|---------|------------|-----------|
| Body yaw | Base → upper body (`body_down_3dprint`) | Turn left/right |
| Antennas | Servo horns (`dc15_a01_horn_dummy_*`) | Independent DOFs |

In the lesson, sliders set a **delta** from the mesh rest pose. That matches how many viewers apply FK on imported GLBs without rewriting the full URDF.

## Joint limits

Real servos have hard stops (mechanical) and soft limits (software). The tutorial sliders use a safe teaching range, not the full datasheet range of every XL/DC15.

## Takeaway

One revolute joint → one number. Multi-DOF robots are just many of these (plus fixed welds and parallel constraints — next lessons).
