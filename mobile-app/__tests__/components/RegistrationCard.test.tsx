/**
 * Tests for src/components/RegistrationCard.tsx
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    surfaceContainerLowest: '#ffffff',
    secondary: '#006a6a',
    onPrimary: '#ffffff',
    onSurface: '#1a1c1f',
    onSurfaceVariant: '#42474e',
  },
}));

jest.mock('../../src/theme/typography', () => ({
  fontFamilies: {
    headlineSemiBold: 'PlusJakartaSans_600SemiBold',
    headline: 'PlusJakartaSans_700Bold',
    body: 'Manrope_400Regular',
    label: 'Manrope_700Bold',
  },
  fontSizes: {
    bodySm: 14,
    labelLg: 12,
  },
  borderRadius: {
    md: 8,
    xl: 16,
  },
}));

import { RegistrationCard } from '../../src/components/RegistrationCard';

describe('RegistrationCard', () => {
  it('renders the event title', () => {
    render(<RegistrationCard title="Spring Career Fair" date="Apr 14, 2026" location="Gym" />);
    expect(screen.getByText('Spring Career Fair')).toBeTruthy();
  });

  it('renders the date', () => {
    render(<RegistrationCard title="Spring Career Fair" date="Apr 14, 2026" location="Gym" />);
    expect(screen.getByText('Apr 14, 2026')).toBeTruthy();
  });

  it('renders the location', () => {
    render(<RegistrationCard title="Spring Career Fair" date="Apr 14, 2026" location="Gym" />);
    expect(screen.getByText('Gym')).toBeTruthy();
  });
});
