# Kinetra Adaptive Progression Policy Specification

Version: **`2026-10-01`**  
Status: **Approved & Domain Reviewed**  
Classification: **Core Domain Specification**

---

## 1. Executive Summary & Core Philosophy

Kinetra's Adaptive Progression Engine generates conservative, explainable, and reviewable resistance training plan adjustments. Rather than relying on non-deterministic Large Language Models (LLMs) to invent numerical load prescriptions, Kinetra operates a **pure, deterministic rule engine grounded in established exercise science and autoregulation literature** (Zourdos et al., 2016; Helms et al., 2018; Schoenfeld et al., 2021).

### Core Principles
1. **Conservative Safety-First Bias:** Progress is earned through documented consistency and manageable perceived exertion. When data is ambiguous, incomplete, or borderline, the engine defaults to **maintaining** the current load.
2. **Zero Hallucinated Numbers:** All numeric adjustments (load deltas, rep shifts, set adjustments) are calculated via deterministic pure functions. No LLM participates in calculating or generating load values.
3. **Total Explainability:** Every proposed adjustment is accompanied by a human-readable justification, empirical evidence summary (sessions analyzed, date window, average RPE, completion rate), and a confidence score ($0.0–1.0$).
4. **User Sovereignty:** Proposed adjustments are strictly advisory. Users review each exercise adjustment individually, retain the right to accept or reject proposals, and accepting a proposal creates a **new immutable plan version**, preserving full historical provenance.
5. **No Forced Adjustments on Insufficient Data:** The engine explicitly refuses to progress or alter exercises when historical training data fails to meet minimum observation thresholds.

---

## 2. Required Training History & Observation Window

To prevent volatile oscillations based on transient day-to-day fluctuations (e.g., poor sleep or temporary fatigue), the progression engine enforces strict observation windows:

| Parameter | Standard | Rationale |
| :--- | :--- | :--- |
| **Lookback Window** | **28 Days** | Captures 2–4 typical microcycles without stale data from distant phases. |
| **Minimum Required Sessions** | **$\ge 2$ Completed Sessions** | A single session is insufficient to confirm genuine adaptation vs. an outlier good day. |
| **Minimum Valid Sets** | **$\ge 2$ Valid Sets / Session** | Casual warmups or incomplete single sets are discarded from progression scoring. |
| **Handling Inadequate Data** | **`insufficient_data` Action** | Load delta $= 0$, confidence $\le 0.20$, explicit notification explaining that more data is required. |

---

## 3. Effort Scale & Autoregulation (RPE / RIR)

Kinetra utilizes the **Borg CR10 Rating of Perceived Exertion (RPE)** scale, mapped to **Reps in Reserve (RIR)**:
$$\text{RIR} = 10 - \text{RPE}$$

### Exertion Bands & Action Thresholds
- **Ready for Overload ($\text{Avg RPE} \le 7.5$ or top of rep range hit at $\text{RPE} \le 8.0$):**  
  The lifter has $\ge 2.5$ reps in reserve on all working sets with $\ge 95\%$ prescribed volume completed. Neuromuscular adaptation is consolidated. **Action: Conservative Progression.**
- **Stimulative Maintenance ($7.5 < \text{Avg RPE} \le 9.0$):**  
  The current load is exerting appropriate hypertrophic stimulus ($1.0–2.5$ RIR). **Action: Maintain current load.**
- **Over-reaching / High Strain ($\text{Avg RPE} > 9.0$ or set failure):**  
  The lifter is training near or at muscular failure ($< 1$ RIR). Advancing load would heighten injury risk and technique breakdown. **Action: Maintain or Deload.**
- **Excessive Strain / Volume Failure ($\text{Avg RPE} \ge 9.5$ or completion $< 70\%$):**  
  Technique compromise or inability to complete prescribed volume. **Action: Reactive Deload ($-5\%$ to $-10\%$).**

---

## 4. Missed Sessions & Inactivity Handling

Life events, travel, and illness cause training interruptions. The engine handles gaps conservatively:

| Inactivity Gap | Classification | Prescribed Engine Response | Rationale |
| :--- | :--- | :--- | :--- |
| **$0 - 7$ Days** | **Normal Cadence** | Standard evaluation based on performance and RPE. | Routine microcycle pacing. |
| **$8 - 14$ Days** | **Minor Gap (1–2 weeks)** | **Maintain Load (Hold)** | Even with prior strong performance, holding load re-establishes cadence without acute injury risk. |
| **$15 - 28$ Days** | **Extended Hiatus (2–4 weeks)** | **Re-acclimatization Deload ($-10\%$)** | Mitigates delayed-onset muscle soreness (DOMS) and loss of neuromuscular coordination. |
| **$> 28$ Days** | **Detraining Hiatus (> 1 month)** | **Detraining Reset ($-15\%$ to $-20\%$)** | Safely eases the lifter back after systemic strength and work capacity reduction. |

---

## 5. Plateau Detection & Deload Criteria

A **Plateau** is defined as:
- $\ge 3$ consecutive sessions of the same exercise where:
  1. The prescribed load has not advanced, AND
  2. The upper bound of the target rep range was not achieved, AND
  3. Average working set $\text{RPE} \ge 8.5$ across all sessions (or sets were missed due to fatigue).

### Engine Plateau Response:
- **Scheduled Deload:** Reduce prescribed load by **$10\%$** (rounded to standard gym increments).
- **Explanation:** *"Plateau detected across 3 sessions at elevated exertion ($\text{RPE} \ge 8.5$). A 10% deload allows systemic neuromuscular recovery, joint relief, and supercompensation."*
- **Reset Volume:** Maintain target sets to preserve motor patterns while dropping mechanical fatigue.

---

## 6. Progression & Deload Bounding Rules

All numeric load changes are strictly bounded by movement archetype and available equipment increments:

### Maximum Progression Caps (Per Adjustment Cycle)
- **Lower Body Compound** (Squats, Deadlifts, Leg Press):  
  $\text{Max Increase} = +5.0\text{ kg} \text{ (+10 lb)}$ or $+5\%$, whichever is smaller.
- **Upper Body Compound** (Bench Press, Overhead Press, Rows):  
  $\text{Max Increase} = +2.5\text{ kg} \text{ (+5 lb)}$ or $+5\%$, whichever is smaller.
- **Isolation & Accessory Movements** (Biceps Curls, Lateral Raises, Triceps Extensions):  
  $\text{Max Increase} = +1.25\text{ to }+2.5\text{ kg} \text{ (+2.5 to +5 lb)}$, OR $+1–2\text{ reps}$ per set.
- **Bodyweight Exercises** (Push-ups, Pull-ups, Dips):  
  Progress via reps ($+1–2$ reps/set) up to maximum rep threshold before adding external load.

### Absolute Safety Boundaries
1. **Hard Upper Ceiling:** No exercise load may increase by more than **$+10\%$** in a single adjustment cycle, regardless of how easily previous sets were logged.
2. **Hard Floor:** Prescribed loads cannot drop below **$0\text{ kg}$** (bodyweight baseline) or below minimum equipment plate increments.
3. **Plate Rounding Increments:**  
   - Barbell exercises: Rounded to the nearest **$1.25\text{ kg}$** (metric) or **$2.5\text{ lb}$** (imperial).
   - Dumbbell / Cable exercises: Rounded to the nearest **$1.0\text{ kg}$** or **$2.5\text{ lb}$**.

---

## 7. Excluded Populations & Mandatory Safety Halts

The progression engine incorporates mandatory guardrails that immediately halt automated load increases:

1. **Pain or Discomfort Flag (Safety Halt):**  
   If session notes or exercise logs contain indicators of pain, joint strain, twinges, or injury (e.g., *"sharp knee pain"*, *"shoulder twinge"*):  
   - Automated progression is immediately **blocked**.  
   - Load is held at current value or reduced.  
   - A high-visibility safety alert warns the user and recommends consultation with a medical or physical therapy professional.
2. **Novice Consolidation Window (< 14 Days):**  
   Lifters in their first two weeks of a routine are undergoing neuromuscular learning and motor unit recruitment. Automated weight spikes are suppressed in favor of linear habit formation.
3. **Severe Caloric Deficit or Illness:**  
   If profile notes or logs indicate severe deficit ($> 500\text{ kcal}$) or acute illness, progression is conservative (maintenance emphasized).
4. **Corrupted or Conflicting Log Data:**  
   Logs with physically impossible metrics (e.g., negative weight, $> 100$ reps in a single set, or contradicting failure flags) are flagged, excluded from averaging, and produce a maintenance recommendation with a diagnostic warning.

---

## 8. Domain Review & Evidence Citations

- **Helms, E. R., et al. (2018):** *"Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training."* Strength & Conditioning Journal.
- **Zourdos, M. C., et al. (2016):** *"Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve."* Journal of Strength and Conditioning Research.
- **Schoenfeld, B. J., et al. (2021):** *"Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum."* Sports (Basel).
- **Israetel, M., et al. (2020):** *"Scientific Principles of Hypertrophy Training."* Renaissance Periodization.
