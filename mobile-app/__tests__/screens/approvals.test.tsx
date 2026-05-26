import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockFetchAdminPendingEvents = jest.fn();
const mockApproveAdminEvent = jest.fn();
const mockRejectAdminEvent = jest.fn();

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
  fetchAdminPendingEvents: () => mockFetchAdminPendingEvents(),
  approveAdminEvent: (eventId: string) => mockApproveAdminEvent(eventId),
  rejectAdminEvent: (eventId: string, reason: string) =>
    mockRejectAdminEvent(eventId, reason),
}));

jest.mock('../../src/lib/eventPresentation', () => ({
  formatEventDateTime: (value: string) => `formatted:${value}`,
}));

import ApprovalsScreen from '../../app/(tabs)/approvals';

const pendingEvent = {
  id: 'event-1',
  title: 'Pending Expo',
  description: 'Pending description',
  date_time: '2026-05-02T12:00:00Z',
  location: 'Room B',
  capacity: 30,
  organizer_id: '1',
  status: 'pending',
  created_at: '2026-04-01T00:00:00Z',
  submitted_at: '2026-04-02T00:00:00Z',
  rejection_reason: null,
  categories: ['Career'],
  images: [],
};

describe('ApprovalsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads pending events and approves through the backend API boundary', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'admin' },
    });
    mockFetchAdminPendingEvents.mockResolvedValue([pendingEvent]);
    mockApproveAdminEvent.mockResolvedValue({ ...pendingEvent, status: 'approved' });

    render(<ApprovalsScreen />);

    await waitFor(() => {
      expect(mockFetchAdminPendingEvents).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Pending Expo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Approve'));

    await waitFor(() => {
      expect(mockApproveAdminEvent).toHaveBeenCalledWith('event-1');
    });
    await waitFor(() => {
      expect(screen.getByText('No pending events need review.')).toBeTruthy();
    });
  });

  it('rejects with a required reason through the backend API boundary', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'admin' },
    });
    mockFetchAdminPendingEvents.mockResolvedValue([pendingEvent]);
    mockRejectAdminEvent.mockResolvedValue({ ...pendingEvent, status: 'rejected' });

    render(<ApprovalsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Pending Expo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Reject'));
    fireEvent.changeText(screen.getByPlaceholderText('Reason for rejection'), 'Missing room approval');
    fireEvent.press(screen.getByText('Confirm Reject'));

    await waitFor(() => {
      expect(mockRejectAdminEvent).toHaveBeenCalledWith('event-1', 'Missing room approval');
    });
    await waitFor(() => {
      expect(screen.getByText('No pending events need review.')).toBeTruthy();
    });
  });

  it('redirects non-admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, role: 'student' },
    });

    render(<ApprovalsScreen />);

    expect(screen.getByText('redirect:/(tabs)')).toBeTruthy();
    expect(mockFetchAdminPendingEvents).not.toHaveBeenCalled();
  });
});
