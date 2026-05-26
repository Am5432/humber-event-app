import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockFetchDiscoveryEvent = jest.fn();
const mockUseAuth = jest.fn();
const mockResolveApiBaseUrl = jest.fn(() => 'https://api.example.com');

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ eventId: 'evt-1' }),
}));

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
  fetchDiscoveryEvent: (...args: unknown[]) => mockFetchDiscoveryEvent(...args),
  registerForEvent: jest.fn(),
  deregisterFromEvent: jest.fn(),
}));

jest.mock('../../src/lib/eventPresentation', () => ({
  formatEventDate: (value: string) => value,
  formatEventDateTime: (value: string) => value,
  getEventHeroImage: (event: { gallery_images?: Array<{ display_url: string }> }) =>
    event.gallery_images?.[0]?.display_url ?? null,
  hasEventGallery: (event: { gallery_images?: Array<unknown> }) =>
    (event.gallery_images?.length ?? 0) > 0,
}));

jest.mock('../../src/lib/registrationEvents', () => ({
  emitRegistrationUpdated: jest.fn(),
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    surface: '#f9f9fd',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f3f3f7',
    surfaceContainerHigh: '#e8e8ec',
    onSurface: '#1a1c1f',
    onSurfaceVariant: '#42474e',
    secondary: '#006a6a',
    onPrimary: '#ffffff',
    error: '#ba1a1a',
    primaryFixed: '#d2e4ff',
    primary: '#001f3b',
  },
}));

jest.mock('../../src/theme/typography', () => ({
  fontFamilies: {
    headline: 'PlusJakartaSans_700Bold',
    body: 'Manrope_400Regular',
    label: 'Manrope_700Bold',
  },
  fontSizes: {
    h2: 24,
    h3: 20,
    bodyLg: 16,
    bodySm: 14,
    labelLg: 12,
  },
  borderRadius: {
    full: 9999,
    xxl: 24,
  },
}));

import EventDetailScreen from '../../app/events/[eventId]';

const baseEvent = {
  id: 'evt-1',
  title: 'Career Fair',
  description: 'Meet employers',
  date_time: '2026-04-15T10:00:00Z',
  location: 'North Campus',
  capacity: 40,
  registrations_count: 12,
  organizer_id: '5',
  status: 'approved',
  created_at: '2026-04-01T00:00:00Z',
  submitted_at: null,
  categories: ['Career'],
  organizer: {
    id: 5,
    display_name: 'Career Services',
    role: 'organizer',
  },
  is_registered: false,
  cover_image: {
    id: 'img-hero',
    thumbnail_url: '/media/events/evt-1/img-hero/thumbnail.jpg',
    width: 320,
    height: 180,
  },
  gallery_images: [
    {
      id: 'img-hero',
      position: 0,
      original_url: '/media/events/evt-1/img-hero/original.jpg',
      display_url: '/media/events/evt-1/img-hero/display.jpg',
      thumbnail_url: '/media/events/evt-1/img-hero/thumbnail.jpg',
      width: 1280,
      height: 720,
    },
    {
      id: 'img-second',
      position: 1,
      original_url: '/media/events/evt-1/img-second/original.jpg',
      display_url: '/media/events/evt-1/img-second/display.jpg',
      thumbnail_url: '/media/events/evt-1/img-second/thumbnail.jpg',
      width: 1280,
      height: 720,
    },
  ],
};

describe('EventDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchDiscoveryEvent.mockResolvedValue(baseEvent);
    mockResolveApiBaseUrl.mockReturnValue('https://api.example.com');
  });

  it('shows Edit Event for organizer/admin owners', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 5, role: 'organizer' },
      token: 'detail-token',
    });

    render(<EventDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit Event')).toBeTruthy();
    });

    const heroImage = screen.getByTestId('event-detail-hero-image');
    expect(heroImage.props.source).toEqual({
      uri: 'https://api.example.com/media/events/evt-1/img-hero/display.jpg',
      headers: {
        Authorization: 'Bearer detail-token',
      },
    });

    fireEvent.press(screen.getByTestId('event-detail-gallery-thumb-img-second'));

    await waitFor(() => {
      expect(screen.getByTestId('event-detail-hero-image').props.source.uri).toBe(
        'https://api.example.com/media/events/evt-1/img-second/display.jpg',
      );
    });
  });

  it('hides Edit Event for non-owner organizers and students', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 8, role: 'organizer' },
      token: 'detail-token',
    });

    render(<EventDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Career Fair')).toBeTruthy();
    });

    expect(screen.queryByText('Edit Event')).toBeNull();
  });

  it('keeps the placeholder state when the event has no gallery images', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, role: 'student' },
      token: 'detail-token',
    });
    mockFetchDiscoveryEvent.mockResolvedValue({
      ...baseEvent,
      cover_image: null,
      gallery_images: [],
    });

    render(<EventDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Career Fair')).toBeTruthy();
    });

    expect(screen.queryByTestId('event-detail-hero-image')).toBeNull();
    expect(screen.queryByTestId('event-detail-gallery-thumb-img-second')).toBeNull();
  });
});
