export type UserRole = "student" | "organizer" | "admin" | "regular";
export type EventStatus = "draft" | "pending" | "approved" | "rejected" | "completed";

export interface PublicUserSummary {
    id: number;
    display_name: string;
    role: UserRole;
}

export interface PublicUserProfile extends PublicUserSummary {
    created_at: string;
    organized_events_count: number;
    approved_events_count: number;
    registered_events_count: number;
}

export interface EventImageAsset {
    id: string;
    position: number;
    original_url: string;
    display_url: string;
    thumbnail_url: string;
    width: number;
    height: number;
}

export interface EventCoverThumbnail {
    id: string;
    thumbnail_url: string;
    width: number;
    height: number;
}

export interface OrganizerDraftImage {
    client_id: string;
    source: "existing" | "upload";
    existing_image_id: string | null;
    uri: string;
    file_name: string;
    mime_type: string;
    display_url: string | null;
    thumbnail_url: string | null;
}

export interface DiscoveryEvent {
    id: string;
    title: string;
    description: string;
    date_time: string;
    location: string;
    capacity: number;
    registrations_count: number;
    organizer_id: string;
    status: EventStatus;
    created_at: string;
    submitted_at: string | null;
    categories: string[];
    organizer: PublicUserSummary | null;
    is_registered: boolean;
    cover_image?: EventCoverThumbnail | null;
    gallery_images?: EventImageAsset[];
}

export interface EventCategory {
    id: string;
    name: string;
    description: string | null;
}

export interface DiscoveryEventsQuery {
    q?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
    location?: string;
}

export interface AdminAnalyticsSummary {
    total_events: number;
    approved_events: number;
    pending_events: number;
    rejected_events: number;
    total_registrations: number;
    total_users: number;
    student_users: number;
    organizer_users: number;
    admin_users: number;
}

export interface AdminUser {
    id: number;
    email: string;
    display_name: string;
    role: UserRole;
    created_at: string;
}

export interface RegisteredEvent extends DiscoveryEvent {
    registered_at: string;
}

export interface OrganizerEvent {
    id: string;
    title: string;
    description: string;
    date_time: string;
    location: string;
    capacity: number;
    organizer_id: string;
    status: EventStatus;
    created_at: string;
    submitted_at: string | null;
    rejection_reason: string | null;
    categories: string[];
    images: EventImageAsset[];
}

export interface OrganizerEventInput {
    title: string;
    description: string;
    date_time: string;
    location: string;
    capacity: number;
    category_ids: string[];
    images: OrganizerDraftImage[];
}
