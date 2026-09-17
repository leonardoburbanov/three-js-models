# 5. Configuration space

## Configuration

A **configuration** is the complete list of joint angles (and any other generalized coordinates) that fix the robot’s pose:

```
q = [θ₁, θ₂, …, θₙ]ᵀ
```

The set of all legal **q** is **configuration space** (C-space). For an n-DOF robot with no constraints, C-space is often a subset of ℝⁿ or a torus (angles wrap).

## Pose vs task space

| Space | What you specify |
|-------|------------------|
| **C-space** | Joint vector **q** |
| **Task / workspace** | End-effector position/orientation in 3D |

FK maps C-space → task space. IK goes the other way.

## Presets in the lesson

Buttons like **Stand**, **Crouch**, **Look up** are just named points in C-space — fixed joint vectors applied at once. That is how many teleop “postures” and keyframes work.

## Joint limits

Legal configurations usually satisfy:

```
θᵢ_min ≤ θᵢ ≤ θᵢ_max
```

Limits come from servo stops, collisions, and cable routing. The lesson sliders are a teaching subset of those limits.

## Mental picture

```
        θ_knee
          ↑
          |   ● crouch
          |  /
          | /
          ●────→ θ_hip
         stand
```

Two joints already form a plane of configurations; a full biped is a high-dimensional volume with forbidden regions (self-collision).
