import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Share,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AuthenticatedEventImage } from "../../src/components/AuthenticatedEventImage";
import { useAuth } from "../../src/context/AuthContext";
import {
    formatEventDate,
    formatEventDateTime,
    getEventHeroImage,
    hasEventGallery,
} from "../../src/lib/eventPresentation";
import {
    deregisterFromEvent,
    fetchDiscoveryEvent,
    registerForEvent,
} from "../../src/lib/events";
import { emitRegistrationUpdated } from "../../src/lib/registrationEvents";
import { colors } from "../../src/theme/colors";
import { borderRadius, fontFamilies, fontSizes } from "../../src/theme/typography";
import type { DiscoveryEvent } from "../../src/types/events";


export default function EventDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ eventId: string }>();
    const { user } = useAuth();
    const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;

    const [event, setEvent] = useState<DiscoveryEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeImageId, setActiveImageId] = useState<string | null>(null);

    const loadEvent = useCallback(async () => {
        if (!eventId) {
            setError("Missing event id.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await fetchDiscoveryEvent(eventId);
            setEvent(data);
        } catch (loadError) {
            console.error("[EventDetail] load error", loadError);
            setError("Failed to load this event.");
            setEvent(null);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void loadEvent();
    }, [loadEvent]);

    useEffect(() => {
        setActiveImageId(event?.gallery_images?.[0]?.id ?? null);
    }, [event]);

    const handleRegister = async () => {
        if (!event) {
            return;
        }

        setIsRegistering(true);
        try {
            const updatedEvent = await registerForEvent(event.id);
            setEvent(updatedEvent);
            emitRegistrationUpdated(updatedEvent);
            Alert.alert("Registered", "Your registration was recorded.");
        } catch (registerError) {
            console.error("[EventDetail] register error", registerError);
            Alert.alert(
                "Registration unavailable",
                "This event may already be full or unavailable.",
            );
        } finally {
            setIsRegistering(false);
        }
    };

    const handleDeregister = async () => {
        if (!event) {
            return;
        }

        setIsRegistering(true);
        try {
            const updatedEvent = await deregisterFromEvent(event.id);
            setEvent(updatedEvent);
            emitRegistrationUpdated(updatedEvent);
            Alert.alert("Registration removed", "You are no longer registered for this event.");
        } catch (registerError) {
            console.error("[EventDetail] deregister error", registerError);
            Alert.alert(
                "Unable to remove registration",
                "Your registration could not be removed right now.",
            );
        } finally {
            setIsRegistering(false);
        }
    };

    const confirmDeregister = () => {
        Alert.alert(
            "Cancel registration",
            "Do you want to remove your registration for this event?",
            [
                { text: "Keep", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => void handleDeregister(),
                },
            ],
        );
    };

    const handleShare = async () => {
        if (!event) {
            return;
        }

        try {
            await Share.share({
                message: [
                    event.title,
                    formatEventDateTime(event.date_time),
                    event.location,
                    event.description,
                ].join("\n"),
            });
        } catch (shareError) {
            console.error("[EventDetail] share error", shareError);
            Alert.alert("Share unavailable", "This event could not be shared right now.");
        }
    };

    const isEventFull = Boolean(
        event && event.registrations_count >= event.capacity,
    );
    const isAlreadyRegistered = Boolean(event?.is_registered);
    const organizer = event?.organizer ?? null;
    const canEditEvent = Boolean(
        user &&
            event &&
            (user.role === "organizer" || user.role === "admin") &&
            String(user.id) === event.organizer_id,
    );
    const galleryImages = event?.gallery_images ?? [];
    const activeImage =
        galleryImages.find((image) => image.id === activeImageId) ?? galleryImages[0] ?? null;
    const heroImageUri = activeImage?.display_url ?? (event ? getEventHeroImage(event) : null);
    const showGallery = Boolean(event && hasEventGallery(event));

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
                    <Text style={styles.headerTitle}>Event Details</Text>
                </View>

                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.secondary} />
                    </View>
                ) : error || !event ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons
                            name="calendar-alert-outline"
                            size={42}
                            color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.emptyText}>{error ?? "Event not found."}</Text>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => void loadEvent()}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.secondaryButtonText}>Try again</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.card}>
                        {showGallery && heroImageUri ? (
                            <AuthenticatedEventImage
                                uri={heroImageUri}
                                style={styles.heroImage}
                                testID="event-detail-hero-image"
                                accessibilityLabel={`${event.title} hero image`}
                            />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <MaterialCommunityIcons
                                    name="calendar-star"
                                    size={42}
                                    color={colors.onSurfaceVariant}
                                />
                            </View>
                        )}

                        {galleryImages.length > 1 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.galleryStrip}
                            >
                                {galleryImages.map((image) => {
                                    const isActive = image.id === activeImage?.id;
                                    return (
                                        <TouchableOpacity
                                            key={image.id}
                                            onPress={() => setActiveImageId(image.id)}
                                            activeOpacity={0.85}
                                            style={[
                                                styles.galleryThumbButton,
                                                isActive ? styles.galleryThumbButtonActive : null,
                                            ]}
                                        >
                                            <AuthenticatedEventImage
                                                uri={image.thumbnail_url}
                                                style={styles.galleryThumbImage}
                                                testID={`event-detail-gallery-thumb-${image.id}`}
                                                accessibilityLabel={`${event.title} gallery thumbnail`}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : null}

                        <Text style={styles.title}>{event.title}</Text>
                        <Text style={styles.summary}>
                            {event.description}
                        </Text>

                        <View style={styles.metaGroup}>
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons
                                    name="calendar-outline"
                                    size={18}
                                    color={colors.onSurfaceVariant}
                                />
                                <Text style={styles.metaText}>
                                    {formatEventDateTime(event.date_time)}
                                </Text>
                            </View>
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons
                                    name="map-marker-outline"
                                    size={18}
                                    color={colors.onSurfaceVariant}
                                />
                                <Text style={styles.metaText}>{event.location}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons
                                    name="account-group-outline"
                                    size={18}
                                    color={colors.onSurfaceVariant}
                                />
                                <Text style={styles.metaText}>
                                    {event.registrations_count}/{event.capacity} registered
                                </Text>
                            </View>
                            {organizer ? (
                                <TouchableOpacity
                                    style={styles.organizerRow}
                                    onPress={() => router.push(`/users/${organizer.id}` as Href)}
                                    activeOpacity={0.85}
                                >
                                    <MaterialCommunityIcons
                                        name="account-circle-outline"
                                        size={18}
                                        color={colors.secondary}
                                    />
                                    <Text style={styles.organizerText}>
                                        Organizer: {organizer.display_name}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={18}
                                    color={colors.onSurfaceVariant}
                                />
                                <Text style={styles.metaText}>
                                    Added {formatEventDate(event.created_at)}
                                </Text>
                            </View>
                        </View>

                        {event.categories.length > 0 ? (
                            <View style={styles.tagsRow}>
                                {event.categories.map((category) => (
                                    <View key={category} style={styles.tag}>
                                        <Text style={styles.tagText}>{category}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {canEditEvent ? (
                            <TouchableOpacity
                                style={styles.editEventButton}
                                onPress={() => router.push(`/organizer/${event.id}` as Href)}
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons
                                    name="pencil-outline"
                                    size={18}
                                    color={colors.onPrimary}
                                />
                                <Text style={styles.editEventButtonText}>Edit Event</Text>
                            </TouchableOpacity>
                        ) : null}

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={styles.shareButton}
                                onPress={() => void handleShare()}
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons
                                    name="share-variant-outline"
                                    size={18}
                                    color={colors.secondary}
                                />
                                <Text style={styles.shareButtonText}>Share</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    isEventFull && !isAlreadyRegistered ? styles.primaryButtonDisabled : null,
                                    isAlreadyRegistered ? styles.warningButton : null,
                                ]}
                                onPress={() => {
                                    if (isAlreadyRegistered) {
                                        confirmDeregister();
                                        return;
                                    }
                                    void handleRegister();
                                }}
                                disabled={isRegistering || (isEventFull && !isAlreadyRegistered)}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.primaryButtonText}>
                                    {isRegistering
                                        ? "Working..."
                                        : isAlreadyRegistered
                                            ? "Cancel Registration"
                                            : isEventFull
                                                ? "Event Full"
                                                : "Register for event"}
                                </Text>
                            </TouchableOpacity>
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
        overflow: "hidden",
        paddingBottom: 20,
    },
    heroImage: {
        height: 220,
        width: "100%",
        backgroundColor: colors.surfaceContainerHigh,
        marginBottom: 20,
    },
    imagePlaceholder: {
        height: 180,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceContainerHigh,
        marginBottom: 20,
    },
    galleryStrip: {
        paddingHorizontal: 20,
        gap: 10,
        marginBottom: 4,
    },
    galleryThumbButton: {
        borderRadius: borderRadius.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "transparent",
    },
    galleryThumbButtonActive: {
        borderColor: colors.secondary,
    },
    galleryThumbImage: {
        width: 72,
        height: 72,
        backgroundColor: colors.surfaceContainerHigh,
    },
    title: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h2,
        color: colors.onSurface,
        paddingHorizontal: 20,
    },
    summary: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodyLg,
        color: colors.onSurfaceVariant,
        lineHeight: 24,
        paddingHorizontal: 20,
        marginTop: 12,
    },
    metaGroup: {
        gap: 12,
        paddingHorizontal: 20,
        marginTop: 20,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    metaText: {
        flex: 1,
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodyLg,
        color: colors.onSurface,
    },
    organizerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    organizerText: {
        flex: 1,
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodyLg,
        color: colors.secondary,
    },
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 20,
        paddingHorizontal: 20,
    },
    tag: {
        backgroundColor: colors.primaryFixed,
        borderRadius: borderRadius.full,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    tagText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.labelLg,
        color: colors.primary,
    },
    primaryButton: {
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.full,
        paddingVertical: 14,
        alignItems: "center",
        flex: 1,
    },
    editEventButton: {
        marginTop: 24,
        marginHorizontal: 20,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.full,
        minHeight: 48,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    editEventButtonText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodyLg,
        color: colors.onPrimary,
    },
    primaryButtonDisabled: {
        backgroundColor: colors.surfaceContainerHigh,
    },
    warningButton: {
        backgroundColor: colors.error,
    },
    primaryButtonText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodyLg,
        color: colors.onPrimary,
    },
    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 24,
        marginHorizontal: 20,
    },
    shareButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: borderRadius.full,
        paddingVertical: 14,
        backgroundColor: colors.surfaceContainerLow,
    },
    shareButtonText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodyLg,
        color: colors.secondary,
    },
    secondaryButton: {
        backgroundColor: colors.surfaceContainerLowest,
        borderRadius: borderRadius.full,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    secondaryButtonText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodySm,
        color: colors.onSurface,
    },
});
