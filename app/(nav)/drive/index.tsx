import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform,
} from "react-native";
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useStops } from "@/context/StopsContext";
import { useLocationTracking } from "@/utils/useLocationTracking";
import { useSensorFusion } from "@/utils/useSensorFusion";
import { useRouteRecording } from "@/utils/useRouteRecording";
import { LatLng } from "@/types/navigation";
import { router } from "expo-router";

/**
 * Drive Navigation Screen
 * Full GPS tracking with smooth animation, polyline snapping,
 * sensor fusion for rotation, and route recording
 */
export default function DriveScreen() {
  const { stops } = useStops();
  const mapRef = useRef<MapView>(null);

  // Build route polyline from stops
  const routePolyline: LatLng[] = stops
    .filter((stop) => stop.lat && stop.lng)
    .map((stop) => ({
      latitude: stop.lat!,
      longitude: stop.lng!,
    }));

  // GPS tracking with all features
  const {
    location,
    rawLocation,
    speed,
    accuracy,
    isTracking,
    error: trackingError,
    startTracking,
    stopTracking,
  } = useLocationTracking(routePolyline, {
    enablePolylineSnapping: true,
    polylineSnapDistance: 50,
    enableNoiseFiltering: true,
    smoothingDuration: 400,
    enableCameraLookAhead: true,
    lookAheadDistance: 100,
  });

  // Sensor fusion for smooth 60 FPS rotation
  const { fusedHeading, isCalibrated, startFusion, stopFusion } =
    useSensorFusion();

  // Route recording
  const routeRecording = useRouteRecording();
  const { currentDistance, currentDuration } = routeRecording;

  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [navigationStarted, setNavigationStarted] = useState(false);

  /**
   * Start navigation manually
   */
  const handleStartNavigation = async () => {
    try {
      setNavigationStarted(true);
      // Start all services in parallel
      await Promise.all([
        startTracking(),
        Promise.resolve(startFusion()),
        Promise.resolve(routeRecording.startRecording()),
      ]);
    } catch (error) {
      console.error("Failed to start navigation:", error);
      Alert.alert(
        "Error",
        "Failed to start GPS tracking. Please check location permissions.",
        [{ text: "OK", onPress: () => setNavigationStarted(false) }],
      );
    }
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (navigationStarted) {
        try {
          stopTracking();
          stopFusion();
          routeRecording.stopRecording();
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationStarted]);

  /**
   * Update route recording with GPS points
   */
  useEffect(() => {
    if (rawLocation && isTracking && navigationStarted) {
      routeRecording.addRoutePoint({
        ...rawLocation,
        timestamp: Date.now(),
        speed,
        heading: fusedHeading,
        accuracy,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLocation]);

  /**
   * Follow user location on map
   */
  useEffect(() => {
    if (mapReady && location && mapRef.current && navigationStarted) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: location.latitude._value,
            longitude: location.longitude._value,
          },
          pitch: 60,
          heading: fusedHeading,
          zoom: 18,
        },
        { duration: 300 },
      );
    }
  }, [location, fusedHeading, mapReady, navigationStarted]);

  /**
   * Check if arrived at current stop
   */
  useEffect(() => {
    if (!rawLocation || currentStopIndex >= stops.length) return;

    const currentStop = stops[currentStopIndex];
    if (!currentStop.lat || !currentStop.lng) return;

    const distance = calculateDistance(rawLocation, {
      latitude: currentStop.lat,
      longitude: currentStop.lng,
    });

    // Arrived within 50 meters
    if (distance < 50) {
      Alert.alert("Stop Reached", `You've arrived at ${currentStop.address}`, [
        {
          text: "Next Stop",
          onPress: () => {
            if (currentStopIndex < stops.length - 1) {
              setCurrentStopIndex(currentStopIndex + 1);
            } else {
              Alert.alert(
                "Route Complete",
                "You've reached the final destination!",
              );
            }
          },
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLocation, currentStopIndex]);

  /**
   * Calculate distance between coordinates
   */
  const calculateDistance = (coord1: LatLng, coord2: LatLng): number => {
    const R = 6371e3;
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  /**
   * Format duration (seconds to MM:SS)
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Handle end navigation
   */
  const handleEndNavigation = () => {
    Alert.alert("End Navigation", "Are you sure you want to end navigation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: () => {
          try {
            stopTracking();
            stopFusion();
            routeRecording.stopRecording();
            router.back();
          } catch (error) {
            console.error("Error stopping navigation:", error);
            router.back(); // Still go back even if cleanup fails
          }
        },
      },
    ]);
  };

  if (trackingError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {trackingError}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={true}
        pitchEnabled={true}
        onMapReady={() => setMapReady(true)}
        initialRegion={
          stops.length > 0 && stops[0].lat && stops[0].lng
            ? {
                latitude: stops[0].lat,
                longitude: stops[0].lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : undefined
        }
      >
        {/* Route polyline */}
        {routePolyline.length > 1 && (
          <Polyline
            coordinates={routePolyline}
            strokeColor="#007AFF"
            strokeWidth={4}
          />
        )}

        {/* Stop markers */}
        {stops
          .filter((stop) => stop.lat && stop.lng)
          .map((stop, index) => (
            <Marker
              key={stop.id}
              coordinate={{
                latitude: stop.lat!,
                longitude: stop.lng!,
              }}
              title={stop.address}
              pinColor={index === currentStopIndex ? "red" : "gray"}
            />
          ))}

        {/* User location marker with rotation */}
        {location && (
          <Marker.Animated
            coordinate={{
              latitude: location.latitude._value,
              longitude: location.longitude._value,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={fusedHeading}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
              <View style={styles.userMarkerDirection} />
            </View>
          </Marker.Animated>
        )}
      </MapView>

      {/* Stats overlay */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(speed * 3.6).toFixed(0)}</Text>
          <Text style={styles.statLabel}>km/h</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {(currentDistance / 1000).toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {formatDuration(currentDuration)}
          </Text>
          <Text style={styles.statLabel}>time</Text>
        </View>
      </View>

      {/* Current stop info */}
      {currentStopIndex < stops.length && (
        <View style={styles.stopInfo}>
          <Text style={styles.stopNumber}>
            Stop {currentStopIndex + 1} / {stops.length}
          </Text>
          <Text style={styles.stopAddress} numberOfLines={2}>
            {stops[currentStopIndex].address}
          </Text>
        </View>
      )}

      {/* Calibration indicator */}
      {!isCalibrated && (
        <View style={styles.calibrationBanner}>
          <Text style={styles.calibrationText}>Calibrating sensors...</Text>
        </View>
      )}

      {/* Start/End navigation button */}
      {!navigationStarted ? (
        <TouchableOpacity
          style={[styles.endButton, { backgroundColor: "#34C759" }]}
          onPress={handleStartNavigation}
        >
          <Text style={styles.endButtonText}>START TRACKING</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndNavigation}
        >
          <Text style={styles.endButtonText}>END NAVIGATION</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    minWidth: 80,
  },
  statValue: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#AAA",
    fontSize: 12,
    marginTop: 4,
  },
  stopInfo: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 16,
    padding: 16,
  },
  stopNumber: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  stopAddress: {
    color: "#FFF",
    fontSize: 16,
  },
  calibrationBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 140 : 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 193, 7, 0.9)",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  calibrationText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
  },
  endButton: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#FF3B30",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  endButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  userMarker: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  userMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#007AFF",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  userMarkerDirection: {
    position: "absolute",
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#007AFF",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#000",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
