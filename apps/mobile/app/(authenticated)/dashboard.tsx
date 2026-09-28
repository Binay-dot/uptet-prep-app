import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { getValidAccessToken } from "@/auth/authClient";
import { getMe } from "@/api/users";
import type { UserDto } from "@uptet/contracts";

/**
 * Placeholder dashboard, gated client-side by checking for a valid
 * access token. This is a UX convenience only — same caveat as the web
 * app's (authenticated) layout: the real authorization boundary is the
 * backend's resolveActor(), not this check.
 */
export default function DashboardScreen() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getValidAccessToken();
      if (!token) {
        router.replace("/(public)");
        return;
      }
      try {
        setUser(await getMe());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Dashboard</Text>
      {user ? <Text>Welcome, {user.displayName ?? "there"}.</Text> : null}
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <Text style={{ marginTop: 12, color: "#555" }}>
        Quiz start / results UI goes here next.
      </Text>
    </View>
  );
}
