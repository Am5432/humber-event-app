import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useState } from 'react';
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
import { fetchAdminUsers, updateAdminUserRole } from '../../src/lib/events';
import { colors } from '../../src/theme/colors';
import { borderRadius, fontFamilies, fontSizes } from '../../src/theme/typography';
import type { AdminUser, UserRole } from '../../src/types/events';

type ManagedRole = 'student' | 'organizer' | 'admin';

const MANAGED_ROLES: ManagedRole[] = ['student', 'organizer', 'admin'];

function formatRole(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function UsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<ManagedRole | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const loadUsers = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    try {
      setUsers(
        await fetchAdminUsers({
          q: deferredQuery || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter,
        }),
      );
    } catch {
      setUsers([]);
      setError('Users could not load. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [deferredQuery, roleFilter]);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadUsers();
    } else {
      setIsLoading(false);
    }
  }, [loadUsers, user?.role]);

  const changeRole = async (targetUser: AdminUser, role: ManagedRole) => {
    if (targetUser.role === role) {
      return;
    }

    setUpdatingUserId(targetUser.id);
    setError(null);
    try {
      const updatedUser = await updateAdminUserRole(targetUser.id, role);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser,
        ),
      );
    } catch (updateError: any) {
      const detail =
        updateError?.response?.data?.detail ||
        updateError?.message ||
        'User role update failed.';
      setError(String(detail));
    } finally {
      setUpdatingUserId(null);
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
          onRefresh={() => void loadUsers(true)}
          tintColor={colors.secondary}
          colors={[colors.secondary]}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Users</Text>
        <Text style={styles.title}>Manage access for Humber Event Hub.</Text>
        <Text style={styles.subtitle}>
          Search backend users and update student, organizer, or admin roles.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or email"
          placeholderTextColor={colors.onSurfaceVariant}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', ...MANAGED_ROLES] as const).map((role) => {
          const isSelected = roleFilter === role;
          return (
            <Pressable
              key={role}
              onPress={() => setRoleFilter(role)}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              testID={`user-role-filter-${role}`}
            >
              <Text style={[styles.filterText, isSelected && styles.filterTextSelected]}>
                {role === 'all' ? 'All' : formatRole(role)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons name="account-search-outline" size={40} color={colors.onSurfaceVariant} />
          <Text style={styles.emptyTitle}>No users match this search.</Text>
        </View>
      ) : (
        users.map((adminUser) => {
          const isUpdating = updatingUserId === adminUser.id;
          return (
            <View key={adminUser.id} style={styles.card}>
              <View style={styles.userHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {adminUser.display_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userText}>
                  <Text style={styles.name}>{adminUser.display_name}</Text>
                  <Text style={styles.email}>{adminUser.email}</Text>
                </View>
              </View>

              <Text style={styles.roleLabel}>Current role: {formatRole(adminUser.role)}</Text>

              <View style={styles.roleActions}>
                {MANAGED_ROLES.map((role) => {
                  const isActive = adminUser.role === role;
                  return (
                    <Pressable
                      key={role}
                      onPress={() => void changeRole(adminUser, role)}
                      disabled={isUpdating}
                      style={[
                        styles.roleButton,
                        isActive && styles.roleButtonActive,
                        isUpdating && styles.disabledButton,
                      ]}
                      testID={`set-role-${adminUser.id}-${role}`}
                    >
                      <Text style={[styles.roleButtonText, isActive && styles.roleButtonTextActive]}>
                        {formatRole(role)}
                      </Text>
                    </Pressable>
                  );
                })}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  filterChip: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  filterText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.primary,
  },
  filterTextSelected: {
    color: colors.onPrimary,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: 18,
    marginBottom: 14,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onPrimary,
  },
  userText: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
  },
  email: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  roleLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySm,
    color: colors.onSurface,
    marginTop: 14,
  },
  roleActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  roleButton: {
    flex: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  roleButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.primary,
  },
  roleButtonTextActive: {
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
