import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { EventCard } from "../../../src/components/EventCard";
import { fetchDiscoveryEvents } from "../../../src/lib/events";
import { colors } from "../../../src/theme/colors";
import { borderRadius, fontFamilies, fontSizes } from "../../../src/theme/typography";
import type { DiscoveryEvent } from "../../../src/types/events";

function getOrganizerPressHandler(
    event: DiscoveryEvent,
    openProfile: (userId: number) => void,
): (() => void) | undefined {
    const organizer = event.organizer;
    return organizer ? () => openProfile(organizer.id) : undefined;
}


export default function CategoryEventsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ categoryName: string }>();
    const categoryName = Array.isArray(params.categoryName)
        ? params.categoryName[0]
        : params.categoryName ?? "";

    const [events, setEvents] = useState<DiscoveryEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCategoryEvents = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await fetchDiscoveryEvents({ category: categoryName });
            setEvents(data);
        } catch (loadError) {
            console.error("[CategoryEvents] load error", loadError);
            setEvents([]);
            setError("Failed to load category events.");
        } finally {
            setIsLoading(false);
        }
    }, [categoryName]);

    useEffect(() => {
        void loadCategoryEvents();
    }, [loadCategoryEvents]);

    const openEvent = (eventId: string) => {
        router.push(`/events/${eventId}` as Href);
    };

    const openProfile = (userId: number) => {
        router.push(`/users/${userId}` as Href);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={22}
                            color={colors.onSurface}
                        />
                    </TouchableOpacity>
                    <View style={styles.headerCopy}>
                        <Text style={styles.headerEyebrow}>Category</Text>
                        <Text style={styles.headerTitle}>{categoryName}</Text>
                    </View>
                </View>

                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.secondary} />
                    </View>
                ) : error ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons
                            name="wifi-off"
                            size={40}
                            color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.emptyText}>{error}</Text>
                    </View>
                ) : events.length === 0 ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons
                            name="calendar-remove-outline"
                            size={40}
                            color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.emptyText}>
                            No approved events are currently tagged with this category.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {events.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onPress={() => openEvent(event.id)}
                                onOrganizerPress={getOrganizerPressHandler(event, openProfile)}
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
    headerCopy: {
        flex: 1,
    },
    headerEyebrow: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.labelLg,
        color: colors.secondary,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    headerTitle: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h2,
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
        gap: 0,
    },
});
