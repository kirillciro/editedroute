import { useEffect, useRef } from "react";

type Ref<T> = { current: T };

/**
 * Keeps a stable ref in sync with the latest value.
 * Useful for animation loops / intervals that must read fresh state.
 */
export function useSyncedRef<T>(value: T, initialValue?: T): Ref<T> {
  const ref = useRef<T>(initialValue ?? value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
