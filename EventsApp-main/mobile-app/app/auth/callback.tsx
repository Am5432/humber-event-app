import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { fireAndForgetAuthDebugLog } from '../../src/lib/authDebugLog';
import { colors } from '../../src/theme/colors';
import { fontFamilies, fontSizes } from '../../src/theme/typography';

const PENDING_VERIFIER_KEY = 'heh.oauth.code_verifier';
const PENDING_REDIRECT_KEY = 'heh.oauth.redirect_uri';

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readValueFromUrl(url: string, key: string): string | undefined {
  try {
    const parsedUrl = new URL(url);
    const queryValue = parsedUrl.searchParams.get(key);
    if (queryValue) {
      return queryValue;
    }

    const fragment = parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash;
    if (!fragment) {
      return undefined;
    }

    return new URLSearchParams(fragment).get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const callbackUrl = Linking.useURL();
  const { signInWithMicrosoft } = useAuth();
  const [message, setMessage] = useState('Completing Microsoft sign in...');

  useEffect(() => {
    let active = true;

    const finishSignIn = async () => {
      const initialUrl = await Linking.getInitialURL();
      const codeParam =
        firstParam(params.code) ??
        (callbackUrl ? readValueFromUrl(callbackUrl, 'code') : undefined) ??
        (initialUrl ? readValueFromUrl(initialUrl, 'code') : undefined);
      const errorParam =
        firstParam(params.error) ??
        (callbackUrl ? readValueFromUrl(callbackUrl, 'error') : undefined) ??
        (initialUrl ? readValueFromUrl(initialUrl, 'error') : undefined);

      fireAndForgetAuthDebugLog('callback', 'screen.entered', {
        has_code: Boolean(codeParam),
        has_error: Boolean(errorParam),
        callback_url: callbackUrl ?? null,
        initial_url: initialUrl ?? null,
      });

      if (!codeParam && !errorParam && !callbackUrl && !initialUrl) {
        fireAndForgetAuthDebugLog('callback', 'waiting_for_callback_url');
        return;
      }

      if (errorParam) {
        fireAndForgetAuthDebugLog('callback', 'provider_returned_error', {
          error: errorParam,
        });
        if (active) {
          setMessage('Microsoft sign in was canceled or failed.');
        }
        return;
      }

      if (!codeParam) {
        fireAndForgetAuthDebugLog('callback', 'missing_code');
        if (active) {
          setMessage('Missing Microsoft authorization code.');
        }
        return;
      }

      const codeVerifier = await SecureStore.getItemAsync(PENDING_VERIFIER_KEY);
      const redirectUri = await SecureStore.getItemAsync(PENDING_REDIRECT_KEY);

      if (!codeVerifier || !redirectUri) {
        fireAndForgetAuthDebugLog('callback', 'missing_pending_session', {
          has_verifier: Boolean(codeVerifier),
          has_redirect_uri: Boolean(redirectUri),
        });
        if (active) {
          setMessage('Missing Microsoft sign-in session. Please try again.');
        }
        return;
      }

      // Delete keys before the API call so a StrictMode remount or any
      // retry finds them gone and bails out — preventing double code exchange.
      await SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY);
      await SecureStore.deleteItemAsync(PENDING_REDIRECT_KEY);

      try {
        fireAndForgetAuthDebugLog('callback', 'backend_exchange.start', {
          redirect_uri: redirectUri,
          verifier_length: codeVerifier.length,
        });
        await signInWithMicrosoft(codeParam, redirectUri, codeVerifier);
        fireAndForgetAuthDebugLog('callback', 'backend_exchange.success');
        router.replace('/(tabs)');
      } catch (error) {
        fireAndForgetAuthDebugLog('callback', 'backend_exchange.failed', {
          error,
        });
        if (active) {
          const nextMessage =
            error instanceof Error ? error.message : 'Microsoft sign in failed. Please try again.';
          setMessage(nextMessage);
        }
      }
    };

    void finishSignIn();

    return () => {
      active = false;
    };
  }, [callbackUrl, params.code, params.error, router, signInWithMicrosoft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  message: {
    marginTop: 16,
    color: colors.onSurface,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
