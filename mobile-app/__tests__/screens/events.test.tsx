/**
 * Tests for app/(tabs)/events.tsx
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/lib/events', () => ({
  fetchDiscoveryEvents: jest.fn(),
  fetchCategories: jest.fn(),
}));

jest.mock('../../src/lib/eventPresentation', () => ({
  getCategoryPresentation: () => ({
    icon: 'calendar-star',
    bgColor: '#006a6a',
  }),
}));

jest.mock('../../src/components/EventCard', () => ({
  EventCard: ({ event }: { event: { title: string } }) => {
    const { Text } = require('react-native');
    return <Text testID="event-card">{event.title}</Text>;
  },
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    surface: '#f9f9fd',
    surfaceContainerLowest: '#ffffff',
    onSurface: '#1a1c1f',
    onSurfaceVariant: '#42474e',
    secondary: '#006a6a',
    onPrimary: '#ffffff',
    outlineVariant: '#c2c7d0',
    primary: '#001f3b',
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

import EventsScreen from '../../app/(tabs)/events';
import {
  fetchCategories,
  fetchDiscoveryEvents,
} from '../../src/lib/events';

const mockFetchDiscoveryEvents = fetchDiscoveryEvents as jest.Mock;
const mockFetchCategories = fetchCategories as jest.Mock;

const mockEvents = [
  {
    id: 'evt-1',
    title: 'Career Fair',
    description: 'Meet employers',
    date_time: '2026-04-15T10:00:00Z',
    location: 'North Campus',
    capacity: 40,
    registrations_count: 12,
    organizer_id: 'org-1',
    status: 'approved',
    created_at: '2026-04-01T00:00:00Z',
    submitted_at: null,
    categories: ['Career'],
    organizer: {
      id: 3,
      display_name: 'Career Services',
      role: 'organizer',
    },
    is_registered: false,
  },
  {
    id: 'evt-2',
    title: 'STEM Workshop',
    description: 'Hands-on learning',
    date_time: '2026-04-16T15:00:00Z',
    location: 'Innovation Lab',
    capacity: 25,
    registrations_count: 8,
    organizer_id: 'org-2',
    status: 'approved',
    created_at: '2026-04-02T00:00:00Z',
    submitted_at: null,
    categories: ['Workshop'],
    organizer: {
      id: 4,
      display_name: 'STEM Centre',
      role: 'organizer',
    },
    is_registered: false,
  },
  {
    id: 'evt-3',
    title: 'Career Workshop Expo',
    description: 'Career prep and skills',
    date_time: '2026-04-17T17:00:00Z',
    location: 'Main Hall',
    capacity: 60,
    registrations_count: 21,
    organizer_id: 'org-3',
    status: 'approved',
    created_at: '2026-04-03T00:00:00Z',
    submitted_at: null,
    categories: ['Career', 'Workshop'],
    organizer: {
      id: 5,
      display_name: 'Student Success',
      role: 'organizer',
    },
    is_registered: false,
  },
  {
    id: 'evt-4',
    title: 'Campus Mixer',
    description: 'Connect with peers',
    date_time: '2026-04-18T18:00:00Z',
    location: 'Student Centre',
    capacity: 80,
    registrations_count: 34,
    organizer_id: 'org-4',
    status: 'approved',
    created_at: '2026-04-04T00:00:00Z',
    submitted_at: null,
    categories: ['Social'],
    organizer: {
      id: 6,
      display_name: 'Campus Life',
      role: 'organizer',
    },
    is_registered: false,
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Career', description: 'Career events' },
  { id: 'cat-2', name: 'Workshop', description: 'Hands-on sessions' },
  { id: 'cat-3', name: 'Social', description: 'Community events' },
  { id: 'cat-4', name: 'Wellness', description: 'Wellness events' },
];

describe('EventsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchDiscoveryEvents.mockResolvedValue(mockEvents);
    mockFetchCategories.mockResolvedValue(mockCategories);
  });

  it('renders category chips from the backend and the approved event list', async () => {
    render(<EventsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeTruthy();
      expect(screen.getByText('Career')).toBeTruthy();
      expect(screen.getByText('Workshop')).toBeTruthy();
      expect(screen.getByText('Social')).toBeTruthy();
      expect(screen.getByText('Wellness')).toBeTruthy();
      expect(screen.getAllByTestId('event-card')).toHaveLength(4);
    });
  });

  it('filters in place with multi-select chips and resets with Clear Filters', async () => {
    render(<EventsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Career Fair')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('category-chip-cat-1'));

    await waitFor(() => {
      expect(screen.getByText('Career Fair')).toBeTruthy();
      expect(screen.getByText('Career Workshop Expo')).toBeTruthy();
      expect(screen.queryByText('STEM Workshop')).toBeNull();
      expect(screen.queryByText('Campus Mixer')).toBeNull();
      expect(screen.getByText('Clear Filters')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('category-chip-cat-2'));

    await waitFor(() => {
      expect(screen.getByText('Career Fair')).toBeTruthy();
      expect(screen.getByText('STEM Workshop')).toBeTruthy();
      expect(screen.getByText('Career Workshop Expo')).toBeTruthy();
      expect(screen.queryByText('Campus Mixer')).toBeNull();
    });

    fireEvent.press(screen.getByText('Clear Filters'));

    await waitFor(() => {
      expect(screen.getAllByTestId('event-card')).toHaveLength(4);
      expect(screen.queryByText('Clear Filters')).toBeNull();
      expect(screen.getByText('Campus Mixer')).toBeTruthy();
    });
  });

  it('renders the filter-empty copy when chips remove every event', async () => {
    render(<EventsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('category-chip-cat-4'));

    await waitFor(() => {
      expect(screen.getByText('No events match these filters')).toBeTruthy();
      expect(
        screen.getByText(
          'Clear one or more filters or change your search. Pull down to refresh if you expected new events.',
        ),
      ).toBeTruthy();
    });
  });

  it('renders the load-error copy when data loading fails', async () => {
    mockFetchDiscoveryEvents.mockRejectedValueOnce(new Error('Network error'));

    render(<EventsScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't load the latest data. Pull down to retry or tap Try again.",
        ),
      ).toBeTruthy();
    });
  });
});
