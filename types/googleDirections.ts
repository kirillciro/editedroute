export type GoogleDirectionsDistance = {
  value: number;
  text?: string;
};

export type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

// Minimal shape of a Google Directions API step used by our navigation UI.
// Keep it permissive to avoid fighting upstream API variations.
export type GoogleDirectionsStep = {
  html_instructions?: string;
  maneuver?: string;
  distance?: GoogleDirectionsDistance;
  end_location?: GoogleLatLngLiteral;
  [key: string]: unknown;
};
