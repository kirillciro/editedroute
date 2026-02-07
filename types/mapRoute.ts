import { LatLng } from "@/types/navigation";

export type UserLocation = LatLng & { speed?: number };

export type MapDestination = LatLng & {
  address: string;
};

export type MapStop = LatLng & {
  id: string;
  address: string;
};
