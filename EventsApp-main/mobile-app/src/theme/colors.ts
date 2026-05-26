export const colors = {
  primary: '#001f3b',
  primaryContainer: '#00355e',
  secondary: '#006a6a',
  secondaryContainer: '#90efef',
  onSecondaryContainer: '#006e6e',
  surface: '#f9f9fd',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f3f7',
  surfaceContainer: '#eeedf1',
  surfaceContainerHigh: '#e8e8ec',
  onSurface: '#1a1c1f',
  onSurfaceVariant: '#42474e',
  outlineVariant: '#c2c7d0',
  onPrimary: '#ffffff',
  error: '#ba1a1a',
  tertiaryContainer: '#463000',
  tertiaryFixedDim: '#ffba20',
  primaryFixed: '#d2e4ff',
  primaryFixedDim: '#a3c9fb',
} as const;

export type ColorKey = keyof typeof colors;
