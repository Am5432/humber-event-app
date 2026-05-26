import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockFetchAdminAnalytics = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>redirect:{href}</Text>;
  },
}));

jest.mock('../../src/lib/events', () => ({
  fetchAdminAnalytics: () => mockFetchAdminAnalytics(),
}));

import AdminScreen from '../../app/(tabs)/admin';

describe('AdminScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads admin analytics from the backend API boundary', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'admin' },
    });
    mockFetchAdminAnalytics.mockResolvedValue({
      total_events: 12,
      approved_events: 8,
      pending_events: 3,
      rejected_events: 1,
      total_registrations: 41,
      total_users: 20,
      student_users: 15,
      organizer_users: 4,
      admin_users: 1,
    });

    render(<AdminScreen />);

    await waitFor(() => {
      expect(mockFetchAdminAnalytics).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Total Events')).toBeTruthy();
      expect(screen.getByText('12')).toBeTruthy();
      expect(screen.getByText('Pending Approval')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('Total Users')).toBeTruthy();
      expect(screen.getByText('20')).toBeTruthy();
    });
  });

  it('redirects non-admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, role: 'student' },
    });

    render(<AdminScreen />);

    expect(screen.getByText('redirect:/(tabs)')).toBeTruthy();
    expect(mockFetchAdminAnalytics).not.toHaveBeenCalled();
  });
});
