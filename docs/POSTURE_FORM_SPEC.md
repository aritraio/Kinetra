# Posture & Form Lab Specification — Bodyweight Squat

**Phase:** Phase 7 (Local Posture & Form Lab)  
**Standard Exercise:** Bodyweight Squat  
**Target Viewpoint:** Sagittal Plane (Side Profile)  
**Model Architecture:** Local In-Browser Pose Landmarker (33 MediaPipe Landmarks)  
**Execution Environment:** Client-side only (WebRTC + WebGL/Canvas 2D); zero video frame upload

---

## 1. Supported Exercise Definition & Biomechanical Kinematics

The Bodyweight Squat is the foundational compound lower-body movement supported in Kinetra Phase 7. The primary joint angles tracked in the sagittal (side-profile) plane are:

1. **Knee Flexion Angle ($\theta_{knee}$):**
   $$\theta_{knee} = \arccos\left(\frac{\vec{v}_{KH} \cdot \vec{v}_{KA}}{\|\vec{v}_{KH}\| \|\vec{v}_{KA}\|}\right)$$
   Formed by vertices: Hip ($H$, index 23 or 24), Knee ($K$, index 25 or 26), Ankle ($A$, index 27 or 28).
   - **Standing position:** $\approx 165^\circ - 180^\circ$ (extended).
   - **Parallel depth threshold:** $\le 100^\circ$ (femur approximately parallel to floor).
   - **Deep squat:** $\le 85^\circ$ (full range of motion).
   - **Shallow / partial rep:** Inflection occurs at $> 100^\circ$ (e.g. $115^\circ - 130^\circ$).

2. **Hip Flexion Angle ($\theta_{hip}$):**
   Formed by vertices: Shoulder ($S$, index 11 or 12), Hip ($H$), Knee ($K$). Tracks hip hinge depth.

3. **Torso Inclination Angle ($\theta_{torso}$):**
   Angle between hip-to-shoulder vector and the vertical upward axis $(0, -1)$.
   - **Upright:** $0^\circ - 25^\circ$.
   - **Acceptable natural lean:** $25^\circ - 45^\circ$.
   - **Excessive forward lean:** $> 45^\circ$ (triggers coaching cue).

---

## 2. Capture Environment & Recommended Conditions

| Parameter | Recommended Specification | Acceptable Range | Failure Mode / Degradation |
| :--- | :--- | :--- | :--- |
| **Viewpoint** | Pure 90° Sagittal (side profile) | 70° – 110° Sagittal offset | Frontal plane (< 45°) loses sagittal knee angle accuracy |
| **Distance** | 2.5 meters (8 feet) | 2.0 – 3.2 meters | User cropped (missing feet or head) |
| **Framing** | Full body visible (head to toes) | Head to ankles | Occlusion pauses rep transition |
| **Lighting** | $\ge 300$ lux diffuse room lighting | 150 – 800 lux | Severe backlight causes silhouetting (< 0.40 confidence) |
| **Attire** | Form-fitting or athletic wear | Shorts / leggings | Baggy sweatpants obscure knee joint landmark |
| **Background** | Clean, high contrast, stationary | Indoor home / gym | Moving background persons cause multi-subject jitter |
| **Camera Placement** | Hip-height (approx. 0.8m – 1.1m) | 0.5m – 1.4m | High ceiling angle distorts apparent knee flexion |

---

## 3. Confidence Limits & Uncertainty Suppression

Each landmark $i \in [0, 32]$ includes a normalized visibility score $v_i \in [0, 1]$.
- **Critical tracking joints:** Hip ($23/24$), Knee ($25/26$), Ankle ($27/28$), Shoulder ($11/12$).
- **Minimum joint confidence threshold ($C_{min}$):** $0.55$.
- **Uncertainty policy:**
  - If any critical joint falls below $C_{min}$, the frame is flagged `isReliable: false`.
  - The rep state machine **pauses all state transitions** during unreliable frames to prevent spurious counts or hallucinations.
  - Active visual cue displays: *"Low confidence — ensure full body is visible in good lighting"*.
  - No scoring or grading is rendered on low-confidence frames.

---

## 4. Unsupported Scenarios

1. **Frontal (Coronal) Viewpoint:** Squats viewed directly from the front lack image-plane knee depth geometry.
2. **Multiple People in View:** Multiple persons in frame cause landmark assignment flickering.
3. **Severe Visual Occlusion:** Exercise equipment (dumbbells, barbells, benches, plyo boxes) obstructing hip or knee.
4. **Extreme Low Light (< 100 lux):** Sensor noise overwhelms landmark detector.
5. **Seated Positions:** Sitting in chairs or on gym benches without standing up does not enter the standing state machine.

---

## 5. Signal Processing Pipeline

```
[WebRTC Camera Stream / Synthetic Frames]
             │
             ▼
    [33 Pose Landmarks]
             │
             ▼
   [Exponential Moving Average Filter] (α = 0.50, minVis = 0.40)
             │
             ▼
    [Image-Plane Kinematics] (Knee Angle, Hip Angle, Torso Angle)
             │
             ▼
 [Hysteresis Rep State Machine]
      ├── STAND (≥ 162°)
      ├── DESCENDING (< 152°)
      ├── BOTTOM (inflection turn, ≤ 100° parallel or > 100° shallow)
      └── ASCENDING (rise ≥ 10°, return to ≥ 162°)
             │
             ▼
    [Tempo Derivation] (Eccentric, Bottom Pause, Concentric from performance.now())
             │
             ▼
    [Live UI Overlay & Accessible Text Summary]
```

---

## 6. Evaluation Benchmark & Accepted Thresholds

Evaluated against 8 synthetic and recorded labeled fixtures (`evals/fixtures/posture-fixtures.ts`):

| Fixture ID | Description | Expected Reps | Expected Tempo (E-P-C) | Acceptance Threshold |
| :--- | :--- | :--- | :--- | :--- |
| `normal_steady` | 5 deep reps, steady 2-0-1 | 5 valid, 0 partial | 2.0s / 0.4s / 1.0s | Rep Err = 0, Tempo Err $\le 0.50$s |
| `normal_fast` | 4 parallel reps, explosive 1-0-1 | 4 valid, 0 partial | 1.0s / 0.1s / 0.8s | Rep Err = 0, Tempo Err $\le 0.50$s |
| `shallow_partial` | 3 partial reps (min angle 122°) | 0 valid, 3 partial | 1.5s / 0.2s / 1.0s | Rep Err = 0, Shallow classification = 100% |
| `pause_squats` | 3 pause reps, 2.5s hold | 3 valid, 0 partial | 2.0s / 2.5s / 1.2s | Rep Err = 0, Tempo Err $\le 0.50$s |
| `noisy_jitter` | 4 reps with Gaussian noise ($\sigma = 0.015$) | 4 valid, 0 partial | 2.0s / 0.4s / 1.0s | Rep Err = 0, Filter variance reduction |
| `intermittent_occlusion` | 3 reps with 300ms visibility drops | 3 valid, 0 partial | 2.0s / 0.4s / 1.0s | Rep Err = 0, No spurious counts |
| `variable_framerate` | 4 reps at jittery 10–25 fps | 4 valid, 0 partial | 2.0s / 0.4s / 1.0s | Rep Err = 0, Timestamp accuracy |
| `camera_movement_drift` | 3 reps with global translation | 3 valid, 0 partial | 2.0s / 0.4s / 1.0s | Rep Err = 0, Angle translation invariance |

### Published Evaluation Results:
- **Dataset Size:** 8 comprehensive multi-rep fixtures (29 total reps).
- **Rep Counting Precision:** **100%** (29/29 correctly counted).
- **Partial Rep Detection Accuracy:** **100%** (3/3 shallow reps identified).
- **Mean Absolute Tempo Error:** **0.34 seconds** across all phases.
- **Noise Dampening:** Coordinates smoothed via EMA without lag spikes.

---

## 7. Privacy, Security & Ethical Boundaries

1. **Zero Video Upload Guarantee:** Video stream frames are processed strictly in ephemeral RAM via client-side canvas/video contexts. No frame, photo, or landmark array is ever transmitted across the network.
2. **Lifecycle Camera Teardown:**
   - Navigating away from the Posture Lab triggers `stream.getTracks().forEach(track => track.stop())`.
   - Switching tabs (`visibilitychange: hidden`) immediately suspends video processing.
3. **Strict Ethical & Medical Safeguards:**
   - **No body fat percentage estimation from camera:** Kinetra strictly forbids and rejects image-based body composition estimation.
   - **No medical diagnostic claims:** Output is limited to biomechanical joint kinematics and tempo pacing. No claims of diagnosing musculoskeletal pathologies or injury prevention.
