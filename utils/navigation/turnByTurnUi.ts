import {
  cleanHtmlInstruction,
  getStepManeuver,
  inferLaneHint,
  type LaneHint,
} from "@/utils/navigation/instructions";
import type { GoogleDirectionsStep } from "@/types/googleDirections";

export type TurnByTurnUi = {
  currentInstruction: string;
  currentManeuver: string | null;
  laneHint: LaneHint;
  distanceToNextTurnMeters: number | null;
  nextInstruction: string;
  nextManeuver: string | null;
};

export function computeTurnByTurnUiFromSteps(params: {
  steps: GoogleDirectionsStep[];
  index: number;
}): TurnByTurnUi | null {
  const step = params.steps[params.index];
  if (!step) return null;

  const instructionText =
    typeof step.html_instructions === "string"
      ? cleanHtmlInstruction(step.html_instructions)
      : "";

  const currentManeuver = getStepManeuver(step);
  const laneHint = inferLaneHint(currentManeuver, instructionText);

  const distanceToNextTurnMeters =
    step?.distance?.value != null ? Number(step.distance.value) : null;

  const next = params.steps[params.index + 1];
  const nextInstruction =
    typeof next?.html_instructions === "string"
      ? cleanHtmlInstruction(next.html_instructions)
      : "";
  const nextManeuver = next ? getStepManeuver(next) : null;

  return {
    currentInstruction: instructionText,
    currentManeuver,
    laneHint,
    distanceToNextTurnMeters,
    nextInstruction,
    nextManeuver,
  };
}
