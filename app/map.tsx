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
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import * as Location from "expo-location";
import { Gyroscope, Magnetometer } from "expo-sensors";
import { router } from "expo-router";

/**
 * Google Maps-style main screen
 * Stage 6: Full navigation with turn-by-turn, speed limits, highway guidance
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<any>(null);
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
  const [stops, setStops] = useState<
    {
      id: string;
      latitude: number;
      longitude: number;
      address: string;
    }[]
  >([]);
  const [showStopsPanel, setShowStopsPanel] = useState(false);
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
  const [heading, setHeading] = useState(0); // Legacy - kept for compatibility
  const [rawHeading, setRawHeading] = useState(0); // STAGE 4.1: Raw sensor value
  const [smoothedHeading, setSmoothedHeading] = useState(0); // STAGE 4.1: Interpolated value
  const [cameraBearing, setCameraBearing] = useState(0); // STAGE 4.2: Camera rotation
  const [cameraPitch, setCameraPitch] = useState(0); // STAGE 4.3: Camera tilt angle
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(-1); // STAGE 5.1: Track current stop (-1 = none)
  const [isInArrivalZone, setIsInArrivalZone] = useState(false); // STAGE 5.2: Within 10-20m of destination
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

  // STAGE 4.1: Smooth heading interpolation with max delta
  const smoothHeadingValue = (target: number, current: number): number => {
    // Normalize angles to 0-360
    target = ((target % 360) + 360) % 360;
    current = ((current % 360) + 360) % 360;

    // Calculate shortest path delta
    let delta = target - current;
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }

    // Max delta per frame: 10 degrees (smooth but responsive)
    const MAX_DELTA = 10;
    if (Math.abs(delta) > MAX_DELTA) {
      delta = Math.sign(delta) * MAX_DELTA;
    }

    // Apply delta and normalize
    const result = current + delta;
    return ((result % 360) + 360) % 360;
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

  // STAGE 4.1: Smooth heading interpolation with frame-based updates
  useEffect(() => {
    if (!isSensorsActive) return;

    const intervalId = setInterval(() => {
      setSmoothedHeading((prev) => smoothHeadingValue(rawHeading, prev));
    }, 16); // 60 FPS

    return () => clearInterval(intervalId);
  }, [rawHeading, isSensorsActive]);

  // STAGE 4.2: Camera bearing smoothing with speed-based easing
  useEffect(() => {
    if (!isNavigating) return;

    const speed = userLocation?.speed || 0; // m/s
    const speedKmh = speed * 3.6;

    // Calculate easing factor based on speed
    // Low speed (0-10 km/h): slow easing (0.02-0.05)
    // Medium speed (10-50 km/h): medium easing (0.05-0.15)
    // High speed (50+ km/h): fast easing (0.15-0.25)
    let easingFactor = 0.02; // Default: very slow
    if (speedKmh > 50) {
      easingFactor = 0.25; // Fast easing at highway speeds
    } else if (speedKmh > 10) {
      easingFactor = 0.05 + ((speedKmh - 10) / 40) * 0.1; // Interpolate between 0.05 and 0.15
    } else if (speedKmh > 0) {
      easingFactor = 0.02 + (speedKmh / 10) * 0.03; // Interpolate between 0.02 and 0.05
    }

    const intervalId = setInterval(() => {
      setCameraBearing((prev) => {
        const target = smoothedHeading;

        // Calculate shortest path
        let delta = target - prev;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        // Apply easing
        const result = prev + delta * easingFactor;
        return ((result % 360) + 360) % 360;
      });
    }, 50); // 20 FPS for camera (smoother, less battery intensive)

    return () => clearInterval(intervalId);
  }, [smoothedHeading, isNavigating, userLocation?.speed]);

  // STAGE 4.3: Dynamic camera pitch based on speed
  useEffect(() => {
    if (!isNavigating) {
      setCameraPitch(0); // Reset to 0 when not navigating
      return;
    }

    const speed = userLocation?.speed || 0; // m/s
    const speedKmh = speed * 3.6;

    // Calculate target pitch based on speed ranges
    let targetPitch = 0;
    if (speedKmh <= 10) {
      // 0-10 km/h: Linear interpolation from 0° to 15°
      targetPitch = (speedKmh / 10) * 15;
    } else if (speedKmh <= 50) {
      // 10-50 km/h: Linear interpolation from 15° to 30°
      targetPitch = 15 + ((speedKmh - 10) / 40) * 15;
    } else {
      // 50+ km/h: Linear interpolation from 30° to 60°
      const speedOver50 = Math.min(speedKmh - 50, 50); // Cap at 100 km/h
      targetPitch = 30 + (speedOver50 / 50) * 30;
    }

    // Smooth transition to target pitch
    const intervalId = setInterval(() => {
      setCameraPitch((prev) => {
        const delta = targetPitch - prev;
        const easingFactor = 0.1; // Smooth but responsive
        return prev + delta * easingFactor;
      });
    }, 50); // 20 FPS

    return () => clearInterval(intervalId);
  }, [isNavigating, userLocation?.speed]);

  // Auto-center on user's current location when map loads
  useEffect(() => {
    const getCenterOnUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude, speed: 0 });
          
          // Center map on user location
          mapRef.current?.animateToRegion(
            {
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000,
          );
        }
      } catch (error) {
        console.log("Could not get initial location:", error);
      }
    };

    getCenterOnUserLocation();
  }, []); // Run once on mount

  // Calculate route with Google Directions API
  // STAGE 5.3: Filter and prioritize navigation instructions
  const filterNavigationSteps = (steps: any[]) => {
    const filtered = [];
    const noiseKeywords = [
      "continue straight",
      "continue onto",
      "head",
      "slight",
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const instruction = step.html_instructions.toLowerCase();
      const distance = step.distance.value;

      // Skip very short steps (< 50m) unless it's a turn
      if (distance < 50 && !instruction.includes("turn")) {
        continue;
      }

      // Skip noise instructions unless significant distance
      let isNoise = false;
      for (const keyword of noiseKeywords) {
        if (instruction.includes(keyword) && distance < 200) {
          isNoise = true;
          break;
        }
      }

      if (!isNoise) {
        filtered.push(step);
      }
    }

    // Always keep at least the first step
    if (filtered.length === 0 && steps.length > 0) {
      filtered.push(steps[0]);
    }

    return filtered;
  };

  const calculateRoute = async (destLat: number, destLng: number) => {
    if (!userLocation) return;

    try {
      const origin = `${userLocation.latitude},${userLocation.longitude}`;
      const destination = `${destLat},${destLng}`;

      // Build waypoints parameter if there are stops
      let waypointsParam = "";
      if (stops.length > 0) {
        const waypoints = stops
          .map((stop) => `${stop.latitude},${stop.longitude}`)
          .join("|");
        waypointsParam = `&waypoints=optimize:true|${waypoints}`;
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        // Combine all steps from all legs
        navigationSteps.current = [];
        let totalDuration = 0;
        route.legs.forEach((leg: any) => {
          // STAGE 5.3: Filter out noise instructions
          const filteredSteps = filterNavigationSteps(leg.steps);
          navigationSteps.current.push(...filteredSteps);
          totalDuration += leg.duration.value;
        });
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

        // Calculate total ETA
        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);
        setEta(hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`);

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

            // Animate camera to follow user (zoom closer during navigation)
            mapRef.current?.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: isNavigating ? 0.005 : 0.01,
                longitudeDelta: isNavigating ? 0.005 : 0.01,
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

          // STAGE 4.1: Update raw heading for smooth interpolation
          setRawHeading(currentHeading.current);
          setHeading(currentHeading.current); // Legacy compatibility
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
          async (location) => {
            const { latitude, longitude, speed } = location.coords;
            setUserLocation({ latitude, longitude, speed: speed || 0 });

            // Check if user has deviated from route
            if (routeCoordinates.length > 0) {
              // Find closest point on route
              let minDistance = Infinity;

              for (let i = 0; i < routeCoordinates.length; i++) {
                const dist = calculateDistance(
                  latitude,
                  longitude,
                  routeCoordinates[i].latitude,
                  routeCoordinates[i].longitude,
                );
                if (dist < minDistance) {
                  minDistance = dist;
                }
              }

              // If user is more than 50 meters off route, recalculate
              if (minDistance > 0.05 && destination) {
                console.log(
                  `Off route by ${(minDistance * 1000).toFixed(0)}m - recalculating...`,
                );
                try {
                  // Build waypoints parameter if there are stops
                  let waypointsParam = "";
                  if (stops.length > 0) {
                    const waypoints = stops
                      .map((stop) => `${stop.latitude},${stop.longitude}`)
                      .join("|");
                    waypointsParam = `&waypoints=optimize:true|${waypoints}`;
                  }

                  const origin = `${latitude},${longitude}`;
                  const dest = `${destination.latitude},${destination.longitude}`;
                  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}${waypointsParam}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;

                  const response = await fetch(url);
                  const data = await response.json();

                  if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const points = decodePolyline(
                      route.overview_polyline.points,
                    );
                    setRouteCoordinates(points);

                    // Update navigation steps
                    navigationSteps.current = [];
                    let totalDuration = 0;
                    route.legs.forEach((leg: any) => {
                      // STAGE 5.3: Filter out noise instructions
                      const filteredSteps = filterNavigationSteps(leg.steps);
                      navigationSteps.current.push(...filteredSteps);
                      totalDuration += leg.duration.value;
                    });
                    currentStepIndex.current = 0;

                    // Update instruction
                    if (navigationSteps.current.length > 0) {
                      setCurrentInstruction(
                        navigationSteps.current[0].html_instructions.replace(
                          /<[^>]*>/g,
                          "",
                        ),
                      );
                      setDistanceToNextTurn(
                        navigationSteps.current[0].distance.value,
                      );
                    }

                    // Update ETA
                    const hours = Math.floor(totalDuration / 3600);
                    const minutes = Math.floor((totalDuration % 3600) / 60);
                    setEta(
                      hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`,
                    );
                  }
                } catch (error) {
                  console.error("Error recalculating route:", error);
                }
              }
            }

            // STAGE 5.1: Check if we've arrived at current stop (auto-advance)
            if (stops.length > 0 && currentStopIndex < stops.length) {
              const targetStopIndex =
                currentStopIndex === -1 ? 0 : currentStopIndex;
              if (targetStopIndex < stops.length) {
                const currentStop = stops[targetStopIndex];
                const distToStop = calculateDistance(
                  latitude,
                  longitude,
                  currentStop.latitude,
                  currentStop.longitude,
                );

                // Auto-advance when within 10m of current stop
                if (distToStop < 0.01) {
                  // 10 meters
                  console.log(`Arrived at stop: ${currentStop.address}`);
                  setCurrentStopIndex(targetStopIndex + 1);
                }
              }
            }

            // STAGE 5.2: Arrival zone detection for final destination
            if (destination && currentStopIndex >= stops.length) {
              const distToDestination = calculateDistance(
                latitude,
                longitude,
                destination.latitude,
                destination.longitude,
              );

              // Enter arrival zone when within 20m
              if (distToDestination < 0.02 && !isInArrivalZone) {
                console.log("Entering arrival zone (< 20m)");
                setIsInArrivalZone(true);
              }
            }

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

              // STAGE 5.3: Move to next step with better threshold (30m for filtered steps)
              if (dist < 0.03) {
                // 30 meters
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

            // Animate camera - STAGE 4.2 & 4.3: Bearing + Pitch
            // STAGE 5.2: Freeze camera at destination when in arrival zone
            if (isInArrivalZone && destination) {
              // Freeze camera at destination location
              mapRef.current?.animateToRegion(
                {
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                  // @ts-ignore
                  heading: cameraBearing,
                  // @ts-ignore
                  pitch: 45, // Angled view of destination
                },
                300,
              );
            } else {
              // Normal following behavior
              mapRef.current?.animateToRegion(
                {
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                  // @ts-ignore - heading and pitch are supported but not in type definition
                  heading: cameraBearing,
                  // @ts-ignore
                  pitch: cameraPitch,
                },
                300,
              );
            }
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
        setCurrentStopIndex(stops.length > 0 ? 0 : -1); // STAGE 5.1: Start at first stop
        setIsInArrivalZone(false); // STAGE 5.2: Reset arrival zone
      } catch (error) {
        console.error("Error starting navigation:", error);
        Alert.alert("Error", "Failed to start navigation");
      }
    }
  };

  const handlePlaceSelect = async (data: any, details: any) => {
    if (details?.geometry?.location) {
      const { lat, lng } = details.geometry.location;

      // If no destination yet, set it as destination
      if (!destination) {
        setDestination({
          latitude: lat,
          longitude: lng,
          address: data.description,
        });
      } else {
        // Add as a stop before the destination
        const newStop = {
          id: Date.now().toString(),
          latitude: lat,
          longitude: lng,
          address: data.description,
        };
        setStops((prev) => [...prev, newStop]);
      }

      // Clear search input
      searchRef.current?.setAddressText("");

      // Get current location first if not available
      if (!userLocation) {
        await handleMyLocation();
      }

      // Fetch route
      await calculateRoute(lat, lng);
    }
    Keyboard.dismiss();
  };

  const handleRemoveStop = async (stopId: string) => {
    const updatedStops = stops.filter((stop) => stop.id !== stopId);
    setStops(updatedStops);
    setCurrentStopIndex(updatedStops.length > 0 && isNavigating ? 0 : -1); // STAGE 5.1: Reset stop index

    // Recalculate route if destination exists
    if (destination) {
      await calculateRoute(destination.latitude, destination.longitude);
    }
  };

  // STAGE 5.1: Manual advance to next stop
  const handleNextStop = () => {
    if (stops.length > 0 && currentStopIndex < stops.length) {
      const nextIndex = currentStopIndex === -1 ? 0 : currentStopIndex + 1;
      setCurrentStopIndex(nextIndex);
      console.log(`Manually advanced to stop ${nextIndex + 1}/${stops.length}`);
    }
  };

  const handleRemoveDestination = () => {
    setDestination(null);
    setStops([]);
    setRouteCoordinates([]);
    setCurrentInstruction("");
    setEta("");
  };

  const onStopsDragEnd = async (data: typeof stops) => {
    setStops(data);
    setCurrentStopIndex(data.length > 0 && isNavigating ? 0 : -1); // STAGE 5.1: Reset to first stop

    // Recalculate route with new order
    if (destination) {
      await calculateRoute(destination.latitude, destination.longitude);
    }
  };

  const renderStopItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<(typeof stops)[0]>) => {
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
              onPress={() => handleRemoveStop(item.id)}
              style={styles.stopItemButton}
            >
              <Ionicons name="trash-outline" size={16} color="#EA4335" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
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

        {/* User Arrow Marker during navigation - STAGE 4.1: Uses smoothedHeading */}
        {isNavigating && userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={smoothedHeading}
          >
            <View style={styles.arrowMarker}>
              <MaterialCommunityIcons
                name="navigation"
                size={32}
                color="#4285F4"
              />
            </View>
          </Marker>
        )}

        {/* Stop Markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{
              latitude: stop.latitude,
              longitude: stop.longitude,
            }}
            title={`Stop ${index + 1}`}
            description={stop.address}
          >
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{index + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Destination"
            description={destination.address}
            pinColor="#EA4335"
          />
        )}
      </MapView>

      {/* Search Bar at Top - Google Maps style with real autocomplete */}
      {!isNavigating && (
        <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
          <GooglePlacesAutocomplete
            ref={searchRef}
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
      )}

      {/* Right side buttons container */}
      <View
        style={[styles.rightButtonsContainer, { bottom: insets.bottom + 100 }]}
      >
        {/* Stats Button - STAGE 7.1 */}
        {!isNavigating && (
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => router.push("/(main)/stats")}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={24}
              color="#1A73E8"
            />
          </TouchableOpacity>
        )}

        {/* Stops Panel Button */}
        {destination && !isNavigating && (
          <TouchableOpacity
            style={styles.stopsButton}
            onPress={() => setShowStopsPanel(!showStopsPanel)}
          >
            <MaterialCommunityIcons
              name="map-marker-multiple"
              size={24}
              color="#1A73E8"
            />
            {stops.length > 0 && (
              <View style={styles.stopsBadge}>
                <Text style={styles.stopsBadgeText}>{stops.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* My Location Button */}
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={handleMyLocation}
        >
          <Ionicons name="locate" size={24} color="#1A73E8" />
        </TouchableOpacity>
      </View>

      {/* Stops Panel */}
      {showStopsPanel && !isNavigating && (
        <View style={[styles.stopsPanel, { bottom: insets.bottom + 180 }]}>
          <View style={styles.stopsPanelHeader}>
            <Text style={styles.stopsPanelTitle}>Route Stops</Text>
            <TouchableOpacity onPress={() => setShowStopsPanel(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <DraggableFlatList
            data={stops}
            onDragEnd={({ data }) => onStopsDragEnd(data)}
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
                  {destination?.address}
                </Text>
                <TouchableOpacity
                  onPress={handleRemoveDestination}
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
      )}

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
          <Text style={styles.stageSubtext}>Search destination to begin</Text>
        </View>
      )}

      {/* Navigation Instructions Panel */}
      {isNavigating && (currentInstruction || isInArrivalZone) && (
        <View style={[styles.instructionPanel, { top: insets.top + 10 }]}>
          <View style={styles.instructionHeader}>
            <MaterialCommunityIcons
              name={isInArrivalZone ? "flag-checkered" : "navigation"}
              size={32}
              color={isInArrivalZone ? "#34A853" : "#4285F4"}
            />
            <View style={styles.instructionContent}>
              {isInArrivalZone ? (
                <>
                  <Text style={styles.arrivalText}>
                    Arriving at destination
                  </Text>
                  <Text style={styles.arrivalSubtext}>
                    {destination?.address}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.distanceText}>
                    {distanceToNextTurn < 1000
                      ? `${Math.round(distanceToNextTurn)} m`
                      : `${(distanceToNextTurn / 1000).toFixed(1)} km`}
                  </Text>
                  <Text style={styles.instructionText}>
                    {currentInstruction}
                  </Text>
                </>
              )}
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

          {/* STAGE 5.1: Next Stop Button */}
          {stops.length > 0 && currentStopIndex < stops.length && (
            <TouchableOpacity
              style={styles.nextStopButton}
              onPress={handleNextStop}
            >
              <Ionicons name="flag" size={20} color="#fff" />
              <Text style={styles.nextStopButtonText}>
                {currentStopIndex === -1 || currentStopIndex === 0
                  ? `Stop 1/${stops.length}`
                  : `Stop ${currentStopIndex + 1}/${stops.length}`}
              </Text>
            </TouchableOpacity>
          )}
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
  arrowMarker: {
    width: 40,
    height: 40,
    backgroundColor: "#fff",
    opacity: 0.9,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  rightButtonsContainer: {
    position: "absolute",
    right: 16,
    flexDirection: "column",
    gap: 12,
  },
  myLocationButton: {
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
  stopsButton: {
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
  statsButton: {
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
  arrivalText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#34A853",
    marginBottom: 4,
  },
  arrivalSubtext: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
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
  nextStopButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34A853",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    justifyContent: "center",
  },
  nextStopButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
  stopMarker: {
    width: 32,
    height: 32,
    backgroundColor: "#4285F4",
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stopMarkerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  stopsBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EA4335",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  stopsBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stopsPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    maxHeight: 300,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  stopsPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  stopsPanelTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  stopsList: {
    maxHeight: 200,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    backgroundColor: "#fff",
  },
  stopItemDragging: {
    backgroundColor: "#f9f9f9",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stopItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  destinationNumber: {
    backgroundColor: "#EA4335",
  },
  stopItemNumberText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  stopItemAddress: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  stopItemActions: {
    flexDirection: "row",
    gap: 8,
  },
  stopItemButton: {
    padding: 4,
  },
  stopsPanelFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  stopsPanelHint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});
