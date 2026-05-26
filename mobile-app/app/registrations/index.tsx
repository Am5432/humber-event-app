import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { type Href, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { RegistrationCard } from "../../src/components/RegistrationCard";
import { formatEventDateTime } from "../../src/lib/eventPresentation";
import { fetchMyRegistrations } from "../../src/lib/events";
import { colors } from "../../src/theme/colors";
import { borderRadius, fontFamilies, fontSizes } from "../../src/theme/typography";
import type { RegisteredEvent } from "../../src/types/events";

export default function RegistrationsScreen() {
    const router = useRouter();
    const [registrations, setRegistrations] = useState<RegisteredEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRegistrations = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchMyRegistrations();
            setRegistrations(data);
        } catch (loadError) {
            console.error("[Registrations] load error", loadError);
            setRegistrations([]);
            setError("Failed to load your registrations.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRegistrations();
    }, [loadRegistrations]);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Registrations</Text>
                </View>

                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.secondary} />
                    </View>
                ) : error ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons name="wifi-off" size={40} color={colors.onSurfaceVariant} />
                        <Text style={styles.emptyText}>{error}</Text>
                    </View>
                ) : registrations.length === 0 ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons
                            name="ticket-confirmation-outline"
                            size={40}
                            color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.emptyText}>No registrations yet.</Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {registrations.map((registration) => (
                            <RegistrationCard
                                key={registration.id}
                                title={registration.title}
                                date={formatEventDateTime(registration.registered_at)}
                                location={registration.location}
                                onPress={() => router.push(`/events/${registration.id}` as Href)}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceContainerLowest,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h3,
        color: colors.onSurface,
    },
    centered: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodyLg,
        color: colors.onSurfaceVariant,
        textAlign: "center",
    },
    list: {
        gap: 12,
    },
});
