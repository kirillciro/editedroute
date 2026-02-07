type Removable = { remove: () => void };

type Ref<T> = { current: T | null };

export function cleanupNavigationResources(params: {
  locationSubscription: Ref<Removable>;
  navGpsTierIntervalRef: Ref<any>;
  navGpsResubInFlightRef: { current: boolean };

  headingSubscription: Ref<Removable>;
  gyroSubscription: Ref<Removable>;
  magnetometerSubscription: Ref<Removable>;

  durationInterval: Ref<any>;
}): void {
  const {
    locationSubscription,
    navGpsTierIntervalRef,
    navGpsResubInFlightRef,
    headingSubscription,
    gyroSubscription,
    magnetometerSubscription,
    durationInterval,
  } = params;

  if (locationSubscription.current) {
    locationSubscription.current.remove();
    locationSubscription.current = null;
  }

  if (navGpsTierIntervalRef.current) {
    clearInterval(navGpsTierIntervalRef.current);
    navGpsTierIntervalRef.current = null;
  }

  navGpsResubInFlightRef.current = false;

  if (headingSubscription.current) {
    headingSubscription.current.remove();
    headingSubscription.current = null;
  }

  if (gyroSubscription.current) {
    gyroSubscription.current.remove();
    gyroSubscription.current = null;
  }

  if (magnetometerSubscription.current) {
    magnetometerSubscription.current.remove();
    magnetometerSubscription.current = null;
  }

  if (durationInterval.current) {
    clearInterval(durationInterval.current);
    durationInterval.current = null;
  }
}
