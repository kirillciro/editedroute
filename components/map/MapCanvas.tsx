import React from "react";
import { Text, View } from "react-native";
import MapView, {
  AnimatedRegion,
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
} from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { styles } from "@/components/map/mapScreen.styles";
import type { MapDestination, MapStop, UserLocation } from "@/types/mapRoute";

import type { MapLayerType, NavViewMode } from "@/types/mapUi";
type Coord = { latitude: number; longitude: number };

type Props = {
  mapRef: React.RefObject<MapView | null>;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };

  mapType: MapLayerType;
  showsTraffic: boolean;
  showsBuildings: boolean;
  showsIndoors: boolean;
  showsCompass: boolean;

  isNavigating: boolean;
  userLocation: UserLocation | null;
  smoothedHeading: number;

  routeCoordinates: Coord[];
  stops: MapStop[];
  destination: MapDestination | null;

  navMarkerRegionRef: React.MutableRefObject<AnimatedRegion | null>;
  navViewModeRef: React.MutableRefObject<NavViewMode>;
  onSetNavViewMode: (mode: NavViewMode) => void;

  onMapReady: () => void;
};

export function MapCanvas({
  mapRef,
  initialRegion,
  mapType,
  showsTraffic,
  showsBuildings,
  showsIndoors,
  showsCompass,
  isNavigating,
  userLocation,
  smoothedHeading,
  routeCoordinates,
  stops,
  destination,
  navMarkerRegionRef,
  navViewModeRef,
  onSetNavViewMode,
  onMapReady,
}: Props) {
  return (
    <MapView
      ref={mapRef as any}
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialRegion={initialRegion}
      mapType={mapType}
      showsTraffic={showsTraffic}
      showsBuildings={showsBuildings}
      showsIndoors={showsIndoors}
      onMapReady={onMapReady}
      onPanDrag={() => {
        if (isNavigating && navViewModeRef.current === "follow") {
          onSetNavViewMode("free");
        }
      }}
      showsUserLocation={!!userLocation}
      showsMyLocationButton={false}
      showsCompass={showsCompass}
      showsScale={true}
      rotateEnabled={true}
      pitchEnabled={true}
    >
      {routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#4285F4"
          strokeWidth={5}
        />
      )}

      {isNavigating && userLocation && (
        <Marker.Animated
          coordinate={
            (navMarkerRegionRef.current as any) || {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }
          }
          anchor={{ x: 0.5, y: 0.5 }}
          flat={true}
          rotation={smoothedHeading}
        >
          <View style={styles.arrowMarker}>
            <MaterialCommunityIcons name="navigation" size={44} color="#4285F4" />
          </View>
        </Marker.Animated>
      )}

      {stops.map((stop, index) => (
        <Marker
          key={stop.id}
          coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
          title={`Stop ${index + 1}`}
          description={stop.address}
        >
          <View style={styles.stopMarker}>
            <Text style={styles.stopMarkerText}>{index + 1}</Text>
          </View>
        </Marker>
      ))}

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
  );
}
