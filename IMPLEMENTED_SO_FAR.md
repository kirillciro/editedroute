# EditedRoute — Implemented So Far (Study Notes)

This file is a compact “what we built” guide so you can quickly understand the navigation/map system, debug tools, and build workflow.

## Where To Look

- Main map + navigation screen: [app/map.tsx](app/map.tsx)
- App configuration (version/build, native keys): [app.json](app.json)
- iOS native workspace (Archive/TestFlight): [ios/EditedRoute.xcworkspace](ios/EditedRoute.xcworkspace)
- Android native config (versionName/versionCode, build): [android/app/build.gradle](android/app/build.gradle)

## Navigation UX (Google-like)

### Turn-by-turn banner

Implemented a Google Maps–style instruction header with:

- Current maneuver icon + primary instruction text
- Distance to next maneuver
- “Then …” next-step preview
- Lane hint strip (simple inferred lane guidance)

Key functions:

- Maneuver inference from text: `inferManeuverFromInstruction(...)`
- Maneuver → icon mapping: `maneuverToIconName(...)`
- Central “update UI from step index” function: `applyTurnByTurnUiFromIndex(idx)`

### Route fetching (Directions API)

The app calls Directions via HTTP and decodes polylines into `routeCoordinates`.

- The key is referenced as `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Directions request URL is built in `calculateRoute(...)`.

Important cost note:

- Because the Directions call is client-side, the key is effectively public in the app and can be abused if not restricted (and quota caps can still be expensive).

## Marker + Camera Smoothing (Google-style pipeline)

### Smooth navigation marker

Goal: GPS updates set a target; a 60fps render loop interpolates the on-screen marker smoothly.

- Target state: `navTarget`
- Smoothed state: `navCurrent`
- Render loop: `startNavRenderLoop()`
- Marker uses `Marker.Animated` + `AnimatedRegion`.

Smoothing knobs:

- Marker “time constant”: `NAV_RENDER_TAU_SECONDS` (currently `0.12`)
- Prediction based on speed: `computeNavPredictSeconds(speedMps)`
- Prediction applied by `applyPrediction(anchor, heading, speed, seconds)`

### Camera follow modes

Navigation camera modes:

- `follow`: camera follows marker + heading
- `free`: user dragged/panned; camera stops following until recenter
- `overview`: overview camera (fit route)

The camera logic avoids fighting animations by:

- Holding the follow loop during critical animations (`navCameraHoldUntilRef`)
- Driving camera from a single “target → smoothing → apply” approach

### GPS cadence tiers

To keep UI smooth without over-updating GPS:

- Tiered `watchPosition` options via `navGpsOptionsForTier(tier)`
- Tier chosen by `pickNavGpsTier(speed, currentTier)`

## Debug & Testing Tools (works in Archive/TestFlight builds)

### DBG button

The DBG button is visible in release builds and is used for on-device tuning.

- On first tap (if locked), it unlocks the debug panel.
- You can also long-press the Layers button to unlock.

Where:

- Right-side controls + DBG toggle are in the JSX section of [app/map.tsx](app/map.tsx).

### Camera Debug Panel

The panel shows live camera/target/applied values and exposes quick A/B controls:

- Apply mode cycling: `auto`, `setCamera`, `animate0`, `animate160`
- Preset cycling: `balanced`, `smooth`, `snappy`
- Layer/overlay toggles inside panel

This enables “Google-level feel” tuning on a physical device without rebuilding.

### Why `auto + snappy` usually feels best

Your result makes sense with how `react-native-maps` camera APIs behave:

- `animate0` / `animate160` force frequent `animateCamera(...)` calls. When you call `animateCamera` again before the prior animation fully settles, the native map will cancel/retarget the animation. With noisy GPS + heading updates, that cancellation/retarget cycle looks like micro-jumps/jitter.
- `auto` chooses the least-jittery application strategy based on the size of the change (and the follow-loop’s “don’t fight animations” rules): it will effectively behave more like a controlled `setCamera` for tiny continuous corrections and reserve longer animations for bigger intentional moves.
- `snappy` uses tighter smoothing (lower lag) so the camera/marker stays close to the true target. That reduces the “overshoot then correct” behavior that can happen with very smooth presets when the target is moving quickly (car driving) and heading is slightly noisy.

Net effect: `auto + snappy` avoids overlapping animations _and_ reduces the error between “target camera” and “applied camera”, which is exactly where the visible jitter comes from.

## Layers / Overlays

Added Google Maps-style toggles:

- `mapType`: standard/satellite/hybrid (+ terrain on Android)
- `showsTraffic`, `showsBuildings`, `showsIndoors`, `showsCompass`

Buttons:

- Layers button cycles map type.
- Overlay buttons appear after debug unlock.

## UI Polish Adjustments

- Navigation marker size increased:
  - Marker container: `60x60` with border
  - Arrow icon size: `44`

## Build & Release Workflow (TestFlight / Archive)

### Versioning

Currently aligned to:

- Marketing version: `41.0.0`
- Build number: `41`

You can verify in:

- [app.json](app.json) (Expo version/build)
- [ios/EditedRoute/Info.plist](ios/EditedRoute/Info.plist) (`CFBundleShortVersionString`, `CFBundleVersion`)
- [ios/EditedRoute.xcodeproj/project.pbxproj](ios/EditedRoute.xcodeproj/project.pbxproj) (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`)
- [android/app/build.gradle](android/app/build.gradle) (`versionName`, `versionCode`)

### Prebuild

We run prebuild to keep native projects in sync:

- `npx expo prebuild --platform ios`
- `cd ios && npx pod-install`

### Archive

Open iOS workspace and archive:

- [ios/EditedRoute.xcworkspace](ios/EditedRoute.xcworkspace)

## Known Next Improvements (if you want “even more Google”)

High-value next steps:

- Move Directions requests to a backend (protect the key, add caching/rate limits).
- Add route snapping/map matching improvements (stronger “on road” feel).
- Make the debug tools hidden behind a secret gesture (if you don’t want DBG visible in production).
