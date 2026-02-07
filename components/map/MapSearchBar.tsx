import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import {
  GooglePlacesAutocomplete,
  type GooglePlaceData,
  type GooglePlaceDetail,
} from "react-native-google-places-autocomplete";

import { styles } from "@/components/map/mapScreen.styles";

type Props = {
  visible: boolean;
  topInset: number;
  searchRef: React.RefObject<any>;
  onPlaceSelect: (
    data: GooglePlaceData,
    details: GooglePlaceDetail | null,
  ) => void;
  googleMapsApiKey: string;
  userLocation: { latitude: number; longitude: number } | null;
};

export function MapSearchBar({
  visible,
  topInset,
  searchRef,
  onPlaceSelect,
  googleMapsApiKey,
  userLocation,
}: Props) {
  if (!visible) return null;

  return (
    <View style={[styles.searchContainer, { top: topInset + 10 }]}>
      <GooglePlacesAutocomplete
        ref={searchRef}
        placeholder="Search here"
        fetchDetails={true}
        onPress={onPlaceSelect}
        query={{
          key: googleMapsApiKey,
          language: "en",
          location: userLocation
            ? `${userLocation.latitude},${userLocation.longitude}`
            : undefined,
          radius: 50000,
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
  );
}
