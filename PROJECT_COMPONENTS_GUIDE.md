# Project Components Guide (Study Catalog)

This file is a “map of the codebase” so you can study each piece in isolation.

- **Routing/screens live under** [`app/`](app/)
- **Reusable map UI components live under** [`components/map/`](components/map/)
- **Extracted map-screen logic lives under** [`features/map/hooks/`](features/map/hooks/) and [`features/map/helpers/`](features/map/helpers/)
- **Shared pure utilities live under** [`utils/`](utils/)
- **Shared domain types live under** [`types/`](types/)

## 1) App routing & screens (Expo Router)

Entry points:

- [`app/_layout.tsx`](app/_layout.tsx): Root navigator/layout for the app.
- [`app/index.tsx`](app/index.tsx): App entry route.

Auth group:

- [`app/(auth)/_layout.tsx`](<app/(auth)/_layout.tsx>): Layout for auth routes.
- [`app/(auth)/index.tsx`](<app/(auth)/index.tsx>): Auth landing screen.

Main group:

- [`app/(main)/_layout.tsx`](<app/(main)/_layout.tsx>): Layout for main (signed-in) routes.
- [`app/(main)/index.tsx`](<app/(main)/index.tsx>): Main landing screen.
- [`app/(main)/profile.tsx`](<app/(main)/profile.tsx>): Profile screen.
- [`app/(main)/stats.tsx`](<app/(main)/stats.tsx>): Stats screen (also opened via map overlay).
- [`app/(main)/stops.tsx`](<app/(main)/stops.tsx>): Stops management screen.

Navigation group:

- [`app/(nav)/_layout.tsx`](<app/(nav)/_layout.tsx>): Layout for navigation-specific routes.
- [`app/(nav)/drive/index.tsx`](<app/(nav)/drive/index.tsx>): Drive mode screen/route.

Primary map screen:

- [`app/map.tsx`](app/map.tsx): The main “Google Maps-style” map + navigation screen.
  - Owns the screen’s state and wires together extracted hooks + UI components.
  - Keeps behavior stable while delegating most logic to `features/map/hooks/*`.

## 2) Map UI components (`components/map/*`)

These are mostly presentational and take data/callbacks via props.

- [`components/map/MapCanvas.tsx`](components/map/MapCanvas.tsx)
  - Renders the `MapView` plus markers + route polyline.
  - Receives refs/data (doesn’t own navigation subscriptions).

- [`components/map/MapOverlayStack.tsx`](components/map/MapOverlayStack.tsx)
  - Composes the overlay UI on top of the map (search bar, controls, panels).

- [`components/map/MapSearchBar.tsx`](components/map/MapSearchBar.tsx)
  - Google Places autocomplete search UI.

- [`components/map/RightControls.tsx`](components/map/RightControls.tsx)
  - The right-side control stack (layers, recenter/overview, debug, stats, stops, my-location).

- [`components/map/StopsPanel.tsx`](components/map/StopsPanel.tsx)
  - Stops list panel (includes drag/reorder) + destination row actions.

- [`components/map/InstructionPanel.tsx`](components/map/InstructionPanel.tsx)
  - Turn-by-turn UI: current instruction + next step preview + lane hints + ETA/distance.

- [`components/map/StartNavigationButton.tsx`](components/map/StartNavigationButton.tsx)
  - “Start navigation” CTA.

- [`components/map/CameraDebugPanel.tsx`](components/map/CameraDebugPanel.tsx)
  - Debug overlay UI for camera tuning and state inspection.

- [`components/map/StageInfo.tsx`](components/map/StageInfo.tsx)
  - Dev-only stage/status overlay.

- [`components/map/mapScreen.styles.ts`](components/map/mapScreen.styles.ts)
  - Shared styles for the map screen + map UI components.

## 3) Map feature hooks (`features/map/hooks/*`)

These hooks exist to keep [`app/map.tsx`](app/map.tsx) small and readable without changing behavior.

### Screen lifecycle & orchestration

- [`features/map/hooks/useNavigationLifecycle.ts`](features/map/hooks/useNavigationLifecycle.ts)
  - Encapsulates start/stop navigation lifecycle: subscriptions, timers, state resets.

- [`features/map/hooks/useStopsAndDestinationActions.ts`](features/map/hooks/useStopsAndDestinationActions.ts)
  - Encapsulates “place selected → destination/stops updates → (re)route planning”.

- [`features/map/hooks/useRoutePlanning.ts`](features/map/hooks/useRoutePlanning.ts)
  - Calls Directions API, decodes polyline, updates route + steps + ETA text.

- [`features/map/hooks/useResetRouteState.ts`](features/map/hooks/useResetRouteState.ts)
  - Central “reset everything back to planning mode” helper.

### Camera, marker smoothing, and nav view modes

- [`features/map/hooks/useNavViewMode.ts`](features/map/hooks/useNavViewMode.ts)
  - Manages `follow/free/overview` camera view mode.

- [`features/map/hooks/useNavMarkerSmoothingLoop.ts`](features/map/hooks/useNavMarkerSmoothingLoop.ts)
  - 60fps loop smoothing the nav marker (`navTarget → navCurrent`).

- [`features/map/hooks/useNavCameraFollowLoop.ts`](features/map/hooks/useNavCameraFollowLoop.ts)
  - Continuous camera-follow loop driven by refs (avoids “camera fights”).

- [`features/map/hooks/useEnterNavigationCameraFix.ts`](features/map/hooks/useEnterNavigationCameraFix.ts)
  - One-shot “enter navigation” camera animation (look-ahead + seeding applied camera state).

- [`features/map/hooks/useNavigationZoomSmoothing.ts`](features/map/hooks/useNavigationZoomSmoothing.ts)
  - Smoothly adjusts zoom as speed/turn distance changes.

- [`features/map/hooks/useCameraBearingSmoothing.ts`](features/map/hooks/useCameraBearingSmoothing.ts)
  - Smooths camera bearing from heading.

- [`features/map/hooks/useDynamicCameraPitch.ts`](features/map/hooks/useDynamicCameraPitch.ts)
  - Adjusts pitch dynamically during navigation.

- [`features/map/hooks/useCameraApplyMode.ts`](features/map/hooks/useCameraApplyMode.ts)
  - Manages the “apply mode” used when applying camera changes.

- [`features/map/hooks/useCameraTuningPreset.ts`](features/map/hooks/useCameraTuningPreset.ts)
  - Preset tuning for camera smoothing.

### ETA / remaining route progress

- [`features/map/hooks/useRemainingRouteMeters.ts`](features/map/hooks/useRemainingRouteMeters.ts)
  - Computes remaining route meters along the polyline.

- [`features/map/hooks/useRoutePolylineMetrics.ts`](features/map/hooks/useRoutePolylineMetrics.ts)
  - Precomputes cumulative polyline distances + tracking indices for fast runtime lookup.

- [`features/map/hooks/useDynamicEta.ts`](features/map/hooks/useDynamicEta.ts)
  - Computes a dynamic ETA during navigation and updates the UI text.

### Debug UI + snapshots

- [`features/map/hooks/useCameraDebugUi.ts`](features/map/hooks/useCameraDebugUi.ts)
  - Debug overlay visibility + unlock behavior.

- [`features/map/hooks/useCameraDebugUnlock.ts`](features/map/hooks/useCameraDebugUnlock.ts)
  - Helper for on-device debug unlock gesture.

- [`features/map/hooks/useCameraDebugSnapshot.ts`](features/map/hooks/useCameraDebugSnapshot.ts)
  - Captures snapshots of internal camera/nav state for the debug panel.

### Overlay UI actions and map layers

- [`features/map/hooks/useMapOverlayActions.ts`](features/map/hooks/useMapOverlayActions.ts)
  - Stable callbacks used by `MapOverlayStack` (debug toggle, layer toggles, stats navigation, etc.).

- [`features/map/hooks/useMapLayers.ts`](features/map/hooks/useMapLayers.ts)
  - Manages map layer state: map type, traffic/buildings/indoors/compass.

### Location/sensors utilities

- [`features/map/hooks/useMyLocationAction.ts`](features/map/hooks/useMyLocationAction.ts)
  - “My location” button behavior.

- [`features/map/hooks/useSmoothedHeadingInterpolation.ts`](features/map/hooks/useSmoothedHeadingInterpolation.ts)
  - Smooth heading interpolation from raw sensor heading.

- [`features/map/hooks/useCenterMapOnUserOnMount.ts`](features/map/hooks/useCenterMapOnUserOnMount.ts)
  - One-time mount effect to center on user.

### App state / device behavior

- [`features/map/hooks/useAppStateTracking.ts`](features/map/hooks/useAppStateTracking.ts)
  - Tracks foreground/background transitions.

- [`features/map/hooks/useNavigationKeepAwake.ts`](features/map/hooks/useNavigationKeepAwake.ts)
  - Keeps the device awake only while navigating.

### Refs & ergonomics

- [`features/map/hooks/useSyncedRef.ts`](features/map/hooks/useSyncedRef.ts)
  - Keeps a ref in sync with state (for RAF loops / subscriptions).

- [`features/map/hooks/useNavigationRefs.ts`](features/map/hooks/useNavigationRefs.ts)
  - Groups the “navigation engine” refs (camera smoothing, marker smoothing, ETA refs, off-route guards, etc.).

- [`features/map/hooks/useNavigationRuntimeRefs.ts`](features/map/hooks/useNavigationRuntimeRefs.ts)
  - Groups runtime refs like `navigationSteps`, subscriptions, calibration refs, `routePoints`.

### Turn-by-turn UI

- [`features/map/hooks/useTurnByTurnUi.ts`](features/map/hooks/useTurnByTurnUi.ts)
  - Applies “current/next instruction” state from a step index.

### API keys

- [`features/map/hooks/useGoogleMapsApiKey.ts`](features/map/hooks/useGoogleMapsApiKey.ts)
  - Resolves Google Maps API key in a build-safe way.

## 4) Map helpers (`features/map/helpers/*`)

- [`features/map/helpers/place.ts`](features/map/helpers/place.ts)
  - Helpers for Google Places details: parsing lat/lng + user-facing descriptions.

## 5) Context providers (`context/*`)

- [`context/StopsContext.tsx`](context/StopsContext.tsx)
  - Shared state/provider for stops-related screens.

- [`context/ThemeContext.tsx`](context/ThemeContext.tsx)
  - Theme state/provider.

## 6) Shared types (`types/*`)

- [`types/mapRoute.ts`](types/mapRoute.ts)
  - `UserLocation`, `MapStop`, `MapDestination`.

- [`types/mapUi.ts`](types/mapUi.ts)
  - UI types like `NavViewMode`, `CameraApplyMode`, `CameraTuningPreset`, `MapLayerType`.

- [`types/googleDirections.ts`](types/googleDirections.ts)
  - Types for Directions API responses/steps.

- [`types/googlePlaces.ts`](types/googlePlaces.ts)
  - Types for Places API responses.

- [`types/navigation.ts`](types/navigation.ts)
  - Navigation-related shared types.

## 7) Shared utilities (`utils/*`)

### Geometry / polylines (`utils/geo/*`)

- [`utils/geo/geometry.ts`](utils/geo/geometry.ts)
  - Distance + closest-point computations.

- [`utils/geo/googlePolyline.ts`](utils/geo/googlePolyline.ts)
  - Polyline decoding.

- [`utils/geo/polylineCumulative.ts`](utils/geo/polylineCumulative.ts)
  - Cumulative distance arrays for route polylines.

### Location utilities (`utils/location/*`)

- [`utils/location/centerOnUserOnce.ts`](utils/location/centerOnUserOnce.ts)
  - The underlying “center map on user” helper.

- [`utils/location/applyLocationToMap.ts`](utils/location/applyLocationToMap.ts)
  - Helper for applying a location update to map state.

- [`utils/location/myLocation.ts`](utils/location/myLocation.ts)
  - Location convenience helpers.

### Navigation engine (`utils/navigation/*`)

These are pure-ish building blocks used by the extracted hooks.

Camera & motion:

- [`utils/navigation/camera.ts`](utils/navigation/camera.ts): look-ahead + coordinate offset helpers.
- [`utils/navigation/cameraBearing.ts`](utils/navigation/cameraBearing.ts): bearing-related math.
- [`utils/navigation/cameraPitch.ts`](utils/navigation/cameraPitch.ts): pitch computation helpers.
- [`utils/navigation/cameraSmoothing.ts`](utils/navigation/cameraSmoothing.ts): smoothing/easing primitives.
- [`utils/navigation/cameraTuning.ts`](utils/navigation/cameraTuning.ts): tuning presets and constants.
- [`utils/navigation/navCameraLoop.ts`](utils/navigation/navCameraLoop.ts): lower-level camera loop building blocks.
- [`utils/navigation/navCameraSmoothing.ts`](utils/navigation/navCameraSmoothing.ts): camera smoothing policies.
- [`utils/navigation/navCameraTargets.ts`](utils/navigation/navCameraTargets.ts): computes camera targets.
- [`utils/navigation/navInitialCameraFix.ts`](utils/navigation/navInitialCameraFix.ts): one-time camera correction helpers.
- [`utils/navigation/mapCameraApply.ts`](utils/navigation/mapCameraApply.ts): applies camera changes (set/animate modes).
- [`utils/navigation/mapFit.ts`](utils/navigation/mapFit.ts): fit-to-route utilities.

Route/steps/instructions:

- [`utils/navigation/directionsApi.ts`](utils/navigation/directionsApi.ts): Directions API HTTP calls.
- [`utils/navigation/directions.ts`](utils/navigation/directions.ts): Directions transformations/helpers.
- [`utils/navigation/instructions.ts`](utils/navigation/instructions.ts): instruction parsing + maneuver/lane hints.
- [`utils/navigation/turnByTurnUi.ts`](utils/navigation/turnByTurnUi.ts): helpers for turn-by-turn UI updates.

Progress, matching, off-route:

- [`utils/navigation/mapMatching.ts`](utils/navigation/mapMatching.ts): map-matching helpers.
- [`utils/navigation/navProgress.ts`](utils/navigation/navProgress.ts): progress computations.
- [`utils/navigation/remainingRoute.ts`](utils/navigation/remainingRoute.ts): remaining route computations.
- [`utils/navigation/offRoute.ts`](utils/navigation/offRoute.ts): off-route detection + guards.

GPS and tracking:

- [`utils/navigation/gpsTier.ts`](utils/navigation/gpsTier.ts): tiered GPS cadence selection.
- [`utils/navigation/navGpsWatch.ts`](utils/navigation/navGpsWatch.ts): GPS watch helpers.
- [`utils/navigation/navLocationUpdate.ts`](utils/navigation/navLocationUpdate.ts): applies a location update to nav state.
- [`utils/navigation/headingTracking.ts`](utils/navigation/headingTracking.ts): heading tracking helpers.

Core primitives:

- [`utils/navigation/eta.ts`](utils/navigation/eta.ts): ETA computation + formatting.
- [`utils/navigation/math.ts`](utils/navigation/math.ts): reusable math helpers (lerp, clamping, angle deltas).
- [`utils/navigation/navCoordinate.ts`](utils/navigation/navCoordinate.ts): coordinate helpers.
- [`utils/navigation/navSeed.ts`](utils/navigation/navSeed.ts): initializes nav state/refs.
- [`utils/navigation/navCleanup.ts`](utils/navigation/navCleanup.ts): cleanup helpers for subscriptions/timers.
- [`utils/navigation/zoom.ts`](utils/navigation/zoom.ts): zoom heuristics.
- [`utils/navigation/routeOrchestrator.ts`](utils/navigation/routeOrchestrator.ts): high-level “route + nav” orchestration helpers.

### Misc utilities (`utils/*`)

- [`utils/cache.ts`](utils/cache.ts): lightweight caching helpers.
- [`utils/colors.ts`](utils/colors.ts): color helpers/constants.
- [`utils/database.ts`](utils/database.ts): app database helpers.

Sensor/location utilities (used by the map/navigation system):

- [`utils/useLocationTracking.ts`](utils/useLocationTracking.ts)
- [`utils/useRouteRecording.ts`](utils/useRouteRecording.ts)
- [`utils/useSensorFusion.ts`](utils/useSensorFusion.ts)

## 8) Project config, scripts, and docs

Config:

- [`app.json`](app.json): Expo app config (including platform config).
- [`package.json`](package.json): scripts (`lint`, `typecheck`, `check`) + deps.
- [`tsconfig.json`](tsconfig.json): TypeScript config.
- [`eslint.config.js`](eslint.config.js): ESLint flat config.
- [`expo-env.d.ts`](expo-env.d.ts): Expo env typing.

Docs:

- [`MAP_REFACTOR_GUIDE.md`](MAP_REFACTOR_GUIDE.md): map-specific refactor notes.
- [`IMPLEMENTED_SO_FAR.md`](IMPLEMENTED_SO_FAR.md): system overview and testing notes.

## 9) `app-example/` (template/reference)

This folder looks like a reference/template app (common in Expo Router projects). It’s useful for learning patterns, but it’s not the main app entry.

- [`app-example/app/_layout.tsx`](app-example/app/_layout.tsx)
- [`app-example/app/modal.tsx`](app-example/app/modal.tsx)
- [`app-example/app/(tabs)/_layout.tsx`](<app-example/app/(tabs)/_layout.tsx>)
- [`app-example/app/(tabs)/index.tsx`](<app-example/app/(tabs)/index.tsx>)
- [`app-example/app/(tabs)/explore.tsx`](<app-example/app/(tabs)/explore.tsx>)

Template components/constants/hooks:

- [`app-example/components/`](app-example/components/)
- [`app-example/constants/theme.ts`](app-example/constants/theme.ts)
- [`app-example/hooks/`](app-example/hooks/)

## Suggested study order

If your goal is to understand “how navigation works” end-to-end:

1. [`app/map.tsx`](app/map.tsx) (wiring)
2. [`features/map/hooks/useNavigationLifecycle.ts`](features/map/hooks/useNavigationLifecycle.ts)
3. [`features/map/hooks/useRoutePlanning.ts`](features/map/hooks/useRoutePlanning.ts)
4. [`features/map/hooks/useNavMarkerSmoothingLoop.ts`](features/map/hooks/useNavMarkerSmoothingLoop.ts)
5. [`features/map/hooks/useNavCameraFollowLoop.ts`](features/map/hooks/useNavCameraFollowLoop.ts)
6. [`utils/navigation/*`](utils/navigation/) (the pure building blocks)

If your goal is to tweak UI:

1. [`components/map/MapOverlayStack.tsx`](components/map/MapOverlayStack.tsx)
2. [`components/map/RightControls.tsx`](components/map/RightControls.tsx)
3. [`components/map/InstructionPanel.tsx`](components/map/InstructionPanel.tsx)
4. [`components/map/StopsPanel.tsx`](components/map/StopsPanel.tsx)
