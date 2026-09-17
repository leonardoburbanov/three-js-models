# 4. Parallel mechanisms (Stewart neck)

## Serial vs parallel

| | Serial | Parallel |
|---|--------|----------|
| Structure | One open chain | Several chains meet at the end-effector |
| Example here | Microduck leg | Reachy Mini Stewart neck |
| Typical failure mode | Error accumulates along the chain | Constraints share load; geometry is stiffer |

```
Serial:     base ─ j ─ j ─ j ─ tip

Parallel:   base ═╤═ tip
                 ═╪═
                 ═╧═
              (multiple legs)
```

## Stewart platform (idea)

A classic **Stewart** platform uses **six** prismatic or equivalent legs between base and platform. The platform (Reachy’s head) has up to 6 DOF, but the legs are **coupled**: you cannot freely set an arbitrary head transform without solving for consistent leg lengths (IK).

Reachy Mini’s CAD includes named Stewart rods (`stewart_link_rod`, …). They stay attached only if head motion respects that parallel constraint.

## Why this tutorial barely moves the head

Freely rotating the `xl_330` head node in the GLB **without** updating rod lengths would stretch or detach the rods visually — fake motion.

Official Reachy software uses proper neck IK / CCD-style solvers for expressive head poses. Here we only allow a **tiny** look (about ±6–8°) so rods stay plausible for teaching.

## Takeaway

Parallel ≠ “more joints to spin freely.” Parallel means **shared constraints**. Serial FK sliders do not transfer to Stewart necks without a solver.
