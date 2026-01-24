import {
  SmallParcel,
  MediumParcel,
  BigParcel,
  LongParcel,
  XXLParcel,
} from "@/utils/colors";

/**
 *
 * Parcel size options for delivery stops
 */
export type ParcelSize = "SMALL" | "MEDIUM" | "BIG" | "LONG" | "XXL";

/**
 * Delivery status for stops
 */
export type DeliveryStatus = "pending" | "delivered" | "not-handled";

/**
 * Latitude/Longitude coordinate
 */
export type LatLng = {
  latitude: number;
  longitude: number;
};

/**
 * Delivery stop data model
 */
export type Stop = {
  id: string; // unique identifier
  address: string; // full manual address input
  recipientName?: string; // optional recipient name
  parcelSize?: ParcelSize; // optional parcel size
  lat?: number; // optional latitude (for future geocoding)
  lng?: number; // optional longitude (for future geocoding)
  deliveredAt?: Date; // optional delivery timestamp
  deliveryStatus?: DeliveryStatus; // delivery status (pending, delivered, not-handled)
};

/**
 * Driver statistics
 */
export type DriverStats = {
  kmDriven: number;
  stopsDone: number;
  stopsDelivered: number;
  stopsNotHandled: number;
  timeSpent: number; // in minutes
  averageTimePerStop: number; // in minutes
};

/**
 * Parcel size descriptions
 */
export const PARCEL_SIZE_INFO: Record<
  ParcelSize,
  { label: string; weight: string; icon: string; color: string }
> = {
  SMALL: {
    label: "Small",
    weight: "1-5 kg",
    icon: "package-variant",
    color: SmallParcel,
  },
  MEDIUM: {
    label: "Medium",
    weight: "5-15 kg",
    icon: "package-variant",
    color: MediumParcel,
  },
  BIG: {
    label: "Big",
    weight: "15-30 kg",
    icon: "package-variant-closed",
    color: BigParcel,
  },
  LONG: {
    label: "Long",
    weight: "Tube/Carpet",
    icon: "ruler",
    color: LongParcel,
  },
  XXL: {
    label: "XXL",
    weight: "Oversized",
    icon: "cube-outline",
    color: XXLParcel,
  },
};
