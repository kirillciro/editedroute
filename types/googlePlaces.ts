// Minimal shapes for react-native-google-places-autocomplete callbacks.

export type GooglePlaceAutocompleteData = {
  description?: string;
  [key: string]: unknown;
};

export type GooglePlaceDetails = {
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
