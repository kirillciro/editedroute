import React, { useCallback } from "react";

import type { GoogleDirectionsStep } from "@/types/googleDirections";
import type { LaneHint } from "@/utils/navigation/instructions";
import { computeTurnByTurnUiFromSteps } from "@/utils/navigation/turnByTurnUi";

type StepsRef = { current: GoogleDirectionsStep[] };

type Params = {
  stepsRef: StepsRef;

  setCurrentInstruction: React.Dispatch<React.SetStateAction<string>>;
  setCurrentManeuver: React.Dispatch<React.SetStateAction<string | null>>;
  setNextInstruction: React.Dispatch<React.SetStateAction<string>>;
  setNextManeuver: React.Dispatch<React.SetStateAction<string | null>>;
  setLaneHint: React.Dispatch<React.SetStateAction<LaneHint>>;
  setDistanceToNextTurn: React.Dispatch<React.SetStateAction<number>>;
};

export function useTurnByTurnUi({
  stepsRef,
  setCurrentInstruction,
  setCurrentManeuver,
  setNextInstruction,
  setNextManeuver,
  setLaneHint,
  setDistanceToNextTurn,
}: Params) {
  const applyTurnByTurnUiFromIndex = useCallback(
    (idx: number) => {
      const ui = computeTurnByTurnUiFromSteps({
        steps: stepsRef.current,
        index: idx,
      });
      if (!ui) return;

      setCurrentInstruction(ui.currentInstruction);
      setCurrentManeuver(ui.currentManeuver);
      setLaneHint(ui.laneHint);
      if (ui.distanceToNextTurnMeters != null) {
        setDistanceToNextTurn(ui.distanceToNextTurnMeters);
      }
      setNextInstruction(ui.nextInstruction);
      setNextManeuver(ui.nextManeuver);
    },
    [
      stepsRef,
      setCurrentInstruction,
      setCurrentManeuver,
      setLaneHint,
      setDistanceToNextTurn,
      setNextInstruction,
      setNextManeuver,
    ],
  );

  return { applyTurnByTurnUiFromIndex };
}
