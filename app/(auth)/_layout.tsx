import { useUser } from "@clerk/clerk-expo";
import { Stack, Redirect } from "expo-router";

/**
 * Auth group layout
 * Redirects to main screen if user is already signed in
 */
export default function AuthLayout() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Redirect href={"/(main)" as any} />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
