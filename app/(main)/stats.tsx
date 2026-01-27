import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
// import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Stage 7.1: Driver Profile & Stats Dashboard
 * Shows total distance, trips, avg speed, time saved
 * Displays history of past routes
 */

interface TripData {
  id: string;
  date: string;
  distance: number; // km
  duration: number; // seconds
  stops: number;
  avgSpeed: number; // km/h
  startAddress: string;
  endAddress: string;
}

interface StatsData {
  totalTrips: number;
  totalDistance: number; // km
  totalDuration: number; // seconds
  avgSpeed: number; // km/h
  timeSaved: number; // seconds (vs estimated time)
}

// const TRIPS_STORAGE_KEY = "@trips_history"; // TODO: Re-enable after AsyncStorage rebuild

export default function StatsScreen() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<StatsData>({
    totalTrips: 0,
    totalDistance: 0,
    totalDuration: 0,
    avgSpeed: 0,
    timeSaved: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTripsData();
  }, []);

  const loadTripsData = async () => {
    try {
      // TODO: Replace with AsyncStorage after native rebuild
      // For now, starting with empty data
      const loadedTrips: TripData[] = [];

      // Calculate aggregated stats
      const totalTrips = loadedTrips.length;
      const totalDistance = loadedTrips.reduce(
        (sum, trip) => sum + trip.distance,
        0,
      );
      const totalDuration = loadedTrips.reduce(
        (sum, trip) => sum + trip.duration,
        0,
      );
      const avgSpeed =
        totalDistance > 0 ? totalDistance / (totalDuration / 3600) : 0;
      const timeSaved = loadedTrips.reduce((sum, trip) => {
        // Assume 10% time saved on average through smart routing
        const estimated = trip.duration * 1.1;
        return sum + (estimated - trip.duration);
      }, 0);

      setStats({
        totalTrips,
        totalDistance,
        totalDuration,
        avgSpeed,
        timeSaved,
      });
    } catch (error) {
      console.error("Error loading trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="loading"
            size={48}
            color={colors.text}
          />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading stats...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Stats Summary Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons
            name="map-marker-distance"
            size={32}
            color="#4285F4"
          />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalDistance.toFixed(1)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total km
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons name="routes" size={32} color="#34A853" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalTrips}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Trips
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons
            name="speedometer"
            size={32}
            color="#FBBC04"
          />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.avgSpeed.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Avg km/h
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons name="clock-fast" size={32} color="#EA4335" />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDuration(stats.timeSaved)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Time Saved
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: "48%",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  tripCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tripDateBadge: {
    backgroundColor: "#4285F4",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripDateText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  tripMetrics: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripMetricText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  tripRoute: {
    marginVertical: 12,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34A853",
    marginRight: 12,
  },
  endDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EA4335",
    marginRight: 12,
  },
  routeAddress: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  stopsIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 5,
    marginVertical: 4,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: "#E0E0E0",
    marginRight: 10,
  },
  stopsText: {
    fontSize: 12,
    marginLeft: 4,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  tripAvgSpeed: {
    fontSize: 12,
  },
});
