import { useCallback, useState } from "react";
import { Platform } from "react-native";

import type { MapLayerType } from "@/types/mapUi";

export function useMapLayers() {
  const [mapType, setMapType] = useState<MapLayerType>("standard");
  const [showsTraffic, setShowsTraffic] = useState(false);
  const [showsBuildings, setShowsBuildings] = useState(true);
  const [showsIndoors, setShowsIndoors] = useState(false);
  const [showsCompass, setShowsCompass] = useState(true);

  const cycleMapType = useCallback(() => {
    const cycle: MapLayerType[] =
      Platform.OS === "android"
        ? ["standard", "satellite", "hybrid", "terrain"]
        : ["standard", "satellite", "hybrid"];

    const idx = Math.max(0, cycle.indexOf(mapType));
    setMapType(cycle[(idx + 1) % cycle.length]);
  }, [mapType]);

  return {
    mapType,
    cycleMapType,

    showsTraffic,
    setShowsTraffic,
    showsBuildings,
    setShowsBuildings,
    showsIndoors,
    setShowsIndoors,
    showsCompass,
    setShowsCompass,
  };
}
