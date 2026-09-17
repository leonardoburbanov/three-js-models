# 6. Gait basics

## Walking as timed trajectories

A **gait** is a coordinated schedule of joint trajectories over time. Legs cycle between:

- **Stance** — foot on the ground, supporting the body
- **Swing** — foot in the air, advancing

```
Left:   ──stance──┬──swing──┬──stance──
Right:  ──swing───┬──stance─┬──swing───
                  ↑ phase offset ≈ π
```

## Phase offset

For a simple biped alternating gait, left and right legs are often **half a period** apart:

```
φ_left  = ω t
φ_right = ω t + π
```

While `sin(φ)` drives swing on one side, the other side is in stance (or a complementary pattern).

The explorer’s Microduck demo is a **kinematic** teaching walk (sinusoids on hip/knee/ankle), not the robot’s onboard reinforcement-learning policy. It is enough to see phase and stance/swing timing.

## Cadence

ω (cadence) sets how fast the cycle repeats. Higher ω → faster steps, usually smaller safe amplitudes in a real controller.

## From teaching gait to real robots

Production bipeds combine:

1. Pattern generators or learned policies  
2. Balance / contact constraints  
3. Joint limits and motor torque limits  

Your next step after this note: compare the CAD joint names here with a real URDF or SDK joint list for Microduck / Reachy Mini.
