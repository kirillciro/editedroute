import type {
  GooglePlaceData,
  GooglePlaceDetail,
} from "react-native-google-places-autocomplete";

export function getLatLngFromPlaceDetails(details: GooglePlaceDetail | null): {
  lat: number;
  lng: number;
} | null {
  const lat = details?.geometry?.location?.lat;
  const lng = details?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export function getPlaceDescription(data: GooglePlaceData): string {
  return typeof data?.description === "string" ? data.description : "";
}
