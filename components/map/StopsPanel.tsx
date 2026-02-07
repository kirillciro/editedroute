import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";

import { styles } from "@/components/map/mapScreen.styles";

type MapStop = {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
};

type Props = {
  visible: boolean;
  bottomInset: number;

  stops: MapStop[];
  destinationAddress?: string;

  onClose: () => void;
  onDragEnd: (stops: MapStop[]) => void | Promise<void>;
  onRemoveStop: (stopId: string) => void | Promise<void>;
  onRemoveDestination: () => void | Promise<void>;
};

export function StopsPanel({
  visible,
  bottomInset,
  stops,
  destinationAddress,
  onClose,
  onDragEnd,
  onRemoveStop,
  onRemoveDestination,
}: Props) {
  const renderStopItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<MapStop>) => {
      const index = stops.findIndex((stop) => stop.id === item.id);

      return (
        <ScaleDecorator>
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            activeOpacity={0.8}
          >
            <View style={[styles.stopItem, isActive && styles.stopItemDragging]}>
              <TouchableOpacity onLongPress={drag}>
                <MaterialCommunityIcons name="drag" size={24} color="#999" />
              </TouchableOpacity>
              <View style={styles.stopItemNumber}>
                <Text style={styles.stopItemNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stopItemAddress} numberOfLines={2}>
                {item.address}
              </Text>
              <TouchableOpacity
                onPress={() => onRemoveStop(item.id)}
                style={styles.stopItemButton}
              >
                <Ionicons name="trash-outline" size={16} color="#EA4335" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    },
    [onRemoveStop, stops],
  );

  if (!visible) return null;

  return (
    <View style={[styles.stopsPanel, { bottom: bottomInset + 180 }]}>
      <View style={styles.stopsPanelHeader}>
        <Text style={styles.stopsPanelTitle}>Route Stops</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <DraggableFlatList
        data={stops}
        onDragEnd={({ data }) => onDragEnd(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderStopItem}
        style={styles.stopsList}
        containerStyle={{ maxHeight: 200 }}
        ListFooterComponent={
          <View style={styles.stopItem}>
            <View style={{ width: 24 }} />
            <View style={[styles.stopItemNumber, styles.destinationNumber]}>
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
            <Text style={styles.stopItemAddress} numberOfLines={2}>
              {destinationAddress || ""}
            </Text>
            <TouchableOpacity
              onPress={onRemoveDestination}
              style={styles.stopItemButton}
            >
              <Ionicons name="trash-outline" size={16} color="#EA4335" />
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.stopsPanelFooter}>
        <Text style={styles.stopsPanelHint}>
          Search for a location to add more stops
        </Text>
      </View>
    </View>
  );
}
