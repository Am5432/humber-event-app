import { apiClient, resolveApiBaseUrl } from "./api";
import { getItem, TOKEN_KEY } from "./secureStore";
import type { CurrentUserResponse } from "../types/AuthContextTypes";
import type {
  AdminAnalyticsSummary,
  AdminUser,
  DiscoveryEvent,
  DiscoveryEventsQuery,
  EventCategory,
  OrganizerDraftImage,
  OrganizerEvent,
  OrganizerEventInput,
  PublicUserProfile,
  RegisteredEvent,
} from "../types/events";

type OrganizerImageManifestItem =
  | {
      position: number;
      source: "existing";
      id: string;
    }
  | {
      position: number;
      source: "upload";
      client_id: string;
    };

function toManifestItem(
  image: OrganizerDraftImage,
  position: number,
): OrganizerImageManifestItem {
  if (image.source === "existing") {
    if (!image.existing_image_id) {
      throw new Error("Existing organizer images require an existing_image_id.");
    }
    return {
      position,
      source: "existing",
      id: image.existing_image_id,
    };
  }

  return {
    position,
    source: "upload",
    client_id: image.client_id,
  };
}

export function buildOrganizerEventFormData(payload: OrganizerEventInput): FormData {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("description", payload.description);
  formData.append("date_time", payload.date_time);
  formData.append("location", payload.location);
  formData.append("capacity", String(payload.capacity));

  payload.category_ids.forEach((categoryId) => {
    formData.append("category_ids", categoryId);
  });

  formData.append(
    "image_manifest_json",
    JSON.stringify(payload.images.map((image, index) => toManifestItem(image, index))),
  );

  payload.images
    .filter((image) => image.source === "upload")
    .forEach((image) => {
      formData.append("image_file_client_ids", image.client_id);
      formData.append(
        "image_files",
        {
          uri: image.uri,
          name: image.file_name,
          type: image.mime_type,
        } as unknown as Blob,
      );
    });

  return formData;
}

function extractErrorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const message = (item as { msg?: unknown }).msg;
        return typeof message === "string" ? message : null;
      })
      .filter((value): value is string => Boolean(value))
      .join(", ");
  }

  return null;
}

async function organizerMultipartRequest<T>(
  method: "POST" | "PATCH",
  path: string,
  payload: OrganizerEventInput,
): Promise<T> {
  const token = await getItem(TOKEN_KEY);
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: buildOrganizerEventFormData(payload),
  });

  const rawBody = await response.text();
  const parsedBody = rawBody ? (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return rawBody;
    }
  })() : null;

  if (!response.ok) {
    const detail =
      extractErrorDetail(parsedBody) ??
      (typeof parsedBody === "string" && parsedBody.trim().length > 0 ? parsedBody : null) ??
      `Request failed with status ${response.status}.`;
    throw new Error(detail);
  }

  return parsedBody as T;
}

export async function fetchDiscoveryEvents(
  params: DiscoveryEventsQuery = {},
): Promise<DiscoveryEvent[]> {
  const { data } = await apiClient.get<DiscoveryEvent[]>("/events", { params });
  return Array.isArray(data) ? data : [];
}

export async function fetchDiscoveryEvent(eventId: string): Promise<DiscoveryEvent> {
  const { data } = await apiClient.get<DiscoveryEvent>(`/events/${eventId}`);
  return data;
}

export async function fetchCategories(): Promise<EventCategory[]> {
  const { data } = await apiClient.get<EventCategory[]>("/categories");
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminAnalytics(): Promise<AdminAnalyticsSummary> {
  const { data } = await apiClient.get<AdminAnalyticsSummary>("/admin/events/analytics");
  return data;
}

export async function fetchAdminUsers(params: {
  q?: string;
  role?: string;
} = {}): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/admin/users", { params });
  return Array.isArray(data) ? data : [];
}

export async function updateAdminUserRole(
  userId: number,
  role: "student" | "organizer" | "admin",
): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${userId}/role`, {
    role,
  });
  return data;
}

export async function fetchAdminPendingEvents(): Promise<OrganizerEvent[]> {
  const { data } = await apiClient.get<OrganizerEvent[]>("/admin/events", {
    params: { status: "pending" },
  });
  return Array.isArray(data) ? data : [];
}

export async function approveAdminEvent(eventId: string): Promise<OrganizerEvent> {
  const { data } = await apiClient.post<OrganizerEvent>(`/admin/events/${eventId}/approve`);
  return data;
}

export async function rejectAdminEvent(
  eventId: string,
  reason: string,
): Promise<OrganizerEvent> {
  const { data } = await apiClient.post<OrganizerEvent>(`/admin/events/${eventId}/reject`, {
    reason,
  });
  return data;
}

export async function registerForEvent(eventId: string): Promise<DiscoveryEvent> {
  const { data } = await apiClient.post<DiscoveryEvent>(`/events/${eventId}/register`);
  return data;
}

export async function deregisterFromEvent(eventId: string): Promise<DiscoveryEvent> {
  const { data } = await apiClient.delete<DiscoveryEvent>(`/events/${eventId}/register`);
  return data;
}

export async function fetchMyRegistrations(limit?: number): Promise<RegisteredEvent[]> {
  const params = limit ? { limit } : undefined;
  const { data } = await apiClient.get<RegisteredEvent[]>("/users/me/registrations", {
    params,
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchPublicUserProfile(userId: number): Promise<PublicUserProfile> {
  const { data } = await apiClient.get<PublicUserProfile>(`/users/${userId}`);
  return data;
}

export async function updateCurrentUserProfile(
  displayName: string,
): Promise<CurrentUserResponse> {
  const { data } = await apiClient.patch<CurrentUserResponse>("/users/me", {
    display_name: displayName,
  });
  return data;
}

export async function fetchOrganizerEvents(status_filter?: string): Promise<OrganizerEvent[]> {
  const params = status_filter ? { status_filter } : undefined;
  const { data } = await apiClient.get<OrganizerEvent[]>("/organizer/events", { params });
  return Array.isArray(data) ? data : [];
}

export async function fetchOrganizerEvent(eventId: string): Promise<OrganizerEvent> {
  const { data } = await apiClient.get<OrganizerEvent>(`/organizer/events/${eventId}`);
  return data;
}

export async function createOrganizerEvent(
  payload: OrganizerEventInput,
): Promise<OrganizerEvent> {
  return organizerMultipartRequest<OrganizerEvent>("POST", "/organizer/events", payload);
}

export async function updateOrganizerEvent(
  eventId: string,
  payload: OrganizerEventInput,
): Promise<OrganizerEvent> {
  return organizerMultipartRequest<OrganizerEvent>(
    "PATCH",
    `/organizer/events/${eventId}`,
    payload,
  );
}
