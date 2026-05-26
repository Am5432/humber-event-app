/**
 * Tests for src/components/CategoryTile.tsx
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    onPrimary: '#ffffff',
  },
}));

jest.mock('../../src/theme/typography', () => ({
  fontFamilies: {
    label: 'Manrope_700Bold',
  },
  fontSizes: {
    labelLg: 12,
  },
  borderRadius: {
    xl: 16,
  },
}));

import { CategoryTile } from '../../src/components/CategoryTile';

describe('CategoryTile', () => {
  it('renders the label', () => {
    render(<CategoryTile icon="hammer-wrench" label="Workshops" bgColor="#006a6a" />);
    expect(screen.getByText('Workshops')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<CategoryTile icon="hammer-wrench" label="Workshops" bgColor="#006a6a" onPress={onPress} />);
    fireEvent.press(screen.getByText('Workshops'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onPress handler', () => {
    render(<CategoryTile icon="hammer-wrench" label="Workshops" bgColor="#006a6a" />);
    expect(screen.getByText('Workshops')).toBeTruthy();
  });
});
