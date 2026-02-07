import React from "react";
import { StatusBar } from "react-native";

import type {
  GooglePlaceData,
  GooglePlaceDetail,
} from "react-native-google-places-autocomplete";

import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";
import type {
  CameraApplyMode,
  CameraTuningPreset,
  MapLayerType,
  NavViewMode,
} from "@/types/mapUi";
import type { LaneHint } from "@/utils/navigation/instructions";

import { CameraDebugPanel } from "@/components/map/CameraDebugPanel";
import { InstructionPanel } from "@/components/map/InstructionPanel";
import { MapSearchBar } from "@/components/map/MapSearchBar";
import { RightControls } from "@/components/map/RightControls";
import { StageInfo } from "@/components/map/StageInfo";
import { StartNavigationButton } from "@/components/map/StartNavigationButton";
import { StopsPanel } from "@/components/map/StopsPanel";

type Props = {
  topInset: number;
  bottomInset: number;

  googleMapsApiKey: string;
  searchRef: React.RefObject<any>;
  userLocation: UserLocation | null;
  isNavigating: boolean;
  onPlaceSelect: (
    data: GooglePlaceData,
    details: GooglePlaceDetail | null,
  ) => void | Promise<void>;

  // Right controls
  cameraDebugUnlocked: boolean;
  onPressDebug: () => void;
  onLongPressUnlockDebug: () => void;

  mapType: MapLayerType;
  onCycleMapType: () => void;

  showsTraffic: boolean;
  onToggleTraffic: () => void;
  showsBuildings: boolean;
  onToggleBuildings: () => void;
  showsIndoors: boolean;
  onToggleIndoors: () => void;
  showsCompass: boolean;
  onToggleCompass: () => void;

  routeHasCoordinates: boolean;
  navViewMode: NavViewMode;
  onRequestOverview: () => void;
  onRequestRecenter: () => void;

  destination: MapDestination | null;
  stops: MapStop[];
  onToggleStopsPanel: () => void;
  onOpenStats: () => void;
  onMyLocation: () => void;

  // Camera debug
  showCameraDebug: boolean;
  cameraApplyMode: CameraApplyMode;
  cameraTuningPreset: CameraTuningPreset;
  cameraDebugSnapshot: React.ComponentProps<typeof CameraDebugPanel>["cameraDebugSnapshot"];
  onCloseCameraDebug: () => void;
  onCycleApplyMode: () => void;
  onCycleTuningPreset: () => void;

  // Stops panel
  showStopsPanel: boolean;
  onCloseStopsPanel: () => void;
  onStopsDragEnd: (data: MapStop[]) => void | Promise<void>;
  onRemoveStop: (stopId: string) => void | Promise<void>;
  onRemoveDestination: () => void;

  // Start navigation
  onStartNavigation: () => void | Promise<void>;

  // Dev overlay
  stageInfoVisible: boolean;

  // Instruction panel
  isInArrivalZone: boolean;
  currentManeuver: string | null;
  currentInstruction: string;
  nextManeuver: string | null;
  nextInstruction: string;
  distanceToNextTurnM: number;
  laneHint: LaneHint;
  speedLimit: number;
  isSensorsActive: boolean;
  headingDegrees: number;
  etaText: string;
  distanceKm: number;
  currentStopIndex: number;
  onNextStop: () => void;
};

export function MapOverlayStack({
  topInset,
  bottomInset,
  googleMapsApiKey,
  searchRef,
  userLocation,
  isNavigating,
  onPlaceSelect,
  cameraDebugUnlocked,
  onPressDebug,
  onLongPressUnlockDebug,
  mapType,
  onCycleMapType,
  showsTraffic,
  onToggleTraffic,
  showsBuildings,
  onToggleBuildings,
  showsIndoors,
  onToggleIndoors,
  showsCompass,
  onToggleCompass,
  routeHasCoordinates,
  navViewMode,
  onRequestOverview,
  onRequestRecenter,
  destination,
  stops,
  onToggleStopsPanel,
  onOpenStats,
  onMyLocation,
  showCameraDebug,
  cameraApplyMode,
  cameraTuningPreset,
  cameraDebugSnapshot,
  onCloseCameraDebug,
  onCycleApplyMode,
  onCycleTuningPreset,
  showStopsPanel,
  onCloseStopsPanel,
  onStopsDragEnd,
  onRemoveStop,
  onRemoveDestination,
  onStartNavigation,
  stageInfoVisible,
  isInArrivalZone,
  currentManeuver,
  currentInstruction,
  nextManeuver,
  nextInstruction,
  distanceToNextTurnM,
  laneHint,
  speedLimit,
  isSensorsActive,
  headingDegrees,
  etaText,
  distanceKm,
  currentStopIndex,
  onNextStop,
}: Props) {
  return (
    <>
      <StatusBar barStyle="dark-content" />

      <MapSearchBar
        visible={!isNavigating}
        topInset={topInset}
        searchRef={searchRef}
        onPlaceSelect={onPlaceSelect}
        googleMapsApiKey={googleMapsApiKey}
        userLocation={userLocation}
      />

      <RightControls
        bottomInset={bottomInset}
        cameraDebugUnlocked={cameraDebugUnlocked}
        onPressDebug={onPressDebug}
        mapType={mapType}
        onCycleMapType={onCycleMapType}
        onLongPressUnlockDebug={onLongPressUnlockDebug}
        showsTraffic={showsTraffic}
        onToggleTraffic={onToggleTraffic}
        showsBuildings={showsBuildings}
        onToggleBuildings={onToggleBuildings}
        showsCompass={showsCompass}
        onToggleCompass={onToggleCompass}
        isNavigating={isNavigating}
        routeHasCoordinates={routeHasCoordinates}
        navViewMode={navViewMode}
        onRequestOverview={onRequestOverview}
        onRequestRecenter={onRequestRecenter}
        destinationExists={!!destination}
        stopsCount={stops.length}
        onToggleStopsPanel={onToggleStopsPanel}
        onOpenStats={onOpenStats}
        onMyLocation={onMyLocation}
      />

      <CameraDebugPanel
        visible={cameraDebugUnlocked && showCameraDebug}
        bottomInset={bottomInset}
        cameraApplyMode={cameraApplyMode}
        cameraTuningPreset={cameraTuningPreset}
        cameraDebugSnapshot={cameraDebugSnapshot}
        onClose={onCloseCameraDebug}
        onCycleApply={onCycleApplyMode}
        onCyclePreset={onCycleTuningPreset}
        onCycleLayer={onCycleMapType}
        onToggleTraffic={onToggleTraffic}
        onToggleBuildings={onToggleBuildings}
        onToggleIndoors={onToggleIndoors}
        showsTraffic={showsTraffic}
        showsBuildings={showsBuildings}
        showsIndoors={showsIndoors}
      />

      <StopsPanel
        visible={showStopsPanel && !isNavigating}
        bottomInset={bottomInset}
        stops={stops}
        destinationAddress={destination?.address}
        onClose={onCloseStopsPanel}
        onDragEnd={onStopsDragEnd}
        onRemoveStop={onRemoveStop}
        onRemoveDestination={onRemoveDestination}
      />

      <StartNavigationButton
        visible={!!destination}
        bottomInset={bottomInset}
        isNavigating={isNavigating}
        onPress={onStartNavigation}
      />

      <StageInfo visible={stageInfoVisible} bottomInset={bottomInset} />

      <InstructionPanel
        visible={isNavigating && (!!currentInstruction || isInArrivalZone)}
        topInset={topInset}
        isInArrivalZone={isInArrivalZone}
        destinationAddress={destination?.address}
        currentManeuver={currentManeuver}
        currentInstruction={currentInstruction}
        nextManeuver={nextManeuver}
        nextInstruction={nextInstruction}
        distanceToNextTurnM={distanceToNextTurnM}
        laneHint={laneHint}
        speedMps={userLocation?.speed || 0}
        speedLimit={speedLimit}
        isSensorsActive={isSensorsActive}
        headingDegrees={headingDegrees}
        etaText={etaText}
        distanceKm={distanceKm}
        stopsCount={stops.length}
        currentStopIndex={currentStopIndex}
        onNextStop={onNextStop}
      />
    </>
  );
}
