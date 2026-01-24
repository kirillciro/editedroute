import { useUser } from "@clerk/clerk-expo";
import { Stack, Redirect, Link } from "expo-router";
import { Image } from "react-native";
import { StopsProvider } from "../../context/StopsContext";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

function StackNavigator() {
  const { user } = useUser();
  const { colors } = useTheme();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerTitle: "Dashboard",
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.text,
          headerLeft: () => (
            <Link
              href="/(main)/profile"
              style={{ marginLeft: 2, marginTop: 1 }}
            >
              <Image
                source={{ uri: user?.imageUrl }}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="stops"
        options={{
          headerShown: true,
          headerTitle: "Manage Stops",
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="stats"
        options={{
          headerShown: true,
          headerTitle: "Trip Statistics",
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.text,
          headerLeft: () => (
            <Link href="/map" style={{ marginLeft: 3 }}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          presentation: "modal",
          headerTitle: "Profile",
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.text,
          headerLeft: () => (
            <Link dismissTo href="/(main)" style={{ marginLeft: 3 }}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Link>
          ),
        }}
      />
    </Stack>
  );
}

export default function MainLayout() {
  const { isSignedIn } = useUser();

  if (!isSignedIn) return <Redirect href={"/(auth)" as any} />;

  return (
    <StopsProvider>
      <StackNavigator />
    </StopsProvider>
  );
}
