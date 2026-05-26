import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import {
  approveAdminEvent,
  fetchAdminPendingEvents,
  rejectAdminEvent,
} from '../../src/lib/events';
import { formatEventDateTime } from '../../src/lib/eventPresentation';
import { colors } from '../../src/theme/colors';
import { borderRadius, fontFamilies, fontSizes } from '../../src/theme/typography';
import type { OrganizerEvent } from '../../src/types/events';

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actingEventId, setActingEventId] = useState<string | null>(null);
  const [rejectingEventId, setRejectingEventId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPendingEvents = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    try {
      setEvents(await fetchAdminPendingEvents());
    } catch {
      setEvents([]);
      setError('Pending approvals could not load. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadPendingEvents();
    } else {
      setIsLoading(false);
    }
  }, [loadPendingEvents, user?.role]);

  const approveEvent = async (eventId: string) => {
    setActingEventId(eventId);
    setError(null);
    try {
      await approveAdminEvent(eventId);
      setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
    } catch {
      setError('Event approval failed. Refresh and try again.');
    } finally {
      setActingEventId(null);
    }
  };

  const rejectEvent = async (eventId: string) => {
    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setError('A rejection reason is required.');
      return;
    }

    setActingEventId(eventId);
    setError(null);
    try {
      await rejectAdminEvent(eventId, trimmedReason);
      setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
      setRejectingEventId(null);
      setRejectionReason('');
    } catch {
      setError('Event rejection failed. Refresh and try again.');
    } finally {
      setActingEventId(null);
    }
  };

  if (user?.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadPendingEvents(true)}
          tintColor={colors.secondary}
          colors={[colors.secondary]}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Approvals</Text>
        <Text style={styles.title}>Review submitted organizer events.</Text>
        <Text style={styles.subtitle}>
          Approve or reject pending events through the backend moderation workflow.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={40} color={colors.onSurfaceVariant} />
          <Text style={styles.emptyTitle}>No pending events need review.</Text>
        </View>
      ) : (
        events.map((event) => {
          const isActing = actingEventId === event.id;
          const isRejecting = rejectingEventId === event.id;

          return (
            <View key={event.id} style={styles.card}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.meta}>{formatEventDateTime(event.date_time)}</Text>
              <Text style={styles.meta}>{event.location}</Text>
              <Text style={styles.meta}>Capacity: {event.capacity}</Text>
              <View style={styles.categoryRow}>
                {event.categories.map((category) => (
                  <Text key={category} style={styles.categoryChip}>
                    {category}
                  </Text>
                ))}
              </View>

              {isRejecting ? (
                <TextInput
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Reason for rejection"
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={styles.reasonInput}
                  multiline
                />
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  onPress={() => void approveEvent(event.id)}
                  disabled={isActing}
                  style={[styles.actionButton, styles.approveButton, isActing && styles.disabledButton]}
                >
                  <Text style={styles.actionText}>Approve</Text>
                </Pressable>

                {isRejecting ? (
                  <Pressable
                    onPress={() => void rejectEvent(event.id)}
                    disabled={isActing}
                    style={[styles.actionButton, styles.rejectButton, isActing && styles.disabledButton]}
                  >
                    <Text style={styles.actionText}>Confirm Reject</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setRejectingEventId(event.id);
                      setRejectionReason('');
                      setError(null);
                    }}
                    disabled={isActing}
                    style={[styles.actionButton, styles.rejectButton, isActing && styles.disabledButton]}
                  >
                    <Text style={styles.actionText}>Reject</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.surface,
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
  eyebrow: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h2,
    color: colors.onSurface,
  },
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  eventTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h3,
    color: colors.onSurface,
    marginBottom: 8,
  },
  meta: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  categoryChip: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.primary,
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: 12,
    marginTop: 14,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: colors.secondary,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onPrimary,
  },
  errorText: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySm,
    color: colors.error,
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: colors.surface,
  },
  centeredContent: {
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
});
