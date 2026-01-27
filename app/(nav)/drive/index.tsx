import { useStops } from "@/context/StopsContext";
import { LatLng } from "@/types/navigation";
import { useLocationTracking } from "@/utils/useLocationTracking";
import { useRouteRecording } from "@/utils/useRouteRecording";
import { useSensorFusion } from "@/utils/useSensorFusion";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

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
    heading: gpsHeading,
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
    // Keep the marker at the real position; we apply "look-ahead" only to the camera center.
    enableCameraLookAhead: false,
    lookAheadDistance: 100,
    gpsTimeIntervalMs: 1000,
    gpsDistanceIntervalM: 2,
  });

  // Sensor fusion for smooth 60 FPS rotation (backup for when GPS heading unavailable)
  const {
    fusedHeading,
    compassHeading,
    isCalibrated,
    startFusion,
    stopFusion,
  } = useSensorFusion();

  // Route recording
  const routeRecording = useRouteRecording();
  const { currentDistance, currentDuration } = routeRecording;

  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const [debugHeading, setDebugHeading] = useState(0);

  const didApplyNavCameraRef = useRef(false);

  // Refs (no re-renders) for Google-style animation loop
  const gpsHeadingRef = useRef(0);
  const fusedHeadingRef = useRef(0);
  const compassHeadingRef = useRef(0);
  const speedRef = useRef(0);
  const arrowHeadingRef = useRef(0);
  const cameraHeadingRef = useRef(0);
  const lastCameraUpdateRef = useRef(0);
  const navRafId = useRef<number | null>(null);

  const arrowRotation = useRef(new Animated.Value(0));

  // Prefer OS-provided device heading (tilt-compensated). This is the most reliable
  // source for "heading-up" behavior and typically matches Google/Waze.
  const deviceHeadingRef = useRef(0);
  const lastDeviceHeadingUpdateRef = useRef(0);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null,
  );

  useEffect(() => {
    gpsHeadingRef.current = gpsHeading;
  }, [gpsHeading]);

  useEffect(() => {
    compassHeadingRef.current = compassHeading;
  }, [compassHeading]);

  useEffect(() => {
    fusedHeadingRef.current = fusedHeading;
  }, [fusedHeading]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const wrap360 = (angle: number): number => {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a; // Return wrapped angle
  };

  // Returns a delta in [-180, 180]
  const normalizeDelta = (angle: number) => ((angle + 540) % 360) - 180;

  /**
   * Auto-start tracking when screen loads
   */
  useEffect(() => {
    startTracking();
    startFusion();

    return () => {
      stopTracking();
      stopFusion();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Center on user location when it first becomes available
   */
  useEffect(() => {
    // Don't fight navigation camera once navigation has started
    if (navigationStarted) return;

    if (!initialLocationSet && location && mapRef.current && mapReady) {
      console.log(
        "Zooming to location:",
        location.latitude._value,
        location.longitude._value,
      );
      // Zoom to user location on first load
      setTimeout(() => {
        mapRef.current?.animateCamera(
          {
            center: {
              latitude: location.latitude._value,
              longitude: location.longitude._value,
            },
            zoom: 20, // Double-tap zoom level (very close)
            pitch: 0, // Flat view initially
            heading: 0,
          },
          { duration: 1000 }, // Smooth 1 second animation
        );
      }, 500); // Small delay to ensure map is ready
      setInitialLocationSet(true);
    }
  }, [location, initialLocationSet, mapReady, navigationStarted]);

  // Immediately snap into navigation camera (marker stays near bottom)
  useEffect(() => {
    if (!navigationStarted || !mapReady || !location || !mapRef.current) {
      return;
    }
    if (didApplyNavCameraRef.current) {
      return;
    }

    didApplyNavCameraRef.current = true;

    const wrap360Local = (angle: number): number => {
      let a = angle % 360;
      if (a < 0) a += 360;
      return a;
    };

    const heading = isCalibrated
      ? fusedHeadingRef.current
      : compassHeadingRef.current;
    arrowHeadingRef.current = wrap360Local(heading);
    cameraHeadingRef.current = wrap360Local(heading);
    arrowRotation.current.setValue(arrowHeadingRef.current);

    const speedKmh = (speedRef.current || 0) * 3.6;

    const lookAheadMeters = (() => {
      if (speedKmh <= 10) return 70;
      if (speedKmh <= 30) return 70 + ((speedKmh - 10) / 20) * 40; // 70..110
      if (speedKmh <= 60) return 110 + ((speedKmh - 30) / 30) * 60; // 110..170
      if (speedKmh <= 100) return 170 + ((speedKmh - 60) / 40) * 30; // 170..200
      return 200;
    })();

    const pitch = (() => {
      if (speedKmh <= 10) return 50;
      if (speedKmh <= 30) return 50 + ((speedKmh - 10) / 20) * 10; // 50..60
      return 65;
    })();

    const zoom = (() => {
      if (speedKmh <= 15) return 18.5;
      if (speedKmh <= 40) return 18.5 - ((speedKmh - 15) / 25) * 0.6; // 18.5..17.9
      if (speedKmh <= 80) return 17.9 - ((speedKmh - 40) / 40) * 0.6; // 17.9..17.3
      return 17.1;
    })();

    const offsetCoordinate = (
      anchor: { latitude: number; longitude: number },
      headingDegrees: number,
      meters: number,
    ) => {
      const headingRad = (headingDegrees * Math.PI) / 180;
      const latOffset = (meters * Math.cos(headingRad)) / 111320;
      const lngOffset =
        (meters * Math.sin(headingRad)) /
        (111320 * Math.cos((anchor.latitude * Math.PI) / 180));
      return {
        latitude: anchor.latitude + latOffset,
        longitude: anchor.longitude + lngOffset,
      };
    };

    const user = {
      latitude: location.latitude._value,
      longitude: location.longitude._value,
    };
    const lookAheadCenter = offsetCoordinate(
      user,
      cameraHeadingRef.current,
      lookAheadMeters,
    );

    mapRef.current.animateCamera(
      {
        center: lookAheadCenter,
        pitch,
        heading: cameraHeadingRef.current,
        zoom,
      },
      { duration: 650 },
    );

    lastCameraUpdateRef.current = Date.now();
  }, [navigationStarted, mapReady, location, isCalibrated]);

  // Subscribe to device heading while navigating
  useEffect(() => {
    const stop = () => {
      if (headingSubscriptionRef.current) {
        headingSubscriptionRef.current.remove();
        headingSubscriptionRef.current = null;
      }
      lastDeviceHeadingUpdateRef.current = 0;
    };

    if (!navigationStarted) {
      stop();
      return;
    }

    if (headingSubscriptionRef.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const sub = await Location.watchHeadingAsync((heading) => {
          // On iOS, trueHeading can be -1 if unavailable.
          const next =
            heading.trueHeading != null && heading.trueHeading >= 0
              ? heading.trueHeading
              : heading.magHeading;

          if (typeof next === "number" && !Number.isNaN(next)) {
            deviceHeadingRef.current = next;
            lastDeviceHeadingUpdateRef.current = Date.now();
          }
        });

        if (cancelled) {
          sub.remove();
          return;
        }

        headingSubscriptionRef.current = sub;
      } catch (e) {
        // Heading may be unavailable (e.g. simulator). We'll fall back to sensor fusion/GPS.
        console.warn("watchHeadingAsync unavailable:", e);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [navigationStarted]);

  /**
   * Google-style animation loop:
   * - Arrow rotation: 60fps RAF (no setState)
   * - Map camera: throttled (~10-12fps)
   */
  useEffect(() => {
    const stop = () => {
      if (navRafId.current != null) {
        cancelAnimationFrame(navRafId.current);
        navRafId.current = null;
      }
      lastCameraUpdateRef.current = 0;
    };

    if (!navigationStarted || !mapReady) {
      stop();
      return;
    }

    const pickTargetHeading = () => {
      // Google-like behavior: heading-up uses device heading continuously.
      // Prefer OS heading (tilt-compensated), then fused sensors, then GPS.
      const now = Date.now();
      if (now - lastDeviceHeadingUpdateRef.current < 1500) {
        return deviceHeadingRef.current;
      }

      if (isCalibrated) return fusedHeadingRef.current;

      const compass = compassHeadingRef.current;
      if (typeof compass === "number" && compass !== 0) return compass;

      // Last resort: use course/bearing when moving.
      const s = speedRef.current || 0;
      if (s >= 0.8) return gpsHeadingRef.current;

      return cameraHeadingRef.current;
    };

    // Seed headings to prevent a jump on start
    const initialTarget = pickTargetHeading();
    arrowHeadingRef.current = wrap360(initialTarget);
    cameraHeadingRef.current = wrap360(initialTarget);
    arrowRotation.current.setValue(arrowHeadingRef.current);

    const ARROW_SMOOTH = 0.2;
    const CAMERA_SMOOTH = 0.08;
    const CAMERA_INTERVAL_MS = 80; // ~12.5 fps

    const offsetCoordinate = (
      anchor: { latitude: number; longitude: number },
      headingDegrees: number,
      meters: number,
    ) => {
      const headingRad = (headingDegrees * Math.PI) / 180;
      const latOffset = (meters * Math.cos(headingRad)) / 111320;
      const lngOffset =
        (meters * Math.sin(headingRad)) /
        (111320 * Math.cos((anchor.latitude * Math.PI) / 180));
      return {
        latitude: anchor.latitude + latOffset,
        longitude: anchor.longitude + lngOffset,
      };
    };

    const computeLookAheadMeters = () => {
      // Google/Waze feel: more look-ahead as speed increases.
      const speedKmh = (speedRef.current || 0) * 3.6;

      if (speedKmh <= 10) return 55;
      if (speedKmh <= 30) return 55 + ((speedKmh - 10) / 20) * 35; // 55..90
      if (speedKmh <= 60) return 90 + ((speedKmh - 30) / 30) * 50; // 90..140
      if (speedKmh <= 100) return 140 + ((speedKmh - 60) / 40) * 30; // 140..170
      return 170;
    };

    const computePitch = () => {
      const speedKmh = (speedRef.current || 0) * 3.6;
      if (speedKmh <= 10) return 45;
      if (speedKmh <= 30) return 45 + ((speedKmh - 10) / 20) * 10; // 45..55
      if (speedKmh <= 70) return 55 + ((speedKmh - 30) / 40) * 7; // 55..62
      return 65;
    };

    const computeZoom = () => {
      const speedKmh = (speedRef.current || 0) * 3.6;
      // Slightly zoom out at higher speeds.
      if (speedKmh <= 15) return 18.6;
      if (speedKmh <= 40) return 18.6 - ((speedKmh - 15) / 25) * 0.5; // 18.6..18.1
      if (speedKmh <= 80) return 18.1 - ((speedKmh - 40) / 40) * 0.6; // 18.1..17.5
      return 17.2;
    };

    const tick = (time: number) => {
      const targetHeading = pickTargetHeading();

      // Arrow heading smoothing
      const arrowDiff = normalizeDelta(targetHeading - arrowHeadingRef.current);
      arrowHeadingRef.current = wrap360(
        arrowHeadingRef.current + arrowDiff * ARROW_SMOOTH,
      );
      arrowRotation.current.setValue(arrowHeadingRef.current);

      // Camera heading smoothing (separate feel)
      const camDiff = normalizeDelta(targetHeading - cameraHeadingRef.current);
      cameraHeadingRef.current = wrap360(
        cameraHeadingRef.current + camDiff * CAMERA_SMOOTH,
      );

      // Throttled camera updates
      if (
        location &&
        mapRef.current &&
        (lastCameraUpdateRef.current === 0 ||
          time - lastCameraUpdateRef.current >= CAMERA_INTERVAL_MS)
      ) {
        const user = {
          latitude: location.latitude._value,
          longitude: location.longitude._value,
        };
        const lookAheadCenter = offsetCoordinate(
          user,
          cameraHeadingRef.current,
          computeLookAheadMeters(),
        );

        mapRef.current.animateCamera(
          {
            center: lookAheadCenter,
            pitch: computePitch(),
            heading: cameraHeadingRef.current,
            zoom: computeZoom(),
          },
          { duration: CAMERA_INTERVAL_MS },
        );
        lastCameraUpdateRef.current = time;
      }

      navRafId.current = requestAnimationFrame(tick);
    };

    navRafId.current = requestAnimationFrame(tick);
    return stop;
  }, [navigationStarted, mapReady, location, isCalibrated]);

  // Debug heading display (slow updates; not part of RAF loop)
  useEffect(() => {
    if (!navigationStarted) return;
    const id = setInterval(() => {
      setDebugHeading(arrowHeadingRef.current);
    }, 250);
    return () => clearInterval(id);
  }, [navigationStarted]);

  /**
   * Start navigation manually
   */
  const handleStartNavigation = async () => {
    try {
      setNavigationStarted(true);
      didApplyNavCameraRef.current = false;
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
        heading: gpsHeading,
        accuracy,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLocation]);

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
        scrollEnabled={false}
        zoomEnabled={true}
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
            coordinate={location as any}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: arrowRotation.current.interpolate({
                        inputRange: [0, 360],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.userMarkerDirection} />
              </Animated.View>
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

      {/* Debug: Heading display */}
      {navigationStarted && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Mode: {isCalibrated ? "Heading-up (fused)" : "Heading-up (compass)"}
          </Text>
          <Text style={styles.debugText}>GPS: {gpsHeading.toFixed(0)}°</Text>
          <Text style={styles.debugText}>
            Compass: {compassHeading.toFixed(0)}°
          </Text>
          <Text style={styles.debugText}>
            Fused: {fusedHeading.toFixed(0)}°
          </Text>
          <Text style={styles.debugText}>
            Arrow: {debugHeading.toFixed(0)}°
          </Text>
          <Text style={styles.debugText}>
            Speed: {(speed * 3.6).toFixed(1)} km/h
          </Text>
        </View>
      )}

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
  debugContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 140 : 120,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 8,
  },
  debugText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
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
    position: "absolute",
  },
  userMarkerDirection: {
    position: "absolute",
    top: 2,
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
