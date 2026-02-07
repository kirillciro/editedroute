import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/map/mapScreen.styles";
import type { CameraApplyMode } from "@/types/mapUi";

type CameraDebugSnapshot = {
  mapType?: string;
  showsTraffic?: boolean;
  showsBuildings?: boolean;
  showsIndoors?: boolean;
  showsCompass?: boolean;
  hasSetCamera: boolean;
  hasAnimateCamera: boolean;
  holdMs: number;
  navViewMode: string;
  speedMps: number;
  distToTurnM: number;
  remainingRouteM: number | null;
  etaSeconds: number | null;
  etaSource: string;
  zoomTarget: number;
  bearingTarget: number;
  pitchTarget: number;
  zoomApplied?: number;
  headingApplied?: number;
  pitchApplied?: number;
};

type Props = {
  visible: boolean;
  bottomInset: number;

  cameraApplyMode: CameraApplyMode;
  cameraTuningPreset: string;
  cameraDebugSnapshot: CameraDebugSnapshot | null;

  onClose: () => void;
  onCycleApply: () => void;
  onCyclePreset: () => void;
  onCycleLayer: () => void;
  onToggleTraffic: () => void;
  onToggleBuildings: () => void;
  onToggleIndoors: () => void;

  showsTraffic: boolean;
  showsBuildings: boolean;
  showsIndoors: boolean;
};

export function CameraDebugPanel({
  visible,
  bottomInset,
  cameraApplyMode,
  cameraTuningPreset,
  cameraDebugSnapshot,
  onClose,
  onCycleApply,
  onCyclePreset,
  onCycleLayer,
  onToggleTraffic,
  onToggleBuildings,
  onToggleIndoors,
  showsTraffic,
  showsBuildings,
  showsIndoors,
}: Props) {
  if (!visible) return null;

  return (
    <View
      style={[
        styles.cameraDebugPanel,
        { right: 16, bottom: bottomInset + 170 },
      ]}
    >
      <View style={styles.cameraDebugHeader}>
        <Text style={styles.cameraDebugTitle}>Camera Debug</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.cameraDebugLine}>
        Apply: {cameraApplyMode} | Preset: {cameraTuningPreset}
      </Text>

      {!!cameraDebugSnapshot && (
        <>
          <Text style={styles.cameraDebugLine}>
            layer:{cameraDebugSnapshot.mapType} | traffic:
            {cameraDebugSnapshot.showsTraffic ? "on" : "off"} | 3D:
            {cameraDebugSnapshot.showsBuildings ? "on" : "off"} | indoor:
            {cameraDebugSnapshot.showsIndoors ? "on" : "off"}
          </Text>
          <Text style={styles.cameraDebugLine}>
            setCamera:{cameraDebugSnapshot.hasSetCamera ? "Y" : "N"} |
            animateCamera:{cameraDebugSnapshot.hasAnimateCamera ? "Y" : "N"} |
            hold:{Math.round(cameraDebugSnapshot.holdMs)}ms
          </Text>
          <Text style={styles.cameraDebugLine}>
            nav:{cameraDebugSnapshot.navViewMode} | v:
            {(cameraDebugSnapshot.speedMps * 3.6).toFixed(0)} km/h | d:
            {Math.round(cameraDebugSnapshot.distToTurnM)}m
          </Text>
          <Text style={styles.cameraDebugLine}>
            rem:
            {cameraDebugSnapshot.remainingRouteM != null
              ? `${(cameraDebugSnapshot.remainingRouteM / 1000).toFixed(1)}km`
              : "—"}
            {" | "}
            eta:
            {cameraDebugSnapshot.etaSeconds != null
              ? `${Math.max(0, Math.round(cameraDebugSnapshot.etaSeconds / 60))}m`
              : "—"}
            {cameraDebugSnapshot.etaSource
              ? ` (${cameraDebugSnapshot.etaSource})`
              : ""}
          </Text>
          <Text style={styles.cameraDebugLine}>
            tgt z:{cameraDebugSnapshot.zoomTarget.toFixed(2)} h:
            {cameraDebugSnapshot.bearingTarget.toFixed(0)} p:
            {cameraDebugSnapshot.pitchTarget.toFixed(0)}
          </Text>
          <Text style={styles.cameraDebugLine}>
            app z:{(cameraDebugSnapshot.zoomApplied ?? 0).toFixed(2)} h:
            {(cameraDebugSnapshot.headingApplied ?? 0).toFixed(0)} p:
            {(cameraDebugSnapshot.pitchApplied ?? 0).toFixed(0)}
          </Text>
        </>
      )}

      <View style={styles.cameraDebugButtonsRow}>
        <TouchableOpacity style={styles.cameraDebugButton} onPress={onCycleApply}>
          <Text style={styles.cameraDebugButtonText}>Cycle Apply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraDebugButton} onPress={onCyclePreset}>
          <Text style={styles.cameraDebugButtonText}>Cycle Preset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraDebugButtonsRow}>
        <TouchableOpacity style={styles.cameraDebugButton} onPress={onCycleLayer}>
          <Text style={styles.cameraDebugButtonText}>Cycle Layer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraDebugButton} onPress={onToggleTraffic}>
          <Text style={styles.cameraDebugButtonText}>
            Traffic {showsTraffic ? "On" : "Off"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraDebugButtonsRow}>
        <TouchableOpacity style={styles.cameraDebugButton} onPress={onToggleBuildings}>
          <Text style={styles.cameraDebugButtonText}>
            3D {showsBuildings ? "On" : "Off"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraDebugButton} onPress={onToggleIndoors}>
          <Text style={styles.cameraDebugButtonText}>
            Indoor {showsIndoors ? "On" : "Off"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.cameraDebugHint}>
        Tip: try Apply=animate160 if setCamera feels “steppy”.
      </Text>
    </View>
  );
}
