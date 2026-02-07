# CEO-Facing Technical Architecture Profile — Kirill Strunkov

I’m a senior full‑stack engineer with a strong technical‑architecture focus. I design and deliver production systems that balance user experience, scalability, security, and speed of execution—then I own them through release, monitoring, and iteration.

## What I built (EditedRoute — navigation/map product)

In EditedRoute, I led the technical design and implementation of a Google‑Maps‑like navigation experience, with an emphasis on real‑world device behavior and production readiness:

- **Navigation architecture (end‑to‑end)**: route fetching and polyline decoding, turn‑by‑turn instruction pipeline, dynamic ETA updates, and a stateful navigation controller that drives UI and map behavior.
- **Real-time rendering pipeline**: designed a “target → smoothing → apply” loop to keep the navigation marker and camera stable at 60fps despite noisy GPS/heading updates.
- **Camera system design**: implemented clear camera modes (follow/free/overview) with rules to prevent the common jitter caused by overlapping animations and continuous retargeting.
- **Performance and correctness**: introduced precomputed cumulative polyline distances + windowed nearest‑point lookup to compute remaining distance/ETA efficiently during navigation.
- **Production-ready debugging**: built an on-device debug panel (available even in Archive/TestFlight builds) to tune camera/marker behavior, validate ETA logic, and reduce iteration time without rebuild cycles.
- **Maintainable structure**: refactored a large map screen into focused modules—UI components, navigation helpers, geo utilities, and shared types—while preserving behavior.

## How I approach architecture

- **System thinking**: start from user workflows and constraints (mobile GPS noise, animation behavior, battery/keep-awake) and translate them into a stable technical design.
- **Clear boundaries**: define ownership between controller logic, presentational UI, and pure utilities so the codebase scales with team size.
- **Risk management**: de-risk complex areas with measurable knobs, instrumentation, and safe fallbacks (e.g., speed-based ETA with ratio fallback).
- **Operational readiness**: prioritize release-safe configuration, debuggability on real devices, and predictable behavior across dev builds and store builds.

## Tooling & execution

- TypeScript-first engineering, strong refactoring discipline, linting/typecheck gates, and pragmatic testing strategy.
- API integration experience (e.g., Directions/Places), key management awareness, and cost/safety considerations (quota + restrictions).
- Comfortable owning delivery: planning, implementation, release workflow, and ongoing improvements.

## Additional skills

- **Meta platforms**: expert with Meta Business Suite / Ads Manager workflows (campaign setup, optimization, reporting).
- **Adobe**: professional proficiency with Adobe Photoshop, Illustrator, and Animate.

## Links

- LinkedIn: https://www.linkedin.com/in/kirill-strunkov-93366324b/
- GitHub: https://github.com/kirillciro
