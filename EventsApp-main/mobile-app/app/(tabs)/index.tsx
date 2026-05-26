import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { type Href, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { CategoryTile } from "../../src/components/CategoryTile";
import { EventCard } from "../../src/components/EventCard";
import { RegistrationCard } from "../../src/components/RegistrationCard";
import { useAuth } from "../../src/context/AuthContext";
import { getCategoryPresentation } from "../../src/lib/eventPresentation";
import {
    fetchAdminAnalytics,
    fetchCategories,
    fetchDiscoveryEvents,
    fetchMyRegistrations,
} from "../../src/lib/events";
import { AppLogger } from "../../src/lib/appLogger";
import { subscribeToRegistrationUpdates } from "../../src/lib/registrationEvents";
import styles from "../../src/styles/homeStyles";
import { colors } from "../../src/theme/colors";
import type {
    AdminAnalyticsSummary,
    DiscoveryEvent,
    EventCategory,
    RegisteredEvent,
} from "../../src/types/events";

const CAMPUS_PULSE_DISMISS_KEY = "heh.home.campus_pulse_dismissed_until";
const CAMPUS_PULSE_HIDE_MINUTES = 30;

function getOrganizerPressHandler(
    event: DiscoveryEvent,
    openProfile: (userId: number) => void,
): (() => void) | undefined {
    const organizer = event.organizer;
    return organizer ? () => openProfile(organizer.id) : undefined;
}

export default function DiscoveryFeedScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [events, setEvents] = useState<DiscoveryEvent[]>([]);
    const [categories, setCategories] = useState<EventCategory[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [stats, setStats] = useState<AdminAnalyticsSummary | null>(null);
    const [showCampusPulse, setShowCampusPulse] = useState(true);

    useEffect(() => {
        AppLogger.debug("discovery_feed", "user_view", { user: user ?? "unknown" });
    }, [user]);

    useEffect(() => {
        const restoreCampusPulse = async () => {
            const hiddenUntilValue = await AsyncStorage.getItem(CAMPUS_PULSE_DISMISS_KEY);
            if (!hiddenUntilValue) {
                setShowCampusPulse(true);
                return;
            }

            const hiddenUntil = Number(hiddenUntilValue);
            setShowCampusPulse(Number.isNaN(hiddenUntil) || Date.now() >= hiddenUntil);
        };

        void restoreCampusPulse();
    }, []);

    const loadHomeData = useCallback(async (silent = false) => {
        if (!silent) {
            setIsLoading(true);
        }
        setFetchError(null);

        const analyticsRequest = user?.role === "admin"
            ? fetchAdminAnalytics()
            : Promise.resolve(null);

        const [
            eventsResult,
            categoriesResult,
            analyticsResult,
            registrationsResult,
        ] = await Promise.allSettled([
            fetchDiscoveryEvents(),
            fetchCategories(),
            analyticsRequest,
            fetchMyRegistrations(10),
        ]);

        let hasFailure = false;

        if (eventsResult.status === "fulfilled") {
            setEvents(eventsResult.value);
        } else {
            console.error("[DiscoveryFeed] fetchEvents error", eventsResult.reason);
            setEvents([]);
            hasFailure = true;
        }

        if (categoriesResult.status === "fulfilled") {
            setCategories(categoriesResult.value);
        } else {
            console.error("[DiscoveryFeed] fetchCategories error", categoriesResult.reason);
            setCategories([]);
            hasFailure = true;
        }

        if (analyticsResult.status === "fulfilled") {
            setStats(analyticsResult.value);
        } else {
            console.error("[DiscoveryFeed] fetchAnalytics error", analyticsResult.reason);
            setStats(null);
            hasFailure = true;
        }

        if (registrationsResult.status === "fulfilled") {
            setRegistrations(registrationsResult.value);
        } else {
            console.error("[DiscoveryFeed] fetchRegistrations error", registrationsResult.reason);
            setRegistrations([]);
            hasFailure = true;
        }

        if (hasFailure) {
            setFetchError("Failed to load discovery data. Pull down to retry.");
        }

        setIsLoading(false);
        setIsRefreshing(false);
    }, [user?.role]);

    useEffect(() => {
        void loadHomeData();
    }, [loadHomeData]);

    useEffect(() => {
        const unsubscribe = subscribeToRegistrationUpdates((updatedEvent) => {
            const registeredAt = new Date().toISOString();

            setEvents((currentEvents) =>
                currentEvents.map((currentEvent) =>
                    currentEvent.id === updatedEvent.id ? updatedEvent : currentEvent,
                ),
            );

            setRegistrations((currentRegistrations) => {
                if (!updatedEvent.is_registered) {
                    return currentRegistrations.filter(
                        (registration) => registration.id !== updatedEvent.id,
                    );
                }

                const existingRegistration = currentRegistrations.find(
                    (registration) => registration.id === updatedEvent.id,
                );

                if (existingRegistration) {
                    return currentRegistrations.map((registration) =>
                        registration.id === updatedEvent.id
                            ? { ...registration, ...updatedEvent }
                            : registration,
                    );
                }

                return [
                    {
                        ...updatedEvent,
                        registered_at: registeredAt,
                    },
                    ...currentRegistrations,
                ].slice(0, 10);
            });
        });

        return unsubscribe;
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        void loadHomeData(true);
    };

    const avatarInitial = user?.displayName?.charAt(0).toUpperCase() ?? "S";
    const featuredEvents = events.slice(0, 3);
    const featuredCategories = categories.slice(0, 4);
    const hasRegistrations = registrations.length > 0;
    const isStatsTopSection = !showCampusPulse && Boolean(stats);
    const isRegistrationsTopSection = !showCampusPulse && !stats && hasRegistrations;
    const isCategoriesTopSection = !showCampusPulse && !stats && !hasRegistrations;

    const openEvent = (eventId: string) => {
        router.push(`/events/${eventId}` as Href);
    };

    const openCategory = (categoryName: string) => {
        router.push(`/events/category/${encodeURIComponent(categoryName)}` as Href);
    };

    const openProfile = (userId: number) => {
        router.push(`/users/${userId}` as Href);
    };

    const dismissCampusPulse = async () => {
        const hiddenUntil = Date.now() + CAMPUS_PULSE_HIDE_MINUTES * 60 * 1000;
        await AsyncStorage.setItem(CAMPUS_PULSE_DISMISS_KEY, String(hiddenUntil));
        setShowCampusPulse(false);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <StatusBar barStyle='dark-content' backgroundColor={colors.surface} />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.avatarButton}
                    onPress={() => router.push("/profile" as Href)}
                    activeOpacity={0.85}
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{avatarInitial}</Text>
                    </View>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Discovery Feed</Text>
                <TouchableOpacity
                    onPress={() => router.push("/events?focusSearch=1" as Href)}
                    style={styles.searchButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID='search-button'
                >
                    <MaterialCommunityIcons name='magnify' size={24} color={colors.onSurface} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    !showCampusPulse ? styles.scrollContentCompact : null,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.secondary}
                        colors={[colors.secondary]}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {showCampusPulse ? (
                    <View style={styles.heroCard}>
                        <View style={styles.heroHeader}>
                            <View style={styles.heroTitleBlock}>
                                <Text style={styles.heroEyebrow}>Campus Pulse</Text>
                                <Text style={styles.heroTitle}>
                                    Discover approved Humber events with live backend data.
                                </Text>
                                <Text style={styles.heroCopy}>
                                    Browse by category, open full event views, and move into registration without relying on placeholder content.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.heroDismissButton}
                                onPress={() => void dismissCampusPulse()}
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name='close' size={18} color={colors.onSurface} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.heroAction}
                            onPress={() => router.push("/events")}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.heroActionText}>Browse all events</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {stats ? (
                    <View style={styles.statsContainer}>
                        <View
                            style={[
                                styles.sectionHeaderRow,
                                isStatsTopSection ? styles.topSectionHeaderRow : null,
                            ]}
                        >
                            <Text style={styles.sectionTitle}>Admin Overview</Text>
                        </View>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Ionicons name='stats-chart-outline' size={22} color={colors.primary} />
                                <Text style={styles.statValue}>{stats.total_events}</Text>
                                <Text style={styles.statLabel}>Total Events</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Ionicons name='checkmark-circle-outline' size={22} color={colors.primary} />
                                <Text style={styles.statValue}>{stats.approved_events}</Text>
                                <Text style={styles.statLabel}>Approved</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Ionicons name='time-outline' size={22} color={colors.primary} />
                                <Text style={styles.statValue}>{stats.pending_events}</Text>
                                <Text style={styles.statLabel}>Pending</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Ionicons name='people-outline' size={22} color={colors.primary} />
                                <Text style={styles.statValue}>{stats.total_registrations}</Text>
                                <Text style={styles.statLabel}>Registrations</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {hasRegistrations ? (
                    <>
                        <View
                            style={[
                                styles.sectionHeaderRow,
                                isRegistrationsTopSection ? styles.topSectionHeaderRow : null,
                            ]}
                        >
                            <Text style={styles.sectionTitle}>Your Registrations</Text>
                            <TouchableOpacity onPress={() => router.push("/registrations" as Href)} activeOpacity={0.85}>
                                <Text style={styles.sectionAction}>See all</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.carouselContent}
                            style={styles.carousel}
                        >
                            {registrations.map((registration) => (
                                <RegistrationCard
                                    key={registration.id}
                                    title={registration.title}
                                    date={registration.registered_at}
                                    location={registration.location}
                                    onPress={() => openEvent(registration.id)}
                                />
                            ))}
                        </ScrollView>
                    </>
                ) : null}

                <View
                    style={[
                        styles.sectionHeaderRow,
                        isCategoriesTopSection ? styles.topSectionHeaderRow : null,
                    ]}
                >
                    <Text style={styles.sectionTitle}>Browse Categories</Text>
                    <TouchableOpacity onPress={() => router.push("/events")} activeOpacity={0.85}>
                        <Text style={styles.sectionAction}>All Events</Text>
                    </TouchableOpacity>
                </View>

                {featuredCategories.length === 0 && !isLoading ? (
                    <View style={styles.categoryEmpty}>
                        <Text style={styles.categoryEmptyText}>
                            No categories are available yet.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.masonryRow}>
                        <View style={styles.masonryCol}>
                            {featuredCategories[0] ? (
                                <CategoryTile
                                    icon={getCategoryPresentation(featuredCategories[0].name, 0).icon}
                                    label={featuredCategories[0].name}
                                    bgColor={getCategoryPresentation(featuredCategories[0].name, 0).bgColor}
                                    onPress={() => openCategory(featuredCategories[0].name)}
                                    style={styles.tileTall}
                                />
                            ) : null}
                            {featuredCategories[1] ? (
                                <CategoryTile
                                    icon={getCategoryPresentation(featuredCategories[1].name, 1).icon}
                                    label={featuredCategories[1].name}
                                    bgColor={getCategoryPresentation(featuredCategories[1].name, 1).bgColor}
                                    onPress={() => openCategory(featuredCategories[1].name)}
                                    style={styles.tileShort}
                                />
                            ) : null}
                        </View>
                        <View style={styles.masonryCol}>
                            {featuredCategories[2] ? (
                                <CategoryTile
                                    icon={getCategoryPresentation(featuredCategories[2].name, 2).icon}
                                    label={featuredCategories[2].name}
                                    bgColor={getCategoryPresentation(featuredCategories[2].name, 2).bgColor}
                                    onPress={() => openCategory(featuredCategories[2].name)}
                                    style={styles.tileMed}
                                />
                            ) : null}
                            {featuredCategories[3] ? (
                                <CategoryTile
                                    icon={getCategoryPresentation(featuredCategories[3].name, 3).icon}
                                    label={featuredCategories[3].name}
                                    bgColor={getCategoryPresentation(featuredCategories[3].name, 3).bgColor}
                                    onPress={() => openCategory(featuredCategories[3].name)}
                                    style={styles.tileMed}
                                />
                            ) : null}
                        </View>
                    </View>
                )}

                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Upcoming Events</Text>
                    <TouchableOpacity onPress={() => router.push("/events")} activeOpacity={0.85}>
                        <Text style={styles.sectionAction}>See all</Text>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator testID='activity-indicator' size='large' color={colors.secondary} />
                    </View>
                ) : fetchError ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons name='wifi-off' size={40} color={colors.onSurfaceVariant} />
                        <Text style={styles.emptyText}>{fetchError}</Text>
                    </View>
                ) : featuredEvents.length === 0 ? (
                    <View style={styles.centered}>
                        <MaterialCommunityIcons
                            name='calendar-remove-outline'
                            size={40}
                            color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.emptyText}>No events yet</Text>
                    </View>
                ) : (
                    <View style={styles.eventList}>
                        {featuredEvents.map((event) => (
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
