import Constants from "expo-constants";
import { Platform } from "react-native";

export function useGoogleMapsApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    (Platform.OS === "ios"
      ? // Prefer the native iOS config key (also ends up as GMSApiKey in Info.plist)
        ((Constants.expoConfig as any)?.ios?.config?.googleMapsApiKey as
          | string
          | undefined)
      : ((Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey as
          | string
          | undefined)) ||
    ((Constants.expoConfig as any)?.extra?.googleMapsApiKey as
      | string
      | undefined) ||
    ""
  );
}
