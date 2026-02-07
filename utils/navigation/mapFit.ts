import type MapView from "react-native-maps";

export type EdgePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type LatLng = { latitude: number; longitude: number };

export function fitMapToCoordinates(params: {
  map: MapView | null;
  points: LatLng[];
  edgePadding: EdgePadding;
  animated?: boolean;
}): void {
  const { map, points, edgePadding, animated = true } = params;
  if (!map) return;
  if (!points || points.length < 2) return;

  map.fitToCoordinates(points, { edgePadding, animated });
}
