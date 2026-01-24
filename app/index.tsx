import { Redirect } from "expo-router";

/**
 * Root index - opens directly to map screen like Google Maps/Waze
 * No auth gates - map renders immediately
 */
export default function Index() {
  // Go straight to map screen
  return <Redirect href={"/map" as any} />;
}
