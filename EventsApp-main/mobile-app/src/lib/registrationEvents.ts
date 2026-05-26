import type { DiscoveryEvent } from '../types/events';

type RegistrationListener = (event: DiscoveryEvent) => void;

const listeners = new Set<RegistrationListener>();

export function emitRegistrationUpdated(event: DiscoveryEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeToRegistrationUpdates(
  listener: RegistrationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitRegistrationCreated(event: DiscoveryEvent): void {
  emitRegistrationUpdated(event);
}

export function emitRegistrationRemoved(event: DiscoveryEvent): void {
  emitRegistrationUpdated(event);
}

export function subscribeToRegistrationCreated(
  listener: RegistrationListener,
): () => void {
  return subscribeToRegistrationUpdates(listener);
}
