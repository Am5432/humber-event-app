import { Link } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import styles from "../../src/styles/authStyles";
import { colors } from "../../src/theme/colors";

export default function SignUpScreen() {
    const { signUp } = useAuth();
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSignUp = async () => {
        const trimmedDisplayName = displayName.trim();
        const trimmedEmail = email.trim();

        if (!trimmedDisplayName || !trimmedEmail || !password || !confirmPassword) {
            setErrorMessage("All fields are required.");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage("Passwords do not match.");
            return;
        }

        try {
            setSubmitting(true);
            setErrorMessage("");
            await signUp(trimmedDisplayName, trimmedEmail, password);
        } catch (error: any) {
            const detail =
                error?.response?.data?.detail ||
                error?.message ||
                "Account creation failed. Please try again.";
            setErrorMessage(String(detail));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.brandRow}>
                <View style={styles.logoMark} />
                <Text style={styles.brandText}>Humber Event Hub</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.title}>Create an Account</Text>
                <Text style={styles.subtitle}>Use your Humber email to join campus events</Text>

                <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder='Your name'
                    placeholderTextColor='#8B8F98'
                    autoCapitalize='words'
                    style={styles.input}
                />

                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder='you@humber.ca'
                    placeholderTextColor='#8B8F98'
                    autoCapitalize='none'
                    keyboardType='email-address'
                    style={styles.input}
                />

                <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder='••••••••'
                    placeholderTextColor='#8B8F98'
                    secureTextEntry
                    style={styles.input}
                />

                <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder='••••••••'
                    placeholderTextColor='#8B8F98'
                    secureTextEntry
                    style={styles.input}
                />

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Pressable
                    onPress={handleSignUp}
                    disabled={submitting}
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        submitting && styles.buttonDisabled,
                    ]}>
                    {submitting ? (
                        <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                        <Text style={styles.buttonText}>Create Account</Text>
                    )}
                </Pressable>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <Link href='/login' asChild>
                        <Pressable>
                            <Text style={styles.linkText}>Sign In</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
