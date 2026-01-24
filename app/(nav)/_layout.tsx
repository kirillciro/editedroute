import { Stack } from "expo-router";

export default function NavLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
