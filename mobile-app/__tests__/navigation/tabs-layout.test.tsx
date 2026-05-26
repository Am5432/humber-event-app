import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const recordedScreens: Array<{ name: string; options?: { title?: string; href?: string | null } }> = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  const Tabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Tabs.Screen = ({ name, options }: { name: string; options?: { title?: string; href?: string | null } }) => {
    recordedScreens.push({ name, options });
    if (options?.href === null) {
      return null;
    }
    return <Text>{options?.title ?? name}</Text>;
  };

  return { Tabs };
});

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../src/theme/colors', () => ({
  colors: {
    primary: '#001f3b',
    onSurfaceVariant: '#42474e',
    surfaceContainerLowest: '#ffffff',
  },
}));

import TabsLayout from '../../app/(tabs)/_layout';

describe('TabsLayout', () => {
  beforeEach(() => {
    recordedScreens.length = 0;
    jest.clearAllMocks();
  });

  it('shows Manage for organizer users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'organizer' },
    });

    render(<TabsLayout />);

    expect(screen.getByText('Manage')).toBeTruthy();
    expect(recordedScreens.map((screenDef) => screenDef.name)).toEqual([
      'index',
      'events',
      'manage',
      'admin',
      'approvals',
      'users',
      'profile',
    ]);
    expect(recordedScreens.find((screenDef) => screenDef.name === 'admin')?.options?.href).toBeNull();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'approvals')?.options?.href).toBeNull();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'users')?.options?.href).toBeNull();
  });

  it('shows Manage, Admin, Approvals, and Users for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, role: 'admin' },
    });

    render(<TabsLayout />);

    expect(screen.getByText('Manage')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('Approvals')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(recordedScreens.map((screenDef) => screenDef.name)).toEqual([
      'index',
      'events',
      'manage',
      'admin',
      'approvals',
      'users',
      'profile',
    ]);
    expect(recordedScreens.find((screenDef) => screenDef.name === 'admin')?.options?.href).toBeUndefined();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'approvals')?.options?.href).toBeUndefined();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'users')?.options?.href).toBeUndefined();
  });

  it('hides Manage and admin tools for students', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, role: 'student' },
    });

    render(<TabsLayout />);

    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.queryByText('Approvals')).toBeNull();
    expect(screen.queryByText('Users')).toBeNull();
    expect(recordedScreens.map((screenDef) => screenDef.name)).toEqual([
      'index',
      'events',
      'manage',
      'admin',
      'approvals',
      'users',
      'profile',
    ]);
    expect(recordedScreens.find((screenDef) => screenDef.name === 'manage')?.options?.href).toBeNull();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'admin')?.options?.href).toBeNull();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'approvals')?.options?.href).toBeNull();
    expect(recordedScreens.find((screenDef) => screenDef.name === 'users')?.options?.href).toBeNull();
  });
});
