import React from "react";
import { Image, type ImageProps } from "react-native";

import { useAuth } from "../context/AuthContext";
import { resolveApiBaseUrl } from "../lib/api";

export interface AuthenticatedEventImageProps extends Omit<ImageProps, "source"> {
  uri?: string | null;
}

function resolveProtectedImageUri(uri: string): string {
  if (!uri.startsWith("/")) {
    return uri;
  }

  try {
    return `${resolveApiBaseUrl()}${uri}`;
  } catch {
    return uri;
  }
}

export function AuthenticatedEventImage({
  uri,
  ...imageProps
}: AuthenticatedEventImageProps) {
  const { token } = useAuth();

  if (!uri) {
    return null;
  }

  return (
    <Image
      {...imageProps}
      source={{
        uri: resolveProtectedImageUri(uri),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }}
    />
  );
}
