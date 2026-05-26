import { Link, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import styles from "../../src/styles/authStyles";

import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../../src/context/AuthContext";
import { fireAndForgetAuthDebugLog } from "../../src/lib/authDebugLog";
import { colors } from "../../src/theme/colors";

WebBrowser.maybeCompleteAuthSession();

const TENANT_ID = process.env.EXPO_PUBLIC_AZURE_TENANT_ID ?? "";
const CLIENT_ID = process.env.EXPO_PUBLIC_AZURE_CLIENT_ID ?? "";
const PENDING_VERIFIER_KEY = "heh.oauth.code_verifier";
const PENDING_REDIRECT_KEY = "heh.oauth.redirect_uri";

const discovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`,
};

function makeLoginRedirectUri(): string {
    try {
        return AuthSession.makeRedirectUri({
            scheme: "humber-event-hub",
            path: "auth/callback",
        });
    } catch (error) {
        fireAndForgetAuthDebugLog("login", "redirect_uri.fallback", { error });
        return "humber-event-hub://auth/callback";
    }
}

export default function LoginScreen() {
    const router = useRouter();
    const { signInWithPassword, user, isLoading } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isSsoLoading, setIsSsoLoading] = useState(false);

    const redirectUri = makeLoginRedirectUri();

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: CLIENT_ID,
            redirectUri,
            scopes: ["openid", "profile", "email", "User.Read"],
            responseType: AuthSession.ResponseType.Code,
        },
        discovery,
    );

    useEffect(() => {
        fireAndForgetAuthDebugLog("login", "screen.ready", {
            redirect_uri: redirectUri,
            request_ready: Boolean(request),
        });
    }, [redirectUri, request]);

    useEffect(() => {
        if (!response) return;
        fireAndForgetAuthDebugLog("login", "auth_session.response", {
            type: response.type,
            has_error: "error" in response,
            has_params: "params" in response && Boolean(response.params),
        });
        if (response.type === "error") {
            setErrorMessage("Microsoft sign in failed. Please try again.");
        } else if (response.type === "cancel" || response.type === "dismiss") {
            setErrorMessage("");
        }
        setIsSsoLoading(false);
    }, [response]);

    const handleMicrosoftSignIn = async () => {
        setErrorMessage("");
        if (!request?.codeVerifier) {
            fireAndForgetAuthDebugLog("login", "microsoft_launch.blocked", {
                reason: "missing_code_verifier",
            });
            setErrorMessage("Microsoft sign in is not ready yet. Please try again.");
            return;
        }
        try {
            setIsSsoLoading(true);
            await SecureStore.setItemAsync(PENDING_VERIFIER_KEY, request.codeVerifier);
            await SecureStore.setItemAsync(PENDING_REDIRECT_KEY, redirectUri);
            fireAndForgetAuthDebugLog("login", "microsoft_launch.start", {
                redirect_uri: redirectUri,
                verifier_length: request.codeVerifier.length,
            });
            await promptAsync();
        } catch {
            fireAndForgetAuthDebugLog("login", "microsoft_launch.failed");
            setErrorMessage("Microsoft sign in failed. Please try again.");
            setIsSsoLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoading && user) {
            router.replace("/(tabs)");
        }
    }, [isLoading, user, router]);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setErrorMessage("Please enter both email and password.");
            return;
        }

        try {
            setSubmitting(true);
            setErrorMessage("");
            fireAndForgetAuthDebugLog("login", "password_submit.start", {
                email: email.trim(),
            });
            await signInWithPassword(email.trim(), password);
            router.replace("/(tabs)");
        } catch (error: any) {
            fireAndForgetAuthDebugLog("login", "password_submit.failed", {
                email: email.trim(),
                error,
            });
            const detail = error?.response?.data?.detail || error?.message || "Login failed. Please try again.";
            setErrorMessage(String(detail));
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size='large' color={colors.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.brandRow}>
                <View style={styles.logoMark} />
                <Text style={styles.brandText}>Humber Event Hub</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.title}>Sign in to Humber Event Hub</Text>
                <Text style={styles.subtitle}>Use your Humber email and password</Text>

                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder='humber email'
                    placeholderTextColor='#8B8F98'
                    autoCapitalize='none'
                    keyboardType='email-address'
                    style={styles.input}
                />

                <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder='password'
                    placeholderTextColor='#8B8F98'
                    secureTextEntry
                    style={styles.input}
                />

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Pressable
                    onPress={handleLogin}
                    disabled={submitting}
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        submitting && styles.buttonDisabled,
                    ]}>
                    <Text style={styles.buttonText}>{submitting ? "Signing In..." : "Login"}</Text>
                </Pressable>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.line} />
                </View>

                <Pressable
                    style={[styles.ssoButton, (!request || isSsoLoading) && styles.buttonDisabled]}
                    onPress={handleMicrosoftSignIn}
                    disabled={!request || isSsoLoading}>
                    {isSsoLoading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text style={styles.ssoButtonText}>Sign in with Microsoft</Text>
                    )}
                </Pressable>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <Link href='/signup' asChild>
                        <Pressable>
                            <Text style={styles.linkText}>Sign Up</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

