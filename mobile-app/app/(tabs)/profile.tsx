import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  TextInput,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { type Href, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme/colors';
import { fontFamilies, fontSizes, borderRadius } from '../../src/theme/typography';

const DISPLAY_NAME_MAX_LENGTH = 255;

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  organizer: 'Organizer',
  admin: 'Admin',
};

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const unsafeNavigation = navigation as any;
  const { user, signOut, updateDisplayName } = useAuth();
  const canManageOrganizerEvents = user?.role === 'organizer' || user?.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(user?.displayName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const pendingNavigationActionRef = useRef<(() => void) | null>(null);

  const avatarInitial = user?.displayName?.charAt(0).toUpperCase() ?? '?';
  const savedDisplayName = user?.displayName ?? '';
  const trimmedDisplayName = draftDisplayName.trim();
  const isDirty = isEditing && trimmedDisplayName !== savedDisplayName;
  const validationError = useMemo(() => {
    if (!isEditing) {
      return null;
    }

    if (trimmedDisplayName.length === 0) {
      return 'Enter a display name.';
    }

    if (trimmedDisplayName.length > DISPLAY_NAME_MAX_LENGTH) {
      return 'Display name must be 255 characters or fewer.';
    }

    return null;
  }, [isEditing, trimmedDisplayName]);
  const canSave = Boolean(
    isEditing &&
      !isSaving &&
      trimmedDisplayName.length > 0 &&
      trimmedDisplayName.length <= DISPLAY_NAME_MAX_LENGTH &&
      trimmedDisplayName !== savedDisplayName,
  );

  useEffect(() => {
    if (!isEditing) {
      setDraftDisplayName(savedDisplayName);
    }
  }, [isEditing, savedDisplayName]);

  useEffect(() => {
    const confirmDiscardChanges = (onDiscard: () => void) => {
      if (!isDirty) {
        onDiscard();
        return;
      }

      Alert.alert('Discard changes', 'Discard your unsaved display name changes?', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard Changes',
          style: 'destructive',
          onPress: onDiscard,
        },
      ]);
    };

    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (event: any) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      confirmDiscardChanges(() => {
        navigation.dispatch(event.data.action);
      });
    });

    const unsubscribeTabPress = unsafeNavigation.addListener('tabPress', (event: any) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();

      const state = unsafeNavigation.getState?.() as
        | { routes?: Array<{ key: string; name: string }> }
        | undefined;
      const route = state?.routes?.find((item) => item.key === event.target);

      if (!route) {
        return;
      }

      pendingNavigationActionRef.current = () => {
        navigation.navigate(route.name as never);
      };

      confirmDiscardChanges(() => {
        const pendingNavigationAction = pendingNavigationActionRef.current;
        pendingNavigationActionRef.current = null;
        pendingNavigationAction?.();
      });
    });

    return () => {
      unsubscribeBeforeRemove();
      unsubscribeTabPress();
    };
  }, [isDirty, navigation, unsafeNavigation]);

  const handleStartEditing = () => {
    setDraftDisplayName(savedDisplayName);
    setIsEditing(true);
  };

  const handleCancelEditing = useCallback(() => {
    setDraftDisplayName(savedDisplayName);
    setIsEditing(false);
  }, [savedDisplayName]);

  const handleSaveDisplayName = useCallback(async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);

    try {
      await updateDisplayName(trimmedDisplayName);
      setDraftDisplayName(trimmedDisplayName);
      setIsEditing(false);
    } catch (error) {
      console.error('[ProfileScreen] update display name failed', error);
    } finally {
      setIsSaving(false);
    }
  }, [canSave, trimmedDisplayName, updateDisplayName]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

        <View style={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>

        {/* Name */}
        <Text style={styles.displayName}>{user?.displayName ?? '—'}</Text>

        {/* Email */}
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        {/* Role badge */}
        {user?.role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{ROLE_LABELS[user.role] ?? user.role}</Text>
          </View>
        ) : null}

        {/* Display name editor */}
        {user ? (
          <View style={styles.displayNameCard}>
            {!isEditing ? (
              <View style={styles.displayNameRow}>
                <View style={styles.displayNameTextBlock}>
                  <Text style={styles.fieldLabel}>Display name</Text>
                  <Text style={styles.displayNameValue}>{savedDisplayName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleStartEditing}
                  accessibilityRole="button"
                  accessibilityLabel="Edit display name"
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="pencil" size={18} color={colors.secondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.displayNameEditor}>
                <Text style={styles.fieldLabel}>Display name</Text>
                <TextInput
                  style={styles.displayNameInput}
                  value={draftDisplayName}
                  onChangeText={setDraftDisplayName}
                  accessibilityLabel="Display name"
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  editable={!isSaving}
                />
                {validationError ? <Text style={styles.fieldError}>{validationError}</Text> : null}
                <View style={styles.actionStack}>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      !canSave ? styles.saveButtonDisabled : null,
                    ]}
                    onPress={handleSaveDisplayName}
                    disabled={!canSave}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.discardButton}
                    onPress={() => {
                      pendingNavigationActionRef.current = null;
                      Alert.alert('Discard changes', 'Discard your unsaved display name changes?', [
                        { text: 'Keep editing', style: 'cancel' },
                        {
                          text: 'Discard Changes',
                          style: 'destructive',
                          onPress: handleCancelEditing,
                        },
                      ]);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.discardButtonText}>Discard Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/registrations' as Href)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color={colors.secondary} />
          <Text style={styles.linkText}>My Registrations</Text>
        </TouchableOpacity>

        {canManageOrganizerEvents ? (
          <>
            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/organizer' as Href)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.secondary} />
              <Text style={styles.linkText}>Organizer Events</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.divider} />

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h3,
    color: colors.onSurface,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontFamily: fontFamilies.headline,
    fontSize: 36,
    color: colors.onPrimary,
  },
  displayName: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h3,
    color: colors.onSurface,
    marginBottom: 4,
  },
  email: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
    marginBottom: 12,
  },
  displayNameCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
  },
  displayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  displayNameTextBlock: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  displayNameValue: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayNameEditor: {
    gap: 12,
  },
  displayNameInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  fieldError: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.error,
    lineHeight: 20,
  },
  actionStack: {
    gap: 12,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.onPrimary,
  },
  discardButton: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  discardButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  roleBadge: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  roleText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.secondary,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: 32,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLowest,
    width: '100%',
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.secondary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.error,
    width: '100%',
    justifyContent: 'center',
  },
  signOutText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.error,
  },
});
