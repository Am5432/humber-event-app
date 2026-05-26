import { useState, useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Manrope_400Regular, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { fireAndForgetAuthDebugLog } from "../src/lib/authDebugLog";
import EventSplashScreen from "@/components/EventSplashScreen";
import * as Linking from 'expo-linking';

export const unstable_settings = {
    initialRouteName: "(auth)",
};

// Must be called at module level
// This tells the os to keep the splash screen visible until I tell it to hide.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
    const { token, isLoading } = useAuth();

    useEffect(() => {
        fireAndForgetAuthDebugLog("root", "auth_state.changed", {
            has_token: Boolean(token),
            is_loading: isLoading,
        });
    }, [token, isLoading]);

    if (isLoading) return null; // SplashScreen still visible

    return (
        <Stack screenOptions={{ headerShown: false }}>
            {/* Authenticated users get tabs; unauthenticated users get auth screens */}
            <Stack.Protected guard={!!token}>
                <Stack.Screen name='(tabs)' />
                <Stack.Screen name='events/[eventId]' />
                <Stack.Screen name='events/category/[categoryName]' />
                <Stack.Screen name='organizer/index' />
                <Stack.Screen name='organizer/new' />
                <Stack.Screen name='organizer/[eventId]' />
                <Stack.Screen name='registrations/index' />
                <Stack.Screen name='users/[userId]' />
            </Stack.Protected>
            <Stack.Protected guard={!token}>
                <Stack.Screen name='(auth)' />
            </Stack.Protected>
        </Stack>
    );
}

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        Manrope_400Regular,
        Manrope_700Bold,
    });

    // 1. Create a state lock for your custom delay
    const [isSplashDelayFinished, setIsSplashDelayFinished] = useState(false);

    useEffect(() => {
        async function prepareAndHideSplash() {
            // Check if the app was opened via a deep link (like the SSO callback)
            const initialUrl = await Linking.getInitialURL();
            fireAndForgetAuthDebugLog("root", "initial_url.resolved", {
                initial_url: initialUrl,
            });
            
            if (fontsLoaded || fontError) {
                // If there's an initial URL, it's likely a redirect; skip the 3s wait
                if (!initialUrl) {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                
                setIsSplashDelayFinished(true);
                await SplashScreen.hideAsync();
            }
        }

        prepareAndHideSplash();
    }, [fontsLoaded, fontError]);

    // 4. Return null if fonts are loading or if there's an error, to keep the native splash visible
    if (!fontsLoaded && !fontError) return null;
    if (!isSplashDelayFinished) {
        return <EventSplashScreen />; // Show your custom splash screen during the delay
    }

    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
