import { useUser, useAuth } from "@clerk/clerk-expo";
import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
// TODO: Fix expo-image-picker native module
// import * as ImagePicker from "expo-image-picker";
// import * as FileSystem from "expo-file-system/legacy";
import { White, Success, Warning, AppleBlue } from "@/utils/colors";

export default function Profile() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { colors, setTheme, isDark } = useTheme();
  const passkeys = user?.passkeys ?? [];
  const [isCreatingPasskey, setIsCreatingPasskey] = useState(false);

  const handleImagePick = async () => {
    Alert.alert(
      "Coming Soon",
      "Image picker will be enabled in production build",
    );
    return;
    // TODO: Enable after fixing native module
    /*
    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions to change your profile picture."
        );
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;

        // Convert image to base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: "base64",
        });

        // Upload to Clerk with proper format
        await user?.setProfileImage({
          file: `data:image/jpeg;base64,${base64}`,
        });
        await user?.reload();

        Alert.alert("Success", "Profile picture updated!");
      }
    } catch (error: any) {
      console.error("Error updating profile image:", error);
      Alert.alert(
        "Error",
        "Failed to update profile picture. Please try again."
      );
    }
    */
  };

  const handleCreatePasskey = async () => {
    setIsCreatingPasskey(true);
    try {
      await user?.createPasskey();
      await user?.reload();
      Alert.alert("Success", "Passkey created successfully!");
    } catch (error: any) {
      if (error?.errors?.[0]?.code === "passkey_registration_cancelled") {
        return;
      }
      Alert.alert(
        "Error",
        error?.errors?.[0]?.message || "Failed to create passkey",
      );
    } finally {
      setIsCreatingPasskey(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    try {
      const passkey = passkeys.find((p) => p.id === passkeyId);
      await passkey?.delete();
      await user?.reload();
      Alert.alert("Success", "Passkey deleted successfully!");
    } catch {
      Alert.alert("Error", "Failed to delete passkey");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)");
    } catch {
      Alert.alert("Error", "Failed to sign out");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Section */}
      <View
        style={[
          styles.profileSection,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={handleImagePick}
          style={styles.avatarContainer}
        >
          <Image source={{ uri: user?.imageUrl }} style={styles.avatar} />
          <View
            style={[styles.cameraButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="camera" size={16} color={White} />
          </View>
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <Text style={[styles.name, { color: colors.text }]}>
            {user?.fullName}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>
            {user?.emailAddresses[0]?.emailAddress}
          </Text>
        </View>
      </View>

      {/* Settings Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {/* Dark Mode Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 159, 10, 0.15)"
                    : "rgba(52, 199, 89, 0.15)",
                },
              ]}
            >
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={18}
                color={isDark ? Warning : Success}
              />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Dark Mode
              </Text>
              <Text
                style={[
                  styles.settingSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                {isDark ? "On" : "Off"}
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={(value) => setTheme(value ? "dark" : "light")}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={White}
          />
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={[
            styles.signOutButton,
            {
              backgroundColor: isDark
                ? "rgba(255, 59, 48, 0.15)"
                : "rgba(255, 59, 48, 0.1)",
              borderColor: isDark
                ? "rgba(255, 59, 48, 0.3)"
                : "rgba(255, 59, 48, 0.2)",
            },
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={Warning}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Passkeys Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.passkeysHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: "rgba(0, 122, 255, 0.15)" },
            ]}
          >
            <MaterialCommunityIcons
              name="key-variant"
              size={18}
              color={AppleBlue}
            />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Passkeys
          </Text>
        </View>

        {passkeys.length === 0 ? (
          <View
            style={[
              styles.emptyPasskeys,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No passkeys added
            </Text>
          </View>
        ) : (
          passkeys.map((passkey) => (
            <View
              key={passkey.id}
              style={[
                styles.passkeyItem,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <View style={styles.passkeyInfo}>
                <Text style={[styles.passkeyName, { color: colors.text }]}>
                  {passkey.name}
                </Text>
                <Text
                  style={[styles.passkeyDate, { color: colors.textSecondary }]}
                >
                  Created: {passkey.createdAt.toLocaleDateString()}
                </Text>
                <Text
                  style={[styles.passkeyDate, { color: colors.textSecondary }]}
                >
                  Last used:{" "}
                  {passkey.lastUsedAt?.toLocaleDateString() || "Never"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deletePasskeyButton}
                onPress={() => handleDeletePasskey(passkey.id)}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[styles.addPasskeyButton, { backgroundColor: colors.primary }]}
          onPress={handleCreatePasskey}
          disabled={isCreatingPasskey}
        >
          {isCreatingPasskey ? (
            <>
              <Ionicons
                name="time-outline"
                size={20}
                color={White}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addPasskeyText}>Creating...</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons
                name="key-plus"
                size={20}
                color={White}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addPasskeyText}>Add Passkey</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  profileSection: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: { position: "relative" },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  name: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  email: { fontSize: 14, fontWeight: "500" },
  card: { borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingText: { flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  settingSubtitle: { fontSize: 13, fontWeight: "500" },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: Warning,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  passkeysHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginLeft: 12,
  },
  emptyPasskeys: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, fontWeight: "500" },
  passkeyItem: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passkeyInfo: { flex: 1 },
  passkeyName: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  passkeyDate: { fontSize: 12, marginBottom: 4 },
  deletePasskeyButton: { padding: 8 },
  addPasskeyButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "center",
  },
  addPasskeyText: { color: White, fontSize: 16, fontWeight: "700" },
});
