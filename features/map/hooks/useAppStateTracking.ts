import { useEffect } from "react";
import { AppState } from "react-native";

type AppStateValue = typeof AppState.currentState;

type Params = {
  appState: AppStateValue;
  setAppState: React.Dispatch<React.SetStateAction<AppStateValue>>;
};

export function useAppStateTracking({ appState, setAppState }: Params) {
  // STAGE 9.1: Battery optimization - suspend updates when app is backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.match(/active/) && nextAppState === "background") {
        if (__DEV__)
          console.log("App backgrounded - suspending sensors and animations");
        // Sensors will continue but animations will pause
      } else if (appState === "background" && nextAppState === "active") {
        if (__DEV__) console.log("App foregrounded - resuming");
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, setAppState]);
}
