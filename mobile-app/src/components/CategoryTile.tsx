import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes, borderRadius } from '../theme/typography';

export interface CategoryTileProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  bgColor: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CategoryTile({ icon, label, bgColor, onPress, style }: CategoryTileProps) {
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: bgColor }, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons name={icon} size={28} color={colors.onPrimary} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  label: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.labelLg,
    color: colors.onPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
});
