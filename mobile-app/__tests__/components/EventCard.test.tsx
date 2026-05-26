/**
 * Tests for src/components/EventCard.tsx
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockResolveApiBaseUrl = jest.fn(() => 'https://api.example.com');

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../src/lib/api', () => ({
  resolveApiBaseUrl: () => mockResolveApiBaseUrl(),
}));

// Mock theme imports
jest.mock('../../src/theme/colors', () => ({
  colors: {
    surfaceContainerLowest: '#ffffff',
    surfaceContainerHigh: '#e8e8ec',
    onSurfaceVariant: '#42474e',
    onSurface: '#1a1c1f',
    primaryFixed: '#d2e4ff',
    primary: '#001f3b',
    secondary: '#006a6a',
    onPrimary: '#ffffff',
  },
}));

jest.mock('../../src/theme/typography', () => ({
  fontFamilies: {
    headlineSemiBold: 'PlusJakartaSans_600SemiBold',
    body: 'Manrope_400Regular',
    label: 'Manrope_700Bold',
  },
  fontSizes: {
    h4: 18,
    bodySm: 14,
    labelLg: 12,
  },
  borderRadius: {
    xl: 16,
    full: 9999,
  },
}));

jest.mock('../../src/lib/eventPresentation', () => ({
  formatEventDate: (value: string) => value,
  getDiscoveryEventCoverThumbnail: (event: { cover_image?: { thumbnail_url: string } | null }) =>
    event.cover_image?.thumbnail_url ?? null,
}));

import { EventCard } from '../../src/components/EventCard';
import type { DiscoveryEvent } from '../../src/types/events';

const mockEvent: DiscoveryEvent = {
  id: 'evt-001',
  title: 'Test Workshop',
  description: 'A test event',
  date_time: '2026-04-15T10:00:00Z',
  location: 'Room 101',
  capacity: 30,
  registrations_count: 12,
  organizer_id: 'org-001',
  status: 'approved',
  created_at: '2026-04-01T00:00:00Z',
  submitted_at: null,
  categories: ['Workshop'],
  organizer: {
    id: 7,
    display_name: 'HEH Organizer',
    role: 'organizer',
  },
  is_registered: false,
};

describe('EventCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'card-token',
    });
  });

  it('renders the event title', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('Test Workshop')).toBeTruthy();
  });

  it('renders the event location', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('Room 101')).toBeTruthy();
  });

  it('renders the Quick Register button', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('View Details')).toBeTruthy();
  });

  it('renders category tags', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('Workshop')).toBeTruthy();
  });

  it('renders registration counts', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('12/30 registered')).toBeTruthy();
  });

  it('renders organizer summary when available', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('By HEH Organizer')).toBeTruthy();
  });

  it('renders the protected cover thumbnail from the discovery cover_image only', () => {
    const eventWithCover = {
      ...mockEvent,
      cover_image: {
        id: 'img-cover',
        thumbnail_url: '/media/events/evt-001/img-cover/thumbnail.jpg',
        width: 320,
        height: 180,
      },
      gallery_images: [
        {
          id: 'img-cover',
          position: 0,
          original_url: '/media/events/evt-001/img-cover/original.jpg',
          display_url: '/media/events/evt-001/img-cover/display.jpg',
          thumbnail_url: '/media/events/evt-001/img-cover/thumbnail.jpg',
          width: 1280,
          height: 720,
        },
      ],
    };

    render(<EventCard event={eventWithCover} />);

    const image = screen.getByTestId('event-card-cover-image-evt-001');
    expect(image.props.source).toEqual({
      uri: 'https://api.example.com/media/events/evt-001/img-cover/thumbnail.jpg',
      headers: {
        Authorization: 'Bearer card-token',
      },
    });
  });

  it('renders without categories gracefully', () => {
    const eventNoCategories = { ...mockEvent, categories: [] };
    render(<EventCard event={eventNoCategories} />);
    expect(screen.getByText('Test Workshop')).toBeTruthy();
  });

  it('keeps the placeholder when the discovery event has no cover image', () => {
    render(<EventCard event={mockEvent} />);

    expect(screen.queryByTestId('event-card-cover-image-evt-001')).toBeNull();
  });
});
