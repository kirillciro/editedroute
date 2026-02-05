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

### New debug readouts (for ETA testing)

Inside the Camera Debug panel, there is now a line like:

`rem: 12.3km | eta: 29m (speed)`

Meaning:

- `rem` = estimated remaining route distance along the current route polyline.
- `eta` = the dynamic ETA computed from `rem`.
- `(speed)` = ETA computed from your real GPS speed (best when moving).
- `(ratio)` = fallback ETA computed by scaling the initial route duration by your remaining-distance ratio (useful when GPS speed is zero/noisy).

### Why `auto + snappy` usually feels best

Problem you saw:

- After a few minutes of driving without touching the screen, iOS/Android will dim and eventually lock the display (normal OS behavior).

Fix:

- We enable keep-awake only while navigation is active, using `expo-keep-awake`.
- The app calls `activateKeepAwakeAsync("EditedRouteNavigation")` when `isNavigating && appState === "active"`.
- It calls `deactivateKeepAwake(...)` when navigation stops or the app backgrounds.

Why this is the correct approach:

- It avoids burning battery all the time; it only blocks sleep during turn-by-turn.
- It keeps behavior consistent across Debug/Release/TestFlight builds.

Problem you saw:

- ETA was calculated once (from Directions response) and stayed constant (e.g., always “31 min”), even though you were progressing.

What we implemented:

- ETA now updates every second during navigation.
- It estimates remaining route distance along the decoded route polyline, then converts that into remaining time.

### How remaining distance is computed

1. When `routeCoordinates` is set, we precompute a cumulative-distance array:

- `cumulative[i]` = total meters from the start of the polyline to point `i`.
- This makes “distance remaining” fast at runtime.

2. Each second during navigation:

- Take the current user location.
- Find the closest point on the route polyline (windowed search around the last best index for speed).
- Compute `alongMeters = cumulative[index] + distance(segmentStart -> closestPoint)`.
- Compute `remainingMeters = totalMeters - alongMeters`.

### How ETA is computed

Each update tick chooses the best available source:

- **Speed-based (preferred while moving)**
  - If `speedMps >= 1.5`, compute `etaSeconds = remainingMeters / speedMps`.
  - This makes ETA react to your real pace (traffic, faster/slower driving).

- **Ratio fallback (useful if GPS speed is unreliable)**
  - If speed is too low/noisy but we have `routeTotalDurationSec`, compute:
    - `etaSeconds = routeTotalDurationSec * (remainingMeters / totalMeters)`
  - This keeps ETA decreasing even if the device reports `speed=0` momentarily.

We only update the visible ETA when the rounded minute value changes, so the UI doesn’t flicker.

### Why this matches Google Maps behavior

Google’s ETA is fundamentally “remaining time”, not “original duration”. As you progress, remaining distance drops; if your speed stays similar, remaining time drops too.

We’re doing the same shape of computation locally:

- remaining distance from polyline progress
- divided by speed (or a stable fallback)

## What Else To Test (quick checklist)

- **ETA countdown**: verify it decreases 1 minute at a time.
- **Stoplights / low speed**: confirm it switches between `(speed)` and `(ratio)` without wild jumps.
- **Off-route**: intentionally deviate and confirm ETA/route recalculation stays stable and doesn’t spam Directions.
- **Background/resume**: lock/unlock; navigation should resume without huge camera jumps.
- **Apply modes**: compare `auto+snappy` vs `animate160` now that overlap is prevented.

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
