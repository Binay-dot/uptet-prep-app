import { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { signIn } from "@/auth/authClient";

/**
 * Placeholder sign-in screen — same "prove the wiring, not the visual
 * design" scope as the web app's landing page.
 */
export default function SignInScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsSigningIn(true);
    setError(null);
    try {
      await signIn();
      router.replace("/(authenticated)/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>UPTET Prep</Text>
      <Text style={{ textAlign: "center", color: "#555" }}>
        Real UPTET practice with an honest prediction of your readiness.
      </Text>
      <Pressable
        onPress={handleSignIn}
        disabled={isSigningIn}
        style={{ backgroundColor: "black", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}
      >
        {isSigningIn ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: "white", fontWeight: "500" }}>Sign in to start</Text>
        )}
      </Pressable>
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
    </View>
  );
}
