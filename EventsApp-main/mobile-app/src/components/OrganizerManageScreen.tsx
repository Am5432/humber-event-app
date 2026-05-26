import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, type Href, useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthenticatedEventImage } from './AuthenticatedEventImage';
import { useAuth } from '../context/AuthContext';
import {
  formatEventDateTime,
  getOrganizerEventCoverThumbnail,
} from '../lib/eventPresentation';
import { fetchOrganizerEvents } from '../lib/events';
import { colors } from '../theme/colors';
import { borderRadius, fontFamilies, fontSizes } from '../theme/typography';
import type { EventStatus, OrganizerEvent } from '../types/events';

type QuickFilter = 'all' | Extract<EventStatus, 'draft' | 'pending' | 'approved'>;

const FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
];

const EMPTY_HEADING = 'No events yet';
const EMPTY_BODY = 'Create your first event to start the approval workflow.';
const ERROR_HEADING = "Organizer events couldn't load";
const ERROR_BODY = 'Pull down to retry or try again in a moment.';
export function OrganizerManageScreen({ showBackAction }: { showBackAction: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const canManageEvents = user?.role === 'organizer' || user?.role === 'admin';
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');

  const loadEvents = useCallback(async (silent = false) => {
    if (!canManageEvents) {
      setIsLoading(false);
      setIsRefreshing(false);
      setEvents([]);
      setError(null);
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const organizerEvents = await fetchOrganizerEvents();
      setEvents(organizerEvents);
    } catch (loadError) {
      console.error('[OrganizerManageScreen] load error', loadError);
      setEvents([]);
      setError(ERROR_HEADING);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canManageEvents]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadEvents(true);
  };

  const counts = useMemo(
    () => ({
      draft: events.filter((event) => event.status === 'draft').length,
      pending: events.filter((event) => event.status === 'pending').length,
      approved: events.filter((event) => event.status === 'approved').length,
    }),
    [events],
  );

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') {
      return events;
    }

    return events.filter((event) => event.status === activeFilter);
  }, [activeFilter, events]);

  if (!canManageEvents) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
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
        <View style={styles.headerRow}>
          {showBackAction ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.headerTitle}>Manage</Text>
        </View>

        <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Manage Events</Text>
              <Text style={styles.heroCopy}>
                Track your draft, pending, and approved events in one place.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/organizer/new' as Href)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
              <Text style={styles.createButtonText}>Create Event</Text>
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Draft</Text>
                <Text style={styles.statValue}>{counts.draft}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={styles.statValue}>{counts.pending}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Approved</Text>
                <Text style={styles.statValue}>{counts.approved}</Text>
              </View>
            </View>

            <View style={styles.filterRow}>
              {FILTERS.map((filter) => {
                const isSelected = activeFilter === filter.key;

                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[
                      styles.filterChip,
                      isSelected ? styles.filterChipSelected : styles.filterChipUnselected,
                    ]}
                    onPress={() => setActiveFilter(filter.key)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    testID={`manage-filter-${filter.key}`}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected ? styles.filterChipTextSelected : styles.filterChipTextUnselected,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.secondary} />
              </View>
            ) : error ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateHeading}>{ERROR_HEADING}</Text>
                <Text style={styles.stateBody}>{ERROR_BODY}</Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void loadEvents()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : filteredEvents.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateHeading}>{EMPTY_HEADING}</Text>
                <Text style={styles.stateBody}>{EMPTY_BODY}</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {filteredEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() => router.push(`/organizer/${event.id}` as Href)}
                    activeOpacity={0.85}
                  >
                    {getOrganizerEventCoverThumbnail(event) ? (
                      <AuthenticatedEventImage
                        uri={getOrganizerEventCoverThumbnail(event)}
                        style={styles.eventCoverImage}
                        testID={`manage-cover-image-${event.id}`}
                        accessibilityLabel={`${event.title} cover image`}
                      />
                    ) : (
                      <View style={styles.eventCoverPlaceholder}>
                        <MaterialCommunityIcons
                          name="image-outline"
                          size={24}
                          color={colors.onSurfaceVariant}
                        />
                      </View>
                    )}
                    <View style={styles.eventCardBody}>
                      <View style={styles.eventHeaderRow}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventStatus}>{event.status}</Text>
                      </View>
                      <Text style={styles.eventMeta}>{formatEventDateTime(event.date_time)}</Text>
                      <Text style={styles.eventMeta}>{event.location}</Text>
                      <Text style={styles.eventMeta}>{event.categories.join(', ')}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
        </>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h3,
    color: colors.onSurface,
  },
  heroCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    padding: 20,
    gap: 8,
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h3,
    color: colors.onSurface,
  },
  heroCopy: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    marginBottom: 16,
  },
  createButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.onPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  statLabel: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h2,
    color: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  filterChip: {
    minHeight: 44,
    borderRadius: borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  filterChipUnselected: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
  },
  filterChipText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
  },
  filterChipTextSelected: {
    color: colors.onPrimary,
  },
  filterChipTextUnselected: {
    color: colors.primary,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  stateCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    padding: 20,
    gap: 12,
  },
  stateTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
    lineHeight: 24,
  },
  stateHeading: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
  },
  stateBody: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
  },
  secondaryButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onSurface,
  },
  list: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    padding: 18,
    gap: 14,
  },
  eventCoverImage: {
    width: '100%',
    height: 136,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerHigh,
  },
  eventCoverPlaceholder: {
    width: '100%',
    height: 136,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardBody: {
    gap: 8,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventTitle: {
    flex: 1,
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
  },
  eventStatus: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.secondary,
    textTransform: 'capitalize',
  },
  eventMeta: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
  },
});
