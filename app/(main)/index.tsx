import { useUser } from "@clerk/clerk-expo";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useStops } from "@/context/StopsContext";
import { useTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { White } from "@/utils/colors";

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();
  const { stops, stats } = useStops();
  const { colors } = useTheme();

  const handleStartNavigation = () => {
    if (stops.length === 0) {
      Alert.alert("No Stops", "Please add stops before starting navigation.", [
        { text: "Add Stops", onPress: () => router.push("/stops" as any) },
      ]);
      return;
    }
    // Navigate to drive screen with full GPS tracking
    router.push("/drive" as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
            Welcome,
          </Text>
          <Text style={[styles.driverName, { color: colors.text }]}>
            {user?.firstName ||
              user?.emailAddresses[0]?.emailAddress?.split("@")[0] ||
              "Driver"}
            !
          </Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Today&apos;s Stats
          </Text>
          <View style={styles.statsGrid}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name="car"
                size={28}
                color={colors.primary}
                style={styles.statIcon}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.kmDriven}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                KM Driven
              </Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name="package-variant"
                size={28}
                color={colors.primary}
                style={styles.statIcon}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.stopsDone}/{stops.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Stops
              </Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="timer-outline"
                size={28}
                color={colors.primary}
                style={styles.statIcon}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.timeSpent === 0
                  ? "0h"
                  : `${Math.floor(stats.timeSpent / 60)}h ${
                      stats.timeSpent % 60
                    }m`}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Time
              </Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="flash"
                size={28}
                color={colors.primary}
                style={styles.statIcon}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.averageTimePerStop}m
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Avg/Stop
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleStartNavigation}
          >
            <Ionicons
              name="play"
              size={20}
              color={White}
              style={styles.btnIcon}
            />
            <Text style={styles.primaryButtonText}>START NAVIGATION</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.push("/stops" as any)}
          >
            <MaterialCommunityIcons
              name="map-marker"
              size={20}
              color={colors.text}
              style={styles.btnIcon}
            />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Manage Stops ({stops.length})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  welcomeSection: { marginBottom: 24 },
  welcomeText: { fontSize: 18, fontWeight: "500", marginBottom: 4 },
  driverName: { fontSize: 32, fontWeight: "800", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  statsContainer: { marginBottom: 24 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1,
    minWidth: "47%",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  actionsContainer: { marginBottom: 24, gap: 12 },
  btnIcon: { marginRight: 8 },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: White,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "700" },
});
