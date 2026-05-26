import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthenticatedEventImage } from './AuthenticatedEventImage';
import {
  formatEventDate,
  getDiscoveryEventCoverThumbnail,
} from '../lib/eventPresentation';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes, borderRadius } from '../theme/typography';
import type { DiscoveryEvent } from '../types/events';

export interface EventCardProps {
  event: DiscoveryEvent;
  onPress?: () => void;
  onOrganizerPress?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
}

export function EventCard({
  event,
  onPress,
  onOrganizerPress,
  actionLabel = 'View Details',
  actionDisabled = false,
}: EventCardProps) {
  const isActionDisabled = !onPress || actionDisabled;
  const coverThumbnail = getDiscoveryEventCoverThumbnail(event);

  return (
    <View style={styles.card}>
      {coverThumbnail ? (
        <AuthenticatedEventImage
          uri={coverThumbnail}
          style={styles.coverImage}
          testID={`event-card-cover-image-${event.id}`}
          accessibilityLabel={`${event.title} cover image`}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <MaterialCommunityIcons name="image-outline" size={32} color={colors.onSurfaceVariant} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.meta}>{formatEventDate(event.date_time)}</Text>
        </View>

        {event.location ? (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.meta} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="account-group-outline" size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.meta}>
            {event.registrations_count}/{event.capacity} registered
          </Text>
        </View>

        {event.organizer ? (
          <TouchableOpacity
            style={styles.organizerButton}
            onPress={onOrganizerPress}
            disabled={!onOrganizerPress}
            activeOpacity={0.8}
            testID={`event-card-organizer-${event.id}`}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={14} color={colors.secondary} />
            <Text style={styles.organizerText}>By {event.organizer.display_name}</Text>
          </TouchableOpacity>
        ) : null}

        {event.categories.length > 0 ? (
          <View style={styles.tagsRow}>
            {event.categories.slice(0, 2).map((cat) => (
              <View key={cat} style={styles.tag}>
                <Text style={styles.tagText}>{cat}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.actionButton,
            isActionDisabled ? styles.actionButtonDisabled : null,
          ]}
          disabled={isActionDisabled}
          activeOpacity={0.85}
          onPress={onPress}
          testID={`event-card-action-${event.id}`}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imagePlaceholder: {
    height: 140,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    height: 140,
    width: '100%',
    backgroundColor: colors.surfaceContainerHigh,
  },
  body: { padding: 16 },
  title: {
    fontFamily: fontFamilies.headlineSemiBold,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  meta: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.primary,
  },
  organizerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  organizerText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.secondary,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  actionButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onPrimary,
  },
});
