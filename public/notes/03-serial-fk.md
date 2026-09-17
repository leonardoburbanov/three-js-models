# 3. Serial chain & forward kinematics

## Serial chain

Microduck’s leg is a **serial** open chain: joints are stacked so each joint moves all links distal to it.

```
hip roll → hip pitch → knee → ankle → foot
   ●─────────●─────────●────────●
```

Moving the **hip** swings the whole leg. Moving the **knee** only moves shin + foot. That is the hallmark of serial FK.

## Forward kinematics (FK)

**FK**: given joint angles **q**, compute the pose of a point of interest (e.g. the foot) in space.

```
x_foot = FK(q)     where q = [θ_hip_roll, θ_hip_pitch, θ_knee, θ_ankle, …]
```

You do not need closed-form matrices to *feel* FK: set angles with sliders and watch the foot. That is FK by construction of the scene graph (parent transforms multiply down the chain).

### Light matrix view

For revolute joints along Z in a simplified planar model:

```
T_i(θ) = Rot_z(θ_i) · Trans(a_i, 0, 0)   (or DH parameters)
T_0n = T_1 · T_2 · … · T_n
```

3D CAD axes differ; the product-of-transforms idea is the same.

## Inverse kinematics (IK) — contrast

**IK**: given a desired foot pose, find **q**. Often many solutions, or none. Not required for this lesson.

## Challenge

Set left knee ≈ **35°** (±5°). That locks “I can target a joint in configuration,” which leads to C-space (lesson 5).

## Binding used in the app

| Slider | Typical CAD node |
|--------|------------------|
| Left hip roll | `hip_l` |
| Left hip pitch | `upper_leg_left` |
| Left knee | `leg` |
| Left ankle | `ankle_left` |
