import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { styles } from "@/components/map/mapScreen.styles";

type Props = {
  visible: boolean;
  bottomInset: number;
  isNavigating: boolean;
  onPress: () => void;
};

export function StartNavigationButton({
  visible,
  bottomInset,
  isNavigating,
  onPress,
}: Props) {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[
        styles.startNavigationButton,
        { bottom: bottomInset + 20 },
        isNavigating && styles.stopNavigationButton,
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name={isNavigating ? "stop" : "navigation"}
        size={24}
        color="#fff"
      />
      <Text style={styles.startNavigationText}>
        {isNavigating ? "Stop Navigation" : "Start Navigation"}
      </Text>
    </TouchableOpacity>
  );
}
