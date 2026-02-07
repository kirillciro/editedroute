import * as Location from "expo-location";

type Coords = {
  latitude: number;
  longitude: number;
  speed?: number;
};

export type MyLocationOnceResult =
  | { kind: "ok"; coords: Coords }
  | { kind: "permission_denied" }
  | { kind: "error"; message: string; code?: string };

export async function getMyLocationOnce(params: {
  accuracy: Location.Accuracy;
}): Promise<MyLocationOnceResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return { kind: "permission_denied" };
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: params.accuracy,
    });

    const { latitude, longitude } = location.coords;
    const speed = location.coords.speed ?? undefined;
    return { kind: "ok", coords: { latitude, longitude, speed } };
  } catch (err: any) {
    const code = typeof err?.code === "string" ? err.code : undefined;

    let message = "Failed to get your location. Please try again.";
    if (code === "E_LOCATION_TIMEOUT") {
      message =
        "Location request timed out. Make sure you have a clear view of the sky and try again.";
    } else if (code === "E_LOCATION_UNAVAILABLE") {
      message =
        "Location services are unavailable. Please check your device settings.";
    }

    return { kind: "error", message, code };
  }
}
