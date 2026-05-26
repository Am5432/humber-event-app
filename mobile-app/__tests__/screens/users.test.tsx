import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockFetchAdminUsers = jest.fn();
const mockUpdateAdminUserRole = jest.fn();

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
  fetchAdminUsers: (params: { q?: string; role?: string }) => mockFetchAdminUsers(params),
  updateAdminUserRole: (userId: number, role: string) =>
    mockUpdateAdminUserRole(userId, role),
}));

import UsersScreen from '../../app/(tabs)/users';

const adminUsers = [
  {
    id: 1,
    email: 'student@humber.ca',
    display_name: 'Dev Student',
    role: 'student',
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 2,
    email: 'organizer@humber.ca',
    display_name: 'Dev Organizer',
    role: 'organizer',
    created_at: '2026-04-01T00:00:00Z',
  },
];

describe('UsersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads users from the backend API boundary', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 99, role: 'admin' },
    });
    mockFetchAdminUsers.mockResolvedValue(adminUsers);

    render(<UsersScreen />);

    await waitFor(() => {
      expect(mockFetchAdminUsers).toHaveBeenCalledWith({
        q: undefined,
        role: undefined,
      });
      expect(screen.getByText('Dev Student')).toBeTruthy();
      expect(screen.getByText('organizer@humber.ca')).toBeTruthy();
    });
  });

  it('updates a user role through the backend API boundary', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 99, role: 'admin' },
    });
    mockFetchAdminUsers.mockResolvedValue(adminUsers);
    mockUpdateAdminUserRole.mockResolvedValue({
      ...adminUsers[0],
      role: 'organizer',
    });

    render(<UsersScreen />);

    await waitFor(() => {
      expect(screen.getByText('Dev Student')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('set-role-1-organizer'));

    await waitFor(() => {
      expect(mockUpdateAdminUserRole).toHaveBeenCalledWith(1, 'organizer');
      expect(screen.getAllByText('Current role: Organizer').length).toBeGreaterThan(0);
    });
  });

  it('redirects non-admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, role: 'student' },
    });

    render(<UsersScreen />);

    expect(screen.getByText('redirect:/(tabs)')).toBeTruthy();
    expect(mockFetchAdminUsers).not.toHaveBeenCalled();
  });
});
