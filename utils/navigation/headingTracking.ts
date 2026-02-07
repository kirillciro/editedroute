import type * as ExpoLocation from "expo-location";

type Ref<T> = { current: T };

type RemovableSubscription = { remove: () => void };

export async function startHeadingTracking(params: {
  Location: typeof import("expo-location");
  Gyroscope: typeof import("expo-sensors").Gyroscope;
  Magnetometer: typeof import("expo-sensors").Magnetometer;

  currentHeadingRef: Ref<number>;
  calibrationSamplesRef: Ref<number[]>;
  isCalibratedRef: Ref<boolean>;

  setRawHeading: (v: number) => void;
  setHeading: (v: number) => void;
  setIsSensorsActive: (v: boolean) => void;

  headingSubscriptionRef: Ref<ExpoLocation.LocationSubscription | null>;
  gyroSubscriptionRef: Ref<RemovableSubscription | null>;
  magnetometerSubscriptionRef: Ref<RemovableSubscription | null>;
}) {
  const {
    Location,
    Gyroscope,
    Magnetometer,
    currentHeadingRef,
    calibrationSamplesRef,
    isCalibratedRef,
    setRawHeading,
    setHeading,
    setIsSensorsActive,
    headingSubscriptionRef,
    gyroSubscriptionRef,
    magnetometerSubscriptionRef,
  } = params;

  // Prefer OS-provided heading (tilt-compensated). If unavailable (e.g. simulator), fall back
  // to the gyro+magnetometer fusion.
  try {
    const sub = await Location.watchHeadingAsync((h) => {
      const next =
        h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      if (typeof next !== "number" || Number.isNaN(next)) return;
      currentHeadingRef.current = next;
      setRawHeading(next);
      setHeading(next);
    });

    headingSubscriptionRef.current = sub;
    isCalibratedRef.current = true;
    setIsSensorsActive(true);
    return;
  } catch (e) {
    console.warn(
      "watchHeadingAsync unavailable, falling back to sensors:",
      e,
    );
  }

  Gyroscope.setUpdateInterval(16);
  const gyroSub = Gyroscope.addListener((data) => {
    if (!isCalibratedRef.current) {
      calibrationSamplesRef.current.push(data.z);
      if (calibrationSamplesRef.current.length >= 30) {
        isCalibratedRef.current = true;
      }
      return;
    }

    const rotationRate = data.z * (180 / Math.PI);
    currentHeadingRef.current += rotationRate * 0.016;
    currentHeadingRef.current =
      ((currentHeadingRef.current % 360) + 360) % 360;

    setRawHeading(currentHeadingRef.current);
    setHeading(currentHeadingRef.current);
  });
  gyroSubscriptionRef.current = gyroSub as unknown as RemovableSubscription;

  Magnetometer.setUpdateInterval(100);
  const magSub = Magnetometer.addListener((data) => {
    if (!isCalibratedRef.current) return;

    const magHeading = Math.atan2(data.y, data.x) * (180 / Math.PI);
    const normalizedMagHeading = (magHeading + 360) % 360;

    const drift = normalizedMagHeading - currentHeadingRef.current;
    let correction = drift;
    if (Math.abs(drift) > 180) {
      correction = drift > 0 ? drift - 360 : drift + 360;
    }

    const maxCorrection = 10;
    correction = Math.max(-maxCorrection, Math.min(maxCorrection, correction));

    currentHeadingRef.current += correction * 0.02;
    currentHeadingRef.current =
      ((currentHeadingRef.current % 360) + 360) % 360;
  });
  magnetometerSubscriptionRef.current =
    magSub as unknown as RemovableSubscription;

  setIsSensorsActive(true);
}
