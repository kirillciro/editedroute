import { useUser } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";

/**
 * Root index - handles initial routing based on auth state
 * Redirects to sign-in if not authenticated, otherwise to main app
 */
export default function Index() {
  const { isSignedIn, isLoaded } = useUser();

  // Wait for auth state to load
  if (!isLoaded) {
    return null;
  }

  // Redirect based on authentication state
  if (isSignedIn) {
    return <Redirect href={"/(main)" as any} />;
  }

  return <Redirect href={"/(auth)" as any} />;
}
