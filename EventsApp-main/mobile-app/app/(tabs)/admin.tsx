import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { fetchAdminAnalytics } from '../../src/lib/events';
import { colors } from '../../src/theme/colors';
import { borderRadius, fontFamilies, fontSizes } from '../../src/theme/typography';
import type { AdminAnalyticsSummary } from '../../src/types/events';

type MetricCard = {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

function buildMetrics(summary: AdminAnalyticsSummary): MetricCard[] {
  return [
    {
      label: 'Total Events',
      value: summary.total_events,
      icon: 'calendar-multiselect-outline',
    },
    {
      label: 'Approved Events',
      value: summary.approved_events,
      icon: 'check-circle-outline',
    },
    {
      label: 'Pending Approval',
      value: summary.pending_events,
      icon: 'clock-outline',
    },
    {
      label: 'Rejected Events',
      value: summary.rejected_events,
      icon: 'close-circle-outline',
    },
    {
      label: 'Total Users',
      value: summary.total_users,
      icon: 'account-group-outline',
    },
    {
      label: 'Students',
      value: summary.student_users,
      icon: 'school-outline',
    },
    {
      label: 'Organizers',
      value: summary.organizer_users,
      icon: 'account-tie-outline',
    },
    {
      label: 'Admins',
      value: summary.admin_users,
      icon: 'shield-account-outline',
    },
    {
      label: 'Registrations',
      value: summary.total_registrations,
      icon: 'ticket-confirmation-outline',
    },
  ];
}

export default function AdminScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    try {
      setSummary(await fetchAdminAnalytics());
    } catch {
      setSummary(null);
      setError('Admin analytics could not load. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadSummary();
    } else {
      setIsLoading(false);
    }
  }, [loadSummary, user?.role]);

  if (user?.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  const metrics = summary ? buildMetrics(summary) : [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadSummary(true)}
          tintColor={colors.secondary}
          colors={[colors.secondary]}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Admin</Text>
        <Text style={styles.title}>Campus event operations at a glance.</Text>
        <Text style={styles.subtitle}>
          These numbers come from the backend admin analytics endpoint.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="wifi-off" size={40} color={colors.onSurfaceVariant} />
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.card}>
              <MaterialCommunityIcons name={metric.icon} size={26} color={colors.primary} />
              <Text style={styles.value}>{metric.value}</Text>
              <Text style={styles.label}>{metric.label}</Text>
            </View>
          ))}
        </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  value: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h1,
    color: colors.primary,
    marginTop: 10,
  },
  label: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
