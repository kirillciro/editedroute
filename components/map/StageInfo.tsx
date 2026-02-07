import React from "react";
import { Text, View } from "react-native";

import { styles } from "@/components/map/mapScreen.styles";

type Props = {
  visible: boolean;
  bottomInset: number;
};

export function StageInfo({ visible, bottomInset }: Props) {
  if (!visible) return null;

  return (
    <View style={[styles.stageInfo, { bottom: bottomInset + 20 }]}>
      <Text style={styles.stageText}>STAGE 6: Full Navigation ✓</Text>
      <Text style={styles.stageSubtext}>Search destination to begin</Text>
    </View>
  );
}
