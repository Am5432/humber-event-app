/**
 * Tests for app/(tabs)/index.tsx — Discovery Feed screen
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Ionicons: 'Ionicons',
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, displayName: 'Alice', email: 'alice@test.com', role: 'student' },
    token: 'mock-token',
    isLoading: false,
  }),
}));

jest.mock('../../src/lib/appLogger', () => ({
  AppLogger: { debug: jest.fn() },
}));

jest.mock('../../src/lib/events', () => ({
  fetchDiscoveryEvents: jest.fn(),
  fetchCategories: jest.fn(),
  fetchAdminAnalytics: jest.fn(),
  fetchMyRegistrations: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/components/RegistrationCard', () => ({
  RegistrationCard: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text testID="registration-card">{title}</Text>;
  },
}));

jest.mock('../../src/lib/eventPresentation', () => ({
  getCategoryPresentation: (_name: string, index: number) => ({
    icon: 'calendar-star',
    bgColor: ['#006a6a', '#00355e', '#463000', '#006e6e'][index % 4],
  }),
}));

jest.mock('../../src/components/EventCard', () => ({
  EventCard: ({ event }: { event: { title: string } }) => {
    const { Text } = require('react-native');
    return <Text testID="event-card">{event.title}</Text>;
  },
}));

jest.mock('../../src/components/CategoryTile', () => ({
  CategoryTile: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text testID="category-tile">{label}</Text>;
  },
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    surface: '#f9f9fd',
    onSurface: '#1a1c1f',
    onSurfaceVariant: '#42474e',
    outlineVariant: '#c2c7d0',
    primaryContainer: '#00355e',
    onPrimary: '#ffffff',
    secondary: '#006a6a',
    tertiaryContainer: '#463000',
    onSecondaryContainer: '#006e6e',
    primary: '#001f3b',
    primaryFixedDim: '#a3c9fb',
    surfaceContainerLow: '#f3f3f7',
  },
}));

jest.mock('../../src/theme/typography', () => ({
  fontFamilies: {
    headline: 'PlusJakartaSans_700Bold',
    label: 'Manrope_700Bold',
    body: 'Manrope_400Regular',
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
    lg: 12,
    xxl: 24,
  },
}));

import DiscoveryFeedScreen from '../../app/(tabs)/index';
import {
  fetchAdminAnalytics,
  fetchCategories,
  fetchDiscoveryEvents,
  fetchMyRegistrations,
} from '../../src/lib/events';

const mockFetchDiscoveryEvents = fetchDiscoveryEvents as jest.Mock;
const mockFetchCategories = fetchCategories as jest.Mock;
const mockFetchAdminAnalytics = fetchAdminAnalytics as jest.Mock;
const mockFetchMyRegistrations = fetchMyRegistrations as jest.Mock;

const mockEvents = [
  {
    id: 'evt-1',
    title: 'Workshop Alpha',
    description: 'A test event',
    date_time: '2026-04-15T10:00:00Z',
    location: 'Room 101',
    capacity: 30,
    registrations_count: 10,
    organizer_id: 'org-1',
    status: 'approved',
    created_at: '2026-04-01T00:00:00Z',
    submitted_at: null,
    categories: ['Workshop'],
    organizer: {
      id: 2,
      display_name: 'Campus Events Team',
      role: 'organizer',
    },
    is_registered: false,
  },
];

const mockRegistrations = [
  {
    ...mockEvents[0],
    title: 'Registered Workshop Alpha',
    is_registered: true,
    registered_at: '2026-04-10T09:00:00Z',
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Workshops', description: 'Hands-on sessions' },
  { id: 'cat-2', name: 'Career', description: 'Career events' },
];

describe('DiscoveryFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetchDiscoveryEvents.mockResolvedValue(mockEvents);
    mockFetchCategories.mockResolvedValue(mockCategories);
    mockFetchAdminAnalytics.mockResolvedValue({
      total_events: 4,
      approved_events: 3,
      pending_events: 1,
      rejected_events: 0,
      total_registrations: 28,
      total_users: 6,
      student_users: 4,
      organizer_users: 1,
      admin_users: 1,
    });
    mockFetchMyRegistrations.mockResolvedValue(mockRegistrations);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the header title and avatar initial', async () => {
    render(<DiscoveryFeedScreen />);
    await waitFor(() => {
      expect(screen.getByText('Discovery Feed')).toBeTruthy();
      expect(screen.getByText('A')).toBeTruthy();
    });
  });

  it('renders categories from the backend', async () => {
    render(<DiscoveryFeedScreen />);
    await waitFor(() => {
      expect(screen.getByText('Browse Categories')).toBeTruthy();
    });

    const tiles = screen.getAllByTestId('category-tile');
    expect(tiles).toHaveLength(2);
    expect(screen.getByText('Workshops')).toBeTruthy();
    expect(screen.getByText('Career')).toBeTruthy();
  });

  it('renders featured event cards from the backend', async () => {
    render(<DiscoveryFeedScreen />);
    await waitFor(() => {
      expect(screen.getByText('Workshop Alpha')).toBeTruthy();
    });
  });

  it('renders recent registrations from the backend', async () => {
    render(<DiscoveryFeedScreen />);
    await waitFor(() => {
      expect(screen.getByText('Your Registrations')).toBeTruthy();
      expect(screen.getByText('Registered Workshop Alpha')).toBeTruthy();
    });
  });

  it('shows empty state when no events are available', async () => {
    mockFetchDiscoveryEvents.mockResolvedValueOnce([]);
    render(<DiscoveryFeedScreen />);
    await waitFor(() => {
      expect(screen.getByText('No events yet')).toBeTruthy();
    });
  });

  it('shows a fetch error when event loading fails', async () => {
    mockFetchDiscoveryEvents.mockRejectedValueOnce(new Error('Network error'));
    render(<DiscoveryFeedScreen />);
    await waitFor(() => {
      expect(
        screen.getByText('Failed to load discovery data. Pull down to retry.'),
      ).toBeTruthy();
    });
  });
});
