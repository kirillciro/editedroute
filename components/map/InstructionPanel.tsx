import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/map/mapScreen.styles";
import { LaneHint, maneuverToIconName } from "@/utils/navigation/instructions";

type Props = {
  visible: boolean;
  topInset: number;

  isInArrivalZone: boolean;
  destinationAddress?: string;

  currentManeuver: string | null;
  currentInstruction: string;
  nextManeuver: string | null;
  nextInstruction: string;
  distanceToNextTurnM: number;
  laneHint: LaneHint;

  speedMps: number;
  speedLimit: number;
  isSensorsActive: boolean;
  headingDegrees: number;

  etaText: string;
  distanceKm: number;

  stopsCount: number;
  currentStopIndex: number;
  onNextStop: () => void;
};

export function InstructionPanel({
  visible,
  topInset,
  isInArrivalZone,
  destinationAddress,
  currentManeuver,
  currentInstruction,
  nextManeuver,
  nextInstruction,
  distanceToNextTurnM,
  laneHint,
  speedMps,
  speedLimit,
  isSensorsActive,
  headingDegrees,
  etaText,
  distanceKm,
  stopsCount,
  currentStopIndex,
  onNextStop,
}: Props) {
  if (!visible) return null;

  const iconName = (
    isInArrivalZone
      ? "flag-checkered"
      : maneuverToIconName(currentManeuver, currentInstruction || "")
  ) as React.ComponentProps<typeof MaterialCommunityIcons>["name"];

  return (
    <View style={[styles.instructionPanel, { top: topInset + 10 }]}>
      <View style={styles.instructionHeader}>
        <MaterialCommunityIcons
          name={iconName}
          size={32}
          color={isInArrivalZone ? "#34A853" : "#4285F4"}
        />
        <View style={styles.instructionContent}>
          {isInArrivalZone ? (
            <>
              <Text style={styles.arrivalText}>Arriving at destination</Text>
              <Text style={styles.arrivalSubtext}>{destinationAddress}</Text>
            </>
          ) : (
            <>
              <Text style={styles.distanceText}>
                {distanceToNextTurnM < 1000
                  ? `${Math.round(distanceToNextTurnM)} m`
                  : `${(distanceToNextTurnM / 1000).toFixed(1)} km`}
              </Text>
              <Text style={styles.instructionText}>{currentInstruction}</Text>

              {!!laneHint && (
                <View style={styles.laneGuidanceRow}>
                  <View style={styles.lanesStrip}>
                    <View
                      style={[
                        styles.lanePill,
                        (laneHint === "keep-left" || laneHint === "left") &&
                          styles.lanePillActive,
                      ]}
                    />
                    <View
                      style={[
                        styles.lanePill,
                        laneHint === "straight" && styles.lanePillActive,
                      ]}
                    />
                    <View
                      style={[
                        styles.lanePill,
                        (laneHint === "keep-right" || laneHint === "right") &&
                          styles.lanePillActive,
                      ]}
                    />
                  </View>
                  <Text style={styles.laneHintText}>
                    {laneHint === "keep-left"
                      ? "Keep left"
                      : laneHint === "keep-right"
                        ? "Keep right"
                        : laneHint === "left"
                          ? "Turn left"
                          : laneHint === "right"
                            ? "Turn right"
                            : "Go straight"}
                  </Text>
                </View>
              )}

              {!!nextInstruction && (
                <View style={styles.nextStepRow}>
                  <MaterialCommunityIcons
                    name={
                      maneuverToIconName(nextManeuver, nextInstruction) as React.ComponentProps<
                        typeof MaterialCommunityIcons
                      >["name"]
                    }
                    size={16}
                    color="#5F6368"
                  />
                  <Text style={styles.nextStepText} numberOfLines={1}>
                    Then {nextInstruction}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.speedContainer}>
        <View style={styles.currentSpeed}>
          <Text style={styles.speedValue}>{Math.round(speedMps * 3.6)}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>

        {speedLimit > 0 && (
          <View style={styles.speedLimitCircle}>
            <Text style={styles.speedLimitText}>{speedLimit}</Text>
          </View>
        )}

        {isSensorsActive && (
          <View style={styles.headingDisplay}>
            <Ionicons name="compass" size={16} color="#666" />
            <Text style={styles.headingValue}>{Math.round(headingDegrees)}°</Text>
          </View>
        )}
      </View>

      <View style={styles.etaContainer}>
        <Text style={styles.etaText}>🕐 {etaText}</Text>
        <Text style={styles.etaText}>📍 {distanceKm.toFixed(1)} km</Text>
      </View>

      {stopsCount > 0 && currentStopIndex < stopsCount && (
        <TouchableOpacity style={styles.nextStopButton} onPress={onNextStop}>
          <Ionicons name="flag" size={20} color="#fff" />
          <Text style={styles.nextStopButtonText}>
            {currentStopIndex === -1 || currentStopIndex === 0
              ? `Stop 1/${stopsCount}`
              : `Stop ${currentStopIndex + 1}/${stopsCount}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
