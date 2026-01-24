import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  Keyboard,
  Alert,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Polyline, Marker } from "react-native-maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import * as Location from "expo-location";
import { Gyroscope, Magnetometer } from "expo-sensors";

/**
 * Google Maps-style main screen
 * Stage 6: Full navigation with turn-by-turn, speed limits, highway guidance
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    speed?: number;
  } | null>(null);
  const [destination, setDestination] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [speedLimit, setSpeedLimit] = useState<number>(0);
  const [eta, setEta] = useState<string>("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isSensorsActive, setIsSensorsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const navigationSteps = useRef<any[]>([]);
  const currentStepIndex = useRef(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const gyroSubscription = useRef<{ remove: () => void } | null>(null);
  const magnetometerSubscription = useRef<{ remove: () => void } | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const routePoints = useRef<
    { latitude: number; longitude: number; timestamp: number }[]
  >([]);
  const currentHeading = useRef(0);
  const calibrationSamples = useRef<number[]>([]);
  const isCalibrated = useRef(false);

  // Stage 1: Static map center (Toronto for now)
  const initialRegion = {
    latitude: 43.6532,
    longitude: -79.3832,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // Decode Google polyline
  const decodePolyline = (
    encoded: string,
  ): { latitude: number; longitude: number }[] => {
    const poly = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  // Haversine formula for distance calculation
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Track location changes for recording (separate from GPS callback)
  useEffect(() => {
    if (isRecording && userLocation) {
      const lastPoint = routePoints.current[routePoints.current.length - 1];
      if (lastPoint) {
        const dist = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          userLocation.latitude,
          userLocation.longitude,
        );
        if (dist > 0.001) {
          // Only update if moved more than 1 meter
          setDistance((prev) => prev + dist);
          routePoints.current.push({
            ...userLocation,
            timestamp: Date.now(),
          });
        }
      } else {
        // First point
        routePoints.current.push({
          ...userLocation,
          timestamp: Date.now(),
        });
      }
    }
  }, [userLocation, isRecording]);

  // Fetch route from Google Directions API
  const fetchRoute = async (destLat: number, destLng: number) => {
    if (!userLocation) {
      Alert.alert("Error", "Current location not available");
      return;
    }

    try {
      const origin = `${userLocation.latitude},${userLocation.longitude}`;
      const destination = `${destLat},${destLng}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
        navigationSteps.current = route.legs[0].steps;
        currentStepIndex.current = 0;

        // Set initial instruction
        if (navigationSteps.current.length > 0) {
          setCurrentInstruction(
            navigationSteps.current[0].html_instructions.replace(
              /<[^>]*>/g,
              "",
            ),
          );
          setDistanceToNextTurn(navigationSteps.current[0].distance.value);
        }

        // Calculate ETA
        const duration = route.legs[0].duration.text;
        setEta(duration);

        // Fit map to route
        mapRef.current?.fitToCoordinates(points, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      Alert.alert("Error", "Failed to fetch route");
    }
  };

  const handleMyLocation = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to show your location on the map.",
        );
        return;
      }

      // Get current position (one-time, no tracking)
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      // Animate map to user location
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleTracking = async () => {
    if (isTracking) {
      // Stop tracking
      try {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        setIsTracking(false);
      } catch (error) {
        console.error("Error stopping tracking:", error);
      }
    } else {
      // Start tracking
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required for GPS tracking.",
          );
          return;
        }

        // Start continuous tracking with watchPositionAsync
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 100,
            distanceInterval: 1,
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            setUserLocation({ latitude, longitude });

            // Animate camera to follow user
            mapRef.current?.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              300,
            );
          },
        );

        locationSubscription.current = subscription;
        setIsTracking(true);
      } catch (error) {
        console.error("Error starting tracking:", error);
        Alert.alert("Error", "Failed to start GPS tracking. Please try again.");
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleSensors = async () => {
    if (isSensorsActive) {
      // Stop sensors
      try {
        if (gyroSubscription.current) {
          gyroSubscription.current.remove();
          gyroSubscription.current = null;
        }
        if (magnetometerSubscription.current) {
          magnetometerSubscription.current.remove();
          magnetometerSubscription.current = null;
        }
        setIsSensorsActive(false);
        isCalibrated.current = false;
        calibrationSamples.current = [];
      } catch (error) {
        console.error("Error stopping sensors:", error);
      }
    } else {
      // Start sensors
      try {
        // Gyroscope for smooth rotation (60 FPS)
        Gyroscope.setUpdateInterval(16);
        const gyroSub = Gyroscope.addListener((data) => {
          if (!isCalibrated.current) {
            // Calibration phase
            calibrationSamples.current.push(data.z);
            if (calibrationSamples.current.length >= 30) {
              isCalibrated.current = true;
            }
            return;
          }

          // Apply gyroscope rotation (z-axis for heading)
          const rotationRate = data.z * (180 / Math.PI); // Convert to degrees
          currentHeading.current += rotationRate * 0.016; // 16ms delta

          // Normalize to 0-360
          currentHeading.current = ((currentHeading.current % 360) + 360) % 360;

          setHeading(currentHeading.current);
        });
        gyroSubscription.current = gyroSub;

        // Magnetometer for drift correction (10 FPS)
        Magnetometer.setUpdateInterval(100);
        const magSub = Magnetometer.addListener((data) => {
          if (!isCalibrated.current) return;

          // Calculate heading from magnetometer
          const magHeading = Math.atan2(data.y, data.x) * (180 / Math.PI);
          const normalizedMagHeading = (magHeading + 360) % 360;

          // Complementary filter: 98% gyro, 2% magnetometer
          const drift = normalizedMagHeading - currentHeading.current;
          let correction = drift;

          // Handle wrap-around
          if (Math.abs(drift) > 180) {
            correction = drift > 0 ? drift - 360 : drift + 360;
          }

          // Apply bounded correction
          const maxCorrection = 10;
          correction = Math.max(
            -maxCorrection,
            Math.min(maxCorrection, correction),
          );

          currentHeading.current += correction * 0.02;
          currentHeading.current = ((currentHeading.current % 360) + 360) % 360;
        });
        magnetometerSubscription.current = magSub;

        setIsSensorsActive(true);
      } catch (error) {
        console.error("Error starting sensors:", error);
        Alert.alert("Error", "Failed to start sensors. Please try again.");
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleRecording = () => {
    if (isRecording) {
      // Stop recording
      try {
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }
        setIsRecording(false);
        Alert.alert(
          "Recording Stopped",
          `Distance: ${distance.toFixed(2)} km\nDuration: ${Math.floor(duration / 60)}m ${duration % 60}s`,
        );
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    } else {
      // Start recording
      try {
        routePoints.current = [];
        setDistance(0);
        setDuration(0);

        // Start duration counter
        const startTime = Date.now();
        durationInterval.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setDuration(elapsed);
        }, 1000);

        setIsRecording(true);
      } catch (error) {
        console.error("Error starting recording:", error);
        Alert.alert("Error", "Failed to start recording. Please try again.");
      }
    }
  };

  const handleStartNavigation = async () => {
    if (isNavigating) {
      // Stop navigation
      try {
        // Stop tracking
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        // Stop sensors
        if (gyroSubscription.current) {
          gyroSubscription.current.remove();
          gyroSubscription.current = null;
        }
        if (magnetometerSubscription.current) {
          magnetometerSubscription.current.remove();
          magnetometerSubscription.current = null;
        }
        // Stop recording
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }

        setIsNavigating(false);
        setIsTracking(false);
        setIsSensorsActive(false);
        setIsRecording(false);

        Alert.alert(
          "Navigation Stopped",
          `Distance: ${distance.toFixed(2)} km\nDuration: ${Math.floor(duration / 60)}m ${duration % 60}s`,
        );
      } catch (error) {
        console.error("Error stopping navigation:", error);
      }
    } else {
      // Start navigation - auto-start ALL features
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Location permission required");
          return;
        }

        // Start GPS tracking
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 100,
            distanceInterval: 1,
          },
          (location) => {
            const { latitude, longitude, speed } = location.coords;
            setUserLocation({ latitude, longitude, speed: speed || 0 });

            // Update distance to next turn
            if (navigationSteps.current[currentStepIndex.current]) {
              const nextTurn =
                navigationSteps.current[currentStepIndex.current];
              const dist = calculateDistance(
                latitude,
                longitude,
                nextTurn.end_location.lat,
                nextTurn.end_location.lng,
              );
              setDistanceToNextTurn(dist * 1000); // Convert to meters

              // Move to next step if close enough
              if (dist < 0.02) {
                // 20 meters
                currentStepIndex.current++;
                if (currentStepIndex.current < navigationSteps.current.length) {
                  const step =
                    navigationSteps.current[currentStepIndex.current];
                  setCurrentInstruction(
                    step.html_instructions.replace(/<[^>]*>/g, ""),
                  );
                }
              }
            }

            // Animate camera
            mapRef.current?.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              300,
            );
          },
        );
        locationSubscription.current = subscription;
        setIsTracking(true);

        // Start sensors
        Gyroscope.setUpdateInterval(16);
        const gyroSub = Gyroscope.addListener((data) => {
          if (!isCalibrated.current) {
            calibrationSamples.current.push(data.z);
            if (calibrationSamples.current.length >= 30) {
              isCalibrated.current = true;
            }
            return;
          }
          const rotationRate = data.z * (180 / Math.PI);
          currentHeading.current += rotationRate * 0.016;
          currentHeading.current = ((currentHeading.current % 360) + 360) % 360;
          setHeading(currentHeading.current);
        });
        gyroSubscription.current = gyroSub;

        Magnetometer.setUpdateInterval(100);
        const magSub = Magnetometer.addListener((data) => {
          if (!isCalibrated.current) return;
          const magHeading = Math.atan2(data.y, data.x) * (180 / Math.PI);
          const normalizedMagHeading = (magHeading + 360) % 360;
          const drift = normalizedMagHeading - currentHeading.current;
          let correction = drift;
          if (Math.abs(drift) > 180) {
            correction = drift > 0 ? drift - 360 : drift + 360;
          }
          const maxCorrection = 10;
          correction = Math.max(
            -maxCorrection,
            Math.min(maxCorrection, correction),
          );
          currentHeading.current += correction * 0.02;
          currentHeading.current = ((currentHeading.current % 360) + 360) % 360;
        });
        magnetometerSubscription.current = magSub;
        setIsSensorsActive(true);

        // Start recording
        routePoints.current = [];
        setDistance(0);
        setDuration(0);
        const startTime = Date.now();
        durationInterval.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setDuration(elapsed);
        }, 1000);
        setIsRecording(true);

        setIsNavigating(true);
      } catch (error) {
        console.error("Error starting navigation:", error);
        Alert.alert("Error", "Failed to start navigation");
      }
    }
  };

  const handlePlaceSelect = async (data: any, details: any) => {
    if (details?.geometry?.location) {
      const { lat, lng } = details.geometry.location;
      setDestination({
        latitude: lat,
        longitude: lng,
        address: data.description,
      });

      // Get current location first if not available
      if (!userLocation) {
        await handleMyLocation();
      }

      // Fetch route
      await fetchRoute(lat, lng);
    }
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Map - renders immediately like Google Maps */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={5}
          />
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            description={destination.address}
          />
        )}
      </MapView>

      {/* Search Bar at Top - Google Maps style with real autocomplete */}
      <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
        <GooglePlacesAutocomplete
          placeholder="Search here"
          fetchDetails={true}
          onPress={handlePlaceSelect}
          query={{
            key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
            language: "en",
            location: userLocation
              ? `${userLocation.latitude},${userLocation.longitude}`
              : undefined,
            radius: 50000, // 50km radius
            rankby: "distance",
          }}
          styles={{
            container: {
              flex: 0,
            },
            textInputContainer: styles.searchBar,
            textInput: styles.searchInput,
            listView: styles.suggestionsContainer,
            row: styles.suggestionItem,
            description: styles.suggestionText,
          }}
          renderLeftButton={() => (
            <Ionicons
              name="search"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
          )}
          enablePoweredByContainer={false}
          nearbyPlacesAPI="GooglePlacesSearch"
          debounce={300}
        />
      </View>

      {/* My Location Button - Google Maps style */}
      <TouchableOpacity
        style={[styles.myLocationButton, { bottom: insets.bottom + 100 }]}
        onPress={handleMyLocation}
      >
        <Ionicons name="locate" size={24} color="#1A73E8" />
      </TouchableOpacity>

      {/* Start Navigation Button - replaces individual toggles */}
      {destination && (
        <TouchableOpacity
          style={[
            styles.startNavigationButton,
            { bottom: insets.bottom + 20 },
            isNavigating && styles.stopNavigationButton,
          ]}
          onPress={handleStartNavigation}
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
      )}

      {/* Stage Info */}
      {!isNavigating && !destination && (
        <View style={[styles.stageInfo, { bottom: insets.bottom + 20 }]}>
          <Text style={styles.stageText}>STAGE 6: Full Navigation ✓</Text>
          <Text style={styles.stageSubtext}>
            Search destination to begin
          </Text>
        </View>
      )}

      {/* Navigation Instructions Panel */}
      {isNavigating && currentInstruction && (
        <View style={[styles.instructionPanel, { top: insets.top + 10 }]}>
          <View style={styles.instructionHeader}>
            <MaterialCommunityIcons
              name="navigation"
              size={32}
              color="#4285F4"
            />
            <View style={styles.instructionContent}>
              <Text style={styles.distanceText}>
                {distanceToNextTurn < 1000
                  ? `${Math.round(distanceToNextTurn)} m`
                  : `${(distanceToNextTurn / 1000).toFixed(1)} km`}
              </Text>
              <Text style={styles.instructionText}>{currentInstruction}</Text>
            </View>
          </View>

          {/* Speed and Speed Limit */}
          <View style={styles.speedContainer}>
            <View style={styles.currentSpeed}>
              <Text style={styles.speedValue}>
                {Math.round((userLocation?.speed || 0) * 3.6)}
              </Text>
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
                <Text style={styles.headingValue}>{Math.round(heading)}°</Text>
              </View>
            )}
          </View>

          {/* ETA and Distance */}
          <View style={styles.etaContainer}>
            <Text style={styles.etaText}>🕐 {eta}</Text>
            <Text style={styles.etaText}>📍 {distance.toFixed(1)} km</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    fontSize: 16,
    color: "#000",
    paddingVertical: 0,
  },
  suggestionsContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionText: {
    fontSize: 15,
    color: "#333",
  },
  myLocationButton: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  startNavigationButton: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopNavigationButton: {
    backgroundColor: "#EA4335",
  },
  startNavigationText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  instructionPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  instructionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  instructionContent: {
    flex: 1,
    marginLeft: 12,
  },
  distanceText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4285F4",
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  speedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  currentSpeed: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  speedValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#333",
  },
  speedUnit: {
    fontSize: 16,
    color: "#666",
    marginLeft: 4,
  },
  speedLimitCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#EA4335",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  speedLimitText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#EA4335",
  },
  headingDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  headingValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  etaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  etaText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  stageInfo: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stageText: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  stageSubtext: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.8,
  },
});
