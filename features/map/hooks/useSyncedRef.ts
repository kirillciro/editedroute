import { useEffect, useRef } from "react";

type Ref<T> = { current: T };

type UseSyncedRef = <T>(
  value: T,
  initialValue?: T,
) => Ref<T>;

/**
 * Keeps a stable ref in sync with the latest value.
 * Useful for animation loops / intervals that must read fresh state.
 */
export const useSyncedRef: UseSyncedRef = (value, initialValue) => {
  const ref = useRef(initialValue ?? value) as unknown as Ref<any>;

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
};
