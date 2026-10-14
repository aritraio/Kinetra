# Post-v1 Backlog & Future Vision — Kinetra v2.0+

**Document Status:** ACTIVE NEXT-RELEASE BACKLOG  
**Date:** 2026-10-10  
**Context:** Shipped with Kinetra v1.0.0 General Availability.  
**Purpose:** Formally separates intentional v1 exclusions and future enhancements from release-blocking v1 invariants.

---

## 1. Intentional v1 Exclusions (Bounded Scope)

To maintain uncompromising reliability, security, and mathematical verification in v1, the following features were intentionally excluded from initial scope:

| Feature / Domain | Why Excluded from v1 | Scheduled Target |
| :--- | :--- | :--- |
| **Bluetooth Low Energy (BLE) Peripherals** | Requires Web Bluetooth API which has fragmented iOS/WebKit browser support. | v2.1 |
| **Native iOS & Android App Store Binaries** | Web PWA delivers 100% offline functionality, local IndexedDB caching, and responsive mobile ergonomics without app store gatekeeper latency. | v2.2 |
| **Multi-Tenant Gym / Coach Billing Platform** | v1 focuses exclusively on individual athletes and peer-reviewed sports science verification. Commercial SaaS billing introduces complex financial compliance. | v2.3 |
| **3D Volumetric Skeletal Mesh Reconstruction** | Current MediaPipe 2D landmark geometry delivers sub-degree joint angle precision at 60 FPS without high-end mobile GPU throttling. | v2.2 |
| **Commercial Barcode Scanner & UPC Database** | Commercial nutrition databases (e.g., Nutritionix/FatSecret) introduce costly external API dependencies; USDA FoodData Central provides audited canonical macronutrient provenance for v1. | v2.1 |
| **Longitudinal Real-World Clinical Study** | Requires multi-month IRB review and longitudinal adherence tracking; synthetic benchmark corpus ($N=44$ profiles) provides reproducible mathematical evaluation for v1. | v2.0 Study |

---

## 2. Prioritized v2 Roadmap Backlog

### Milestone v2.1: Wearable Telemetry & Expanded Food Catalogs
- **Item 2.1-01**: Web Bluetooth API integration for Polar/Garmin heart rate monitors.
- **Item 2.1-02**: Barcode camera scanner for instant packaged grocery lookup via Open Food Facts API.
- **Item 2.1-03**: Support for custom macro cycling protocols (carb cycling, refeed days, intermittent fasting schedules).

### Milestone v2.2: Advanced Biomechanics & Mobile Packaging
- **Item 2.2-01**: Multi-exercise form tracking: Barbell Deadlift (lumbar spine neutral angle), Barbell Overhead Press, Bench Press bar path tracking.
- **Item 2.2-02**: Capacitor mobile app wrapper for App Store & Google Play distribution with biometric FaceID unlock.
- **Item 2.2-03**: Velocity-Based Training (VBT) barbell bar speed tracking using optical flow.

### Milestone v2.3: Team Gyms & Collaborative Coaching
- **Item 2.3-01**: Coach portal with read-only client adherence telemetry and permission-granted plan assignment.
- **Item 2.3-02**: Team workout leaderboards with privacy-preserving opt-in pseudonymization.
- **Item 2.3-03**: Export to Apple HealthKit and Google Health Connect.
