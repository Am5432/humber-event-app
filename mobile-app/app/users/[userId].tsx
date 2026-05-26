import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { fetchPublicUserProfile } from "../../src/lib/events";
import { colors } from "../../src/theme/colors";
import { borderRadius, fontFamilies, fontSizes } from "../../src/theme/typography";
import type { PublicUserProfile } from "../../src/types/events";

const ROLE_LABELS: Record<string, string> = {
    student: "Student",
    organizer: "Organizer",
    admin: "Admin",
    regular: "Member",
};

export default function PublicUserProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ userId: string }>();
    const userId = Number(Array.isArray(params.userId) ? params.userId[0] : params.userId);

    const [profile, setProfile] = useState<PublicUserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProfile = useCallback(async () => {
        if (!userId) {
            setError("Missing user id.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchPublicUserProfile(userId);
            setProfile(data);
        } catch (loadError) {
            console.error("[PublicProfile] load error", loadError);
            setProfile(null);
            setError("Failed to load this profile.");
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const avatarInitial = profile?.display_name?.charAt(0).toUpperCase() ?? "?";

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>

                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.secondary} />
                    </View>
                ) : error || !profile ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons name="account-alert-outline" size={40} color={colors.onSurfaceVariant} />
                        <Text style={styles.emptyText}>{error ?? "Profile not found."}</Text>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{avatarInitial}</Text>
                        </View>

                        <Text style={styles.displayName}>{profile.display_name}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>{ROLE_LABELS[profile.role] ?? profile.role}</Text>
                        </View>

                        <View style={styles.metricsGrid}>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricValue}>{profile.organized_events_count}</Text>
                                <Text style={styles.metricLabel}>Organized</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricValue}>{profile.approved_events_count}</Text>
                                <Text style={styles.metricLabel}>Approved</Text>
                            </View>
                            <View style={styles.metricCard}>
                                <Text style={styles.metricValue}>{profile.registered_events_count}</Text>
                                <Text style={styles.metricLabel}>Registered</Text>
                            </View>
                        </View>
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
    card: {
        backgroundColor: colors.surfaceContainerLowest,
        borderRadius: borderRadius.xxl,
        padding: 24,
        alignItems: "center",
    },
    avatarCircle: {
        width: 88,
        height: 88,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primaryContainer,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    avatarText: {
        fontFamily: fontFamilies.headline,
        fontSize: 36,
        color: colors.onPrimary,
    },
    displayName: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h3,
        color: colors.onSurface,
        marginBottom: 10,
        textAlign: "center",
    },
    roleBadge: {
        backgroundColor: colors.secondaryContainer,
        borderRadius: borderRadius.full,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginBottom: 24,
    },
    roleText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.labelLg,
        color: colors.secondary,
    },
    metricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "center",
    },
    metricCard: {
        minWidth: 100,
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: borderRadius.lg,
        paddingVertical: 16,
        paddingHorizontal: 14,
        alignItems: "center",
    },
    metricValue: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h3,
        color: colors.onSurface,
    },
    metricLabel: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodySm,
        color: colors.onSurfaceVariant,
        marginTop: 4,
    },
});
