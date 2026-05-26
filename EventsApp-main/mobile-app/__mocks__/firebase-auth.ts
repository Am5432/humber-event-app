// Centralized firebase/auth mock for auth-focused Jest tests.
export const signInWithEmailAndPassword = jest.fn();
export const createUserWithEmailAndPassword = jest.fn();
export const signOut = jest.fn();
export const onIdTokenChanged = jest.fn();
export const updateProfile = jest.fn();
export const signInWithCredential = jest.fn();
export const getReactNativePersistence = jest.fn().mockReturnValue({ type: 'react-native-persistence' });
export const initializeAuth = jest.fn().mockReturnValue({ currentUser: null });

export const OAuthProvider = jest.fn().mockImplementation((providerId: string) => ({
  providerId,
  credential: jest.fn().mockReturnValue({ providerId, type: 'oauth' }),
}));

export const getAuth = jest.fn().mockReturnValue({ currentUser: null });
