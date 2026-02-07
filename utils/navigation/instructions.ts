import type { GoogleDirectionsStep } from "@/types/googleDirections";

export type LaneHint =
  | null
  | "keep-left"
  | "keep-right"
  | "left"
  | "right"
  | "straight";

export const cleanHtmlInstruction = (html: string): string => {
  if (!html) return "";

  // Google Directions returns HTML; we want clean plain text.
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

export const inferManeuverFromInstruction = (
  instructionText: string,
): string | null => {
  const t = (instructionText || "").toLowerCase();
  if (t.includes("u-turn") || t.includes("uturn")) return "uturn";
  if (t.includes("roundabout")) return "roundabout";
  if (t.includes("merge")) return "merge";
  if (t.includes("exit")) return "exit";
  if (t.includes("keep left")) return "keep-left";
  if (t.includes("keep right")) return "keep-right";
  if (t.includes("slight left")) return "turn-slight-left";
  if (t.includes("slight right")) return "turn-slight-right";
  if (t.includes("sharp left")) return "turn-sharp-left";
  if (t.includes("sharp right")) return "turn-sharp-right";
  if (t.includes("turn left")) return "turn-left";
  if (t.includes("turn right")) return "turn-right";
  return null;
};

export const inferLaneHint = (
  maneuver: string | null,
  instructionText: string,
): LaneHint => {
  const t = (instructionText || "").toLowerCase();
  const m = (maneuver || "").toLowerCase();

  if (t.includes("keep left") || m.includes("keep-left")) return "keep-left";
  if (t.includes("keep right") || m.includes("keep-right")) return "keep-right";

  if (m.includes("turn-left") || t.includes("turn left")) return "left";
  if (m.includes("turn-right") || t.includes("turn right")) return "right";

  if (m.includes("ramp-left") || (m.includes("exit") && t.includes("left")))
    return "keep-left";
  if (
    m.includes("ramp-right") ||
    (m.includes("exit") && t.includes("right"))
  )
    return "keep-right";

  if (t.includes("continue") || t.includes("head") || t.includes("straight"))
    return "straight";

  return null;
};

export const getStepManeuver = (step: GoogleDirectionsStep): string | null => {
  const raw = typeof step?.maneuver === "string" ? step.maneuver : null;
  if (raw) return raw;

  const instructionText =
    typeof step?.html_instructions === "string"
      ? cleanHtmlInstruction(step.html_instructions)
      : "";

  return inferManeuverFromInstruction(instructionText);
};

export const maneuverToIconName = (
  maneuver: string | null,
  instructionText: string,
): string => {
  const m = maneuver || inferManeuverFromInstruction(instructionText) || "";
  switch (m) {
    case "turn-left":
      return "arrow-left";
    case "turn-right":
      return "arrow-right";
    case "turn-slight-left":
    case "fork-left":
      return "arrow-top-left";
    case "turn-slight-right":
    case "fork-right":
      return "arrow-top-right";
    case "turn-sharp-left":
      return "arrow-bottom-left";
    case "turn-sharp-right":
      return "arrow-bottom-right";
    case "uturn":
    case "uturn-left":
    case "uturn-right":
      return "undo";
    case "merge":
      return "merge";
    case "roundabout":
    case "roundabout-left":
    case "roundabout-right":
      return "rotate-right";
    case "exit":
    case "ramp-left":
    case "ramp-right":
      return "exit-to-app";
    case "keep-left":
      return "arrow-left";
    case "keep-right":
      return "arrow-right";
    default:
      return "arrow-up";
  }
};
