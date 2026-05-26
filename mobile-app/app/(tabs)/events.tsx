import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EventCard } from '../../src/components/EventCard';
import { fetchCategories, fetchDiscoveryEvents } from '../../src/lib/events';
import { subscribeToRegistrationCreated } from '../../src/lib/registrationEvents';
import { colors } from '../../src/theme/colors';
import { borderRadius, fontFamilies, fontSizes } from '../../src/theme/typography';
import type { DiscoveryEvent, EventCategory } from '../../src/types/events';

const FILTER_EMPTY_TITLE = 'No events match these filters';
const FILTER_EMPTY_BODY =
  'Clear one or more filters or change your search. Pull down to refresh if you expected new events.';
const LOAD_ERROR_COPY =
  "We couldn't load the latest data. Pull down to retry or tap Try again.";

function getOrganizerPressHandler(
  event: DiscoveryEvent,
  openProfile: (userId: number) => void,
): (() => void) | undefined {
  const organizer = event.organizer;
  return organizer ? () => openProfile(organizer.id) : undefined;
}

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focusSearch?: string }>();
  const focusSearchParam = Array.isArray(params.focusSearch)
    ? params.focusSearch[0]
    : params.focusSearch;
  const searchInputRef = useRef<TextInput>(null);
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim());

  const loadEvents = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      const [eventsResult, categoriesResult] = await Promise.allSettled([
        fetchDiscoveryEvents({ q: deferredQuery || undefined }),
        fetchCategories(),
      ]);

      let hasFailure = false;

      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value);
      } else {
        setEvents([]);
        hasFailure = true;
      }

      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value);
      } else {
        setCategories([]);
        hasFailure = true;
      }

      if (hasFailure) {
        setError(LOAD_ERROR_COPY);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [deferredQuery],
  );

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const unsubscribe = subscribeToRegistrationCreated((registeredEvent) => {
      setEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === registeredEvent.id ? registeredEvent : currentEvent,
        ),
      );
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (focusSearchParam !== '1' && focusSearchParam !== 'true') {
      return;
    }

    const timeoutId = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [focusSearchParam]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadEvents(true);
  };

  const openEvent = (eventId: string) => {
    router.push(`/events/${eventId}` as Href);
  };

  const openProfile = (userId: number) => {
    router.push(`/users/${userId}` as Href);
  };

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories((currentCategories) =>
      currentCategories.includes(categoryName)
        ? currentCategories.filter((currentCategory) => currentCategory !== categoryName)
        : [...currentCategories, categoryName],
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
  };

  const filteredEvents =
    selectedCategories.length === 0
      ? events
      : events.filter((event) =>
          event.categories.some((category) => selectedCategories.includes(category)),
        );

  const hasActiveCategoryFilters = selectedCategories.length > 0;

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
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Events</Text>
          <Text style={styles.heroTitle}>Browse every approved event in the backend.</Text>
          <Text style={styles.heroCopy}>
            Filter approved events with category chips, then open any event for full details.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceVariant} />
          <TextInput
            ref={searchInputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search events by title or description"
            placeholderTextColor={colors.onSurfaceVariant}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Categories</Text>
          {hasActiveCategoryFilters ? (
            <TouchableOpacity onPress={clearFilters} activeOpacity={0.8} testID="clear-filters">
              <Text style={styles.sectionActionText}>Clear Filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.categoryWrap}>
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.name);

            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => toggleCategory(category.name)}
                activeOpacity={0.85}
                testID={`category-chip-${category.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.categoryChip,
                  isSelected ? styles.categoryChipSelected : styles.categoryChipUnselected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected
                      ? styles.categoryChipTextSelected
                      : styles.categoryChipTextUnselected,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>All Approved Events</Text>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.secondary} testID="events-activity-indicator" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="wifi-off" size={40} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>{error}</Text>
          </View>
        ) : filteredEvents.length === 0 && hasActiveCategoryFilters ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons
              name="filter-outline"
              size={40}
              color={colors.onSurfaceVariant}
            />
            <Text style={styles.emptyTitle}>{FILTER_EMPTY_TITLE}</Text>
            <Text style={styles.emptyBody}>{FILTER_EMPTY_BODY}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons
              name="calendar-remove-outline"
              size={40}
              color={colors.onSurfaceVariant}
            />
            <Text style={styles.emptyTitle}>No approved events are available.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredEvents.map((event) => (
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
  hero: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    padding: 20,
    marginBottom: 20,
    gap: 8,
  },
  heroEyebrow: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h2,
    color: colors.onSurface,
  },
  heroCopy: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  sectionTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
  },
  sectionActionText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.secondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipUnselected: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
  },
  categoryChipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  categoryChipText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
  },
  categoryChipTextUnselected: {
    color: colors.primary,
  },
  categoryChipTextSelected: {
    color: colors.onPrimary,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    gap: 0,
  },
});
