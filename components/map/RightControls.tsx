import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/map/mapScreen.styles";
import type { MapLayerType } from "@/types/mapUi";

type Props = {
  bottomInset: number;

  cameraDebugUnlocked: boolean;
  onPressDebug: () => void;

  mapType: MapLayerType;
  onCycleMapType: () => void;
  onLongPressUnlockDebug: () => void;

  showsTraffic: boolean;
  onToggleTraffic: () => void;
  showsBuildings: boolean;
  onToggleBuildings: () => void;
  showsCompass: boolean;
  onToggleCompass: () => void;

  isNavigating: boolean;
  routeHasCoordinates: boolean;
  navViewMode: "follow" | "free" | "overview";
  onRequestOverview: () => void;
  onRequestRecenter: () => void;

  destinationExists: boolean;
  stopsCount: number;
  onToggleStopsPanel: () => void;

  onOpenStats: () => void;
  onMyLocation: () => void;
};

export function RightControls({
  bottomInset,
  cameraDebugUnlocked,
  onPressDebug,
  mapType,
  onCycleMapType,
  onLongPressUnlockDebug,
  showsTraffic,
  onToggleTraffic,
  showsBuildings,
  onToggleBuildings,
  showsCompass,
  onToggleCompass,
  isNavigating,
  routeHasCoordinates,
  navViewMode,
  onRequestOverview,
  onRequestRecenter,
  destinationExists,
  stopsCount,
  onToggleStopsPanel,
  onOpenStats,
  onMyLocation,
}: Props) {
  return (
    <View
      style={[styles.rightButtonsContainer, { bottom: bottomInset + 100 }]}
    >
      <TouchableOpacity style={styles.cameraDebugToggle} onPress={onPressDebug}>
        <Text style={styles.cameraDebugToggleText}>DBG</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={onCycleMapType}
        onLongPress={onLongPressUnlockDebug}
        delayLongPress={700}
      >
        <MaterialCommunityIcons
          name={mapType === "standard" ? "layers-outline" : "layers"}
          size={24}
          color="#1A73E8"
        />
      </TouchableOpacity>

      {cameraDebugUnlocked && (
        <TouchableOpacity
          style={[
            styles.myLocationButton,
            showsTraffic && styles.myLocationButtonActive,
          ]}
          onPress={onToggleTraffic}
        >
          <MaterialCommunityIcons
            name="traffic-light"
            size={22}
            color="#1A73E8"
          />
        </TouchableOpacity>
      )}

      {cameraDebugUnlocked && (
        <TouchableOpacity
          style={[
            styles.myLocationButton,
            showsBuildings && styles.myLocationButtonActive,
          ]}
          onPress={onToggleBuildings}
        >
          <MaterialCommunityIcons name="city" size={22} color="#1A73E8" />
        </TouchableOpacity>
      )}

      {cameraDebugUnlocked && (
        <TouchableOpacity
          style={[
            styles.myLocationButton,
            showsCompass && styles.myLocationButtonActive,
          ]}
          onPress={onToggleCompass}
        >
          <MaterialCommunityIcons
            name="compass-outline"
            size={22}
            color="#1A73E8"
          />
        </TouchableOpacity>
      )}

      {isNavigating && routeHasCoordinates && (
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={onRequestOverview}
        >
          <MaterialCommunityIcons name="routes" size={24} color="#1A73E8" />
        </TouchableOpacity>
      )}

      {isNavigating && navViewMode !== "follow" && (
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={onRequestRecenter}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={24}
            color="#1A73E8"
          />
        </TouchableOpacity>
      )}

      {!isNavigating && (
        <TouchableOpacity style={styles.statsButton} onPress={onOpenStats}>
          <MaterialCommunityIcons
            name="chart-line"
            size={24}
            color="#1A73E8"
          />
        </TouchableOpacity>
      )}

      {destinationExists && !isNavigating && (
        <TouchableOpacity
          style={styles.stopsButton}
          onPress={onToggleStopsPanel}
        >
          <MaterialCommunityIcons
            name="map-marker-multiple"
            size={24}
            color="#1A73E8"
          />
          {stopsCount > 0 && (
            <View style={styles.stopsBadge}>
              <Text style={styles.stopsBadgeText}>{stopsCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.myLocationButton} onPress={onMyLocation}>
        <Ionicons name="locate" size={24} color="#1A73E8" />
      </TouchableOpacity>
    </View>
  );
}
