import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes, borderRadius } from '../theme/typography';

export interface RegistrationCardProps {
  title: string;
  date: string;
  location: string;
  onPress?: () => void;
}

export function RegistrationCard({ title, date, location, onPress }: RegistrationCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.imagePlaceholder}>
        <MaterialCommunityIcons name="image-outline" size={28} color={colors.onSurfaceVariant} />
      </View>
      <View style={styles.body}>
        {/* Title Container with fixed height for alignment */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="calendar-outline" size={12} color={colors.onSurfaceVariant} />
            <Text style={styles.meta}>{date}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.onSurfaceVariant} />
            <Text style={styles.meta} numberOfLines={1}>
              {location || "Online/TBD"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewTicketButton}
          activeOpacity={0.8}
          onPress={onPress}
          disabled={!onPress}
        >
          <Text style={styles.viewTicketText}>View Event</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imagePlaceholder: {
    height: 120,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 12,
    gap: 4,
  },
  title: {
    fontFamily: fontFamilies.headlineSemiBold ?? fontFamilies.headline,
    fontSize: fontSizes.bodySm,
    color: colors.onSurface,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelSm ?? fontSizes.labelLg,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  viewTicketButton: {
    marginTop: 'auto',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewTicketText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onPrimary,
  },
  titleContainer: {
    // Height = (FontSize * 1.2) * 2 lines
    height: 44, 
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  infoSection: {
    // This ensures the date/location stay grouped
    marginBottom: 2,
    minHeight: 40, // Keeps rows aligned even if location is missing
  }
});
