import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStops } from "@/context/StopsContext";
import { useTheme } from "@/context/ThemeContext";
import { ParcelSize, PARCEL_SIZE_INFO, Stop } from "@/types/navigation";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { White, Success, Warning } from "@/utils/colors";

export default function StopsScreen() {
  const { stops, addStop, deleteStop } = useStops();
  const { colors } = useTheme();
  const [address, setAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedSize, setSelectedSize] = useState<ParcelSize | undefined>(
    undefined
  );

  const handleAddStop = () => {
    if (!address.trim()) {
      Alert.alert("Missing Address", "Please enter a delivery address");
      return;
    }

    addStop({
      address: address.trim(),
      recipientName: recipientName.trim() || undefined,
      parcelSize: selectedSize,
    });

    // Reset form
    setAddress("");
    setRecipientName("");
    setSelectedSize(undefined);
  };

  const handleDeleteStop = (id: string, address: string) => {
    Alert.alert("Delete Stop", `Remove "${address}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteStop(id),
      },
    ]);
  };

  const renderParcelSizeButton = (size: ParcelSize) => {
    const info = PARCEL_SIZE_INFO[size];
    const isSelected = selectedSize === size;

    return (
      <TouchableOpacity
        key={size}
        style={[
          styles.sizeButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          isSelected && {
            backgroundColor: info.color,
            borderColor: info.color,
          },
        ]}
        onPress={() => setSelectedSize(isSelected ? undefined : size)}
      >
        <MaterialCommunityIcons
          name={info.icon as any}
          size={24}
          color={isSelected ? White : info.color}
          style={styles.sizeIcon}
        />
        <Text
          style={[
            styles.sizeLabel,
            { color: isSelected ? White : colors.text },
          ]}
        >
          {info.label}
        </Text>
        <Text
          style={[
            styles.sizeWeight,
            {
              color: isSelected
                ? "rgba(255, 255, 255, 0.8)"
                : colors.textSecondary,
            },
          ]}
        >
          {info.weight}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStopItem = ({ item, index }: { item: Stop; index: number }) => {
    const sizeInfo = item.parcelSize
      ? PARCEL_SIZE_INFO[item.parcelSize]
      : undefined;

    return (
      <View
        style={[
          styles.stopItem,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.stopHeader}>
          <Text style={[styles.stopNumber, { color: colors.primary }]}>
            {index + 1}.
          </Text>
          <View style={styles.stopContent}>
            <Text style={[styles.stopAddress, { color: colors.text }]}>
              {item.address}
            </Text>
            {item.recipientName && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Ionicons
                  name="person"
                  size={13}
                  color={colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.stopRecipient,
                    { color: colors.textSecondary },
                  ]}
                >
                  {item.recipientName}
                </Text>
              </View>
            )}
            {sizeInfo && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons
                  name={sizeInfo.icon as any}
                  size={14}
                  color={sizeInfo.color}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[styles.stopParcel, { color: colors.textSecondary }]}
                >
                  {sizeInfo.label} ({sizeInfo.weight})
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteStop(item.id, item.address)}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={["top", "bottom"]}
    >
      <ScrollView style={styles.scrollView}>
        {/* Add Stop Form */}
        <View style={styles.formContainer}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {stops.length === 0 ? "Add Your First Stop" : "Add New Stop"}
          </Text>

          {/* Address Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter full address..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Recipient Name Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Recipient Name (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Enter recipient name..."
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Parcel Size Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Parcel Size (Optional)
            </Text>
            <View style={styles.sizeGrid}>
              {(Object.keys(PARCEL_SIZE_INFO) as ParcelSize[]).map(
                renderParcelSizeButton
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: Success }]}
              onPress={handleAddStop}
            >
              <Ionicons
                name="checkmark"
                size={20}
                color={White}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.saveButtonText}>Save Stop</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Last Added Stop Preview */}
        {stops.length > 0 &&
          (() => {
            const lastStop = stops[stops.length - 1];
            const sizeInfo = lastStop.parcelSize
              ? PARCEL_SIZE_INFO[lastStop.parcelSize]
              : undefined;

            return (
              <View
                style={[
                  styles.lastStopContainer,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.lastStopTitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Last Added Stop
                </Text>
                <View style={styles.lastStopContent}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={16}
                    color={Success}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.lastStopAddress, { color: colors.text }]}
                    >
                      {lastStop.address}
                    </Text>
                    {lastStop.recipientName && (
                      <Text
                        style={[
                          styles.lastStopRecipient,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {lastStop.recipientName}
                      </Text>
                    )}
                    {sizeInfo && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 4,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={sizeInfo.icon as any}
                          size={14}
                          color={sizeInfo.color}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.lastStopRecipient,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {sizeInfo.label} ({sizeInfo.weight})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })()}

        {/* Stops List */}
        {stops.length > 0 && (
          <View style={styles.stopsListContainer}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color={colors.text}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.listTitle, { color: colors.text }]}>
                Delivery Route ({stops.length} stops)
              </Text>
            </View>
            <FlatList
              data={stops}
              renderItem={renderStopItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.stopsList}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: 20 },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  infoIcon: { marginRight: 4 },
  listHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  addButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "center",
  },
  addButtonText: { color: White, fontSize: 16, fontWeight: "700" },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  formTitle: { fontSize: 20, fontWeight: "800", marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  required: { color: Warning },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  sizeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sizeButton: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  sizeIcon: { marginBottom: 4 },
  sizeLabel: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  sizeWeight: { fontSize: 10, fontWeight: "500" },
  formActions: { flexDirection: "row", gap: 12 },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  saveButtonText: { color: White, fontSize: 16, fontWeight: "700" },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 16, fontWeight: "600" },
  lastStopContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  lastStopTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  lastStopContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  lastStopAddress: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  lastStopRecipient: {
    fontSize: 13,
    fontWeight: "500",
  },
  stopsListContainer: { marginTop: 24 },
  listTitle: { fontSize: 18, fontWeight: "800" },
  stopsList: { gap: 12 },
  stopItem: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  stopHeader: { flexDirection: "row", flex: 1 },
  stopNumber: {
    fontSize: 16,
    fontWeight: "800",
    marginRight: 12,
    marginTop: 2,
  },
  stopContent: { flex: 1 },
  stopAddress: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  stopRecipient: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  stopParcel: { fontSize: 12, fontWeight: "600", color: Warning },
  deleteButton: { padding: 8 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySubtext: { fontSize: 14, fontWeight: "500", textAlign: "center" },
  emptyButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16 },
  emptyButtonText: { color: White, fontSize: 16, fontWeight: "700" },
});
