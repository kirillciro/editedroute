# Map Screen Refactor Guide

This project’s map screen started as a single large file (`app/map.tsx`). To make it easier to maintain without changing behavior, the UI-heavy sections and pure helper logic have been extracted into focused modules.

## Goals

- Keep navigation behavior identical (camera feel, ETA updates, stops flow, debug unlock).
- Make `app/map.tsx` easier to scan by moving “pure UI” blocks into components.
- Centralize instruction parsing logic in a single utility module.
- Keep styling consistent while reducing file size.

## Current Structure

### Stateful controller

- `app/map.tsx`
  - Still owns all state, refs, subscriptions, and side effects (location tracking, sensor fusion, navigation camera loop, route calculation, etc.).
  - Wires the extracted components together by passing props/callbacks.

### Extracted UI components

These components are **presentational** (or nearly so). They render UI and call back into `MapScreen` via props.

- `components/map/MapSearchBar.tsx`
  - Google Places autocomplete search UI.
  - Props include `googleMapsApiKey`, `userLocation`, and the `searchRef`.

- `components/map/RightControls.tsx`
  - The right-side “button stack” (layers, traffic/buildings/compass toggles, debug button, recenter/overview, stats, stops, my-location).

- `components/map/CameraDebugPanel.tsx`
  - Debug overlay UI showing camera state snapshots and providing cycle/toggle controls.

- `components/map/StopsPanel.tsx`
  - Stops list panel (draggable ordering) and destination footer row.

- `components/map/InstructionPanel.tsx`
  - Turn-by-turn instruction UI (current step, next step preview, lane hint, speed + limit, ETA + distance, next-stop button).

- `components/map/MapCanvas.tsx`
  - Owns the `MapView` JSX: route polyline + user arrow marker + stop/destination markers.
  - Still receives all data/refs/callbacks from `MapScreen` (no subscriptions).

- `components/map/StartNavigationButton.tsx`
  - The large Start/Stop Navigation CTA button.

- `components/map/StageInfo.tsx`
  - Small dev-only “stage” overlay.

- `components/map/MapOverlayStack.tsx`
  - Composes the overlay UI (search, controls, panels) on top of the map.

### Extracted styles

- `components/map/mapScreen.styles.ts`
  - Shared `styles` used by `app/map.tsx` and the extracted map UI components.

### Extracted navigation helpers

- Pure helpers for parsing Google Directions instructions and inferring UI hints.
- Exports:
  - `cleanHtmlInstruction(html)`
  - `getStepManeuver(step)`
  - `inferLaneHint(maneuver, instructionText)`
  - `maneuverToIconName(maneuver, instructionText)`
  - `LaneHint` type
- Navigation math helpers (prediction, lerp, angle deltas, heading smoothing) are in `utils/navigation/math.ts`.
- Navigation camera helpers (look-ahead/offset) are in `utils/navigation/camera.ts`.
- Navigation bearing/pitch/zoom smoothing helpers (easing factors + scalar easing) are in `utils/navigation/cameraSmoothing.ts`.
- Navigation GPS tier helpers (cadence tuning) are in `utils/navigation/gpsTier.ts`.
- Dynamic ETA helpers (formatting + speed/ratio compute) are in `utils/navigation/eta.ts`.

### Extracted geo helpers

- `decodeGooglePolyline(encoded)` for Directions API `overview_polyline.points`.

- `utils/geo/geometry.ts`
  - Small, pure geometry helpers used by navigation logic:
    - `distanceMetersBetween(a, b)`
    - `closestPointOnSegmentMeters(p, a, b)`
    - `closestPointOnPolylineMeters(p, poly, indexHint)`

### Shared map-route types

- `types/mapRoute.ts`
  - `UserLocation`, `MapStop`, `MapDestination` used by `MapScreen` and map components.

## “Where do I change…”

- **Search behavior / UI**: `components/map/MapSearchBar.tsx`
- **Right-side buttons**: `components/map/RightControls.tsx`
- **Debug overlay content**: `components/map/CameraDebugPanel.tsx`
- **Stops panel UI**: `components/map/StopsPanel.tsx`
- **Turn-by-turn panel UI**: `components/map/InstructionPanel.tsx`
- **Instruction parsing / maneuver inference**: `utils/navigation/instructions.ts`
- **Location/sensors/navigation logic** (the “brains”): `app/map.tsx`

## Notes

### Google Maps API key resolution (archive-safe)

`app/map.tsx` resolves the key in a way that works for local dev **and** archived/TestFlight builds:

- Prefers `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Falls back to native Expo config (`ios.config.googleMapsApiKey` or `android.config.googleMaps.apiKey`)
- Optionally falls back to `extra.googleMapsApiKey`

This prevents the common “works in dev, fails in archive” issue when env vars aren’t bundled.

### Refactor rule of thumb

If a block:

- mostly returns JSX,
- doesn’t own subscriptions/timers,
- and can be described as “UI for X”,

…it belongs in `components/map/*`.

If it:

- parses text,
- maps directions → UI hints,
- or is stateless math,

…it belongs in `utils/*`.
