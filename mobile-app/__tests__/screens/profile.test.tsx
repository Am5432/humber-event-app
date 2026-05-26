import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockUpdateDisplayName = jest.fn();
const mockSignOut = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useNavigation: () => ({
    addListener: mockAddListener,
    dispatch: mockDispatch,
    navigate: mockNavigate,
    getState: () => ({ routes: [] }),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      displayName: 'Taylor Student',
      email: 'taylor@humber.ca',
      role: 'student',
    },
    signOut: mockSignOut,
    updateDisplayName: mockUpdateDisplayName,
  }),
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    surface: '#f9f9fd',
    primary: '#001f3b',
    primaryContainer: '#00355e',
    secondary: '#006a6a',
    secondaryContainer: '#90efef',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f3f3f7',
    outlineVariant: '#c2c7d0',
    onSurface: '#1a1c1f',
    onSurfaceVariant: '#42474e',
    onPrimary: '#ffffff',
    error: '#ba1a1a',
  },
}));

jest.mock('../../src/theme/typography', () => ({
  fontFamilies: {
    headline: 'PlusJakartaSans_700Bold',
    body: 'Manrope_400Regular',
    bodyBold: 'Manrope_700Bold',
    label: 'Manrope_700Bold',
  },
  fontSizes: {
    h3: 20,
    bodyLg: 16,
    bodySm: 14,
    labelLg: 12,
  },
  borderRadius: {
    full: 9999,
    lg: 12,
    xxl: 24,
  },
}));

import ProfileScreen from '../../app/(tabs)/profile';

describe('ProfileScreen', () => {
  const alertSpy = jest.spyOn(Alert, 'alert');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the inline display-name editor and saves a trimmed name', async () => {
    mockUpdateDisplayName.mockResolvedValue(undefined);

    render(<ProfileScreen />);

    fireEvent.press(screen.getByLabelText('Edit display name'));

    const input = screen.getByLabelText('Display name');
    fireEvent.changeText(input, '  Updated Name  ');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateDisplayName).toHaveBeenCalledWith('Updated Name');
    });

    expect(screen.queryByText('Discard Changes')).toBeNull();
  });

  it('prompts before discarding dirty changes', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByLabelText('Edit display name'));
    fireEvent.changeText(screen.getByLabelText('Display name'), 'Changed Name');
    fireEvent.press(screen.getByText('Discard Changes'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Discard changes',
      'Discard your unsaved display name changes?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep editing', style: 'cancel' }),
        expect.objectContaining({ text: 'Discard Changes', style: 'destructive' }),
      ]),
    );
  });
});
