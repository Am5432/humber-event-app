import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockFetchOrganizerEvents = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockResolveApiBaseUrl = jest.fn(() => 'https://api.example.com');

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    Redirect: ({ href }: { href: string }) => {
      const { Text } = require('react-native');
      return <Text>redirect:{href}</Text>;
    },
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../src/lib/api', () => ({
  resolveApiBaseUrl: () => mockResolveApiBaseUrl(),
}));

jest.mock('../../src/lib/events', () => ({
  fetchOrganizerEvents: () => mockFetchOrganizerEvents(),
}));

jest.mock('../../src/lib/eventPresentation', () => ({
  formatEventDateTime: (value: string) => `formatted:${value}`,
  getOrganizerEventCoverThumbnail: (event: { images: Array<{ thumbnail_url: string }> }) =>
    event.images[0]?.thumbnail_url ?? null,
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    surface: '#f9f9fd',
    surfaceContainerLowest: '#ffffff',
    outlineVariant: '#c2c7d0',
    onSurface: '#1a1c1f',
    onSurfaceVariant: '#42474e',
    primary: '#001f3b',
    secondary: '#006a6a',
    onPrimary: '#ffffff',
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
    h2: 24,
    h3: 20,
    h4: 18,
    bodyLg: 16,
    bodySm: 14,
    labelLg: 12,
  },
  borderRadius: {
    full: 9999,
    xxl: 24,
  },
}));

import { OrganizerManageScreen } from '../../src/components/OrganizerManageScreen';

const mockEvents = [
  {
    id: 'event-1',
    title: 'Draft Mixer',
    description: 'Draft description',
    date_time: '2026-05-01T12:00:00Z',
    location: 'Room A',
    capacity: 30,
    organizer_id: '1',
    status: 'draft',
    created_at: '2026-04-01T00:00:00Z',
    submitted_at: null,
    rejection_reason: null,
    categories: ['Social'],
    images: [],
  },
  {
    id: 'event-2',
    title: 'Pending Expo',
    description: 'Pending description',
    date_time: '2026-05-02T12:00:00Z',
    location: 'Room B',
    capacity: 30,
    organizer_id: '1',
    status: 'pending',
    created_at: '2026-04-01T00:00:00Z',
    submitted_at: null,
    rejection_reason: null,
    categories: ['Career'],
    images: [
      {
        id: 'img-pending',
        position: 0,
        original_url: '/media/events/event-2/img-pending/original.jpg',
        display_url: '/media/events/event-2/img-pending/display.jpg',
        thumbnail_url: '/media/events/event-2/img-pending/thumbnail.jpg',
        width: 1280,
        height: 720,
      },
    ],
  },
  {
    id: 'event-3',
    title: 'Approved Workshop',
    description: 'Approved description',
    date_time: '2026-05-03T12:00:00Z',
    location: 'Room C',
    capacity: 30,
    organizer_id: '1',
    status: 'approved',
    created_at: '2026-04-01T00:00:00Z',
    submitted_at: null,
    rejection_reason: null,
    categories: ['Workshop'],
    images: [
      {
        id: 'img-approved',
        position: 0,
        original_url: '/media/events/event-3/img-approved/original.jpg',
        display_url: '/media/events/event-3/img-approved/display.jpg',
        thumbnail_url: '/media/events/event-3/img-approved/thumbnail.jpg',
        width: 1280,
        height: 720,
      },
    ],
  },
];

describe('OrganizerManageScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveApiBaseUrl.mockReturnValue('https://api.example.com');
  });

  it('renders manage content and filters organizer events in place', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'organizer' },
      token: 'organizer-token',
    });
    mockFetchOrganizerEvents.mockResolvedValue(mockEvents);

    render(<OrganizerManageScreen showBackAction={false} />);

    await waitFor(() => {
      expect(screen.getByText('Manage Events')).toBeTruthy();
      expect(screen.getByText('Create Event')).toBeTruthy();
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
      expect(screen.getByText('Draft Mixer')).toBeTruthy();
      expect(screen.getByText('Pending Expo')).toBeTruthy();
      expect(screen.getByText('Approved Workshop')).toBeTruthy();
    });

    const image = screen.getByTestId('manage-cover-image-event-2');
    expect(image.props.source).toEqual({
      uri: 'https://api.example.com/media/events/event-2/img-pending/thumbnail.jpg',
      headers: {
        Authorization: 'Bearer organizer-token',
      },
    });

    fireEvent.press(screen.getByTestId('manage-filter-draft'));

    await waitFor(() => {
      expect(screen.getByText('Draft Mixer')).toBeTruthy();
      expect(screen.queryByText('Pending Expo')).toBeNull();
      expect(screen.queryByText('Approved Workshop')).toBeNull();
    });

    expect(screen.queryByTestId('manage-cover-image-event-1')).toBeNull();
  });

  it('redirects student deep links away from organizer tools', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, role: 'student' },
      token: 'student-token',
    });

    render(<OrganizerManageScreen showBackAction />);

    expect(screen.getByText('redirect:/(tabs)/profile')).toBeTruthy();
    expect(mockFetchOrganizerEvents).not.toHaveBeenCalled();
  });
});
