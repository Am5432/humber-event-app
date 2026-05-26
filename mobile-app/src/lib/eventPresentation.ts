import type { ComponentProps } from "react";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors } from "../theme/colors";


type CategoryIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type CategoryPresentation = {
    icon: CategoryIconName;
    bgColor: string;
};

const CATEGORY_COLORS = [
    colors.secondary,
    colors.primaryContainer,
    colors.tertiaryContainer,
    colors.onSecondaryContainer,
];

const CATEGORY_ICON_RULES: Array<{ terms: string[]; icon: CategoryIconName }> = [
    { terms: ["academic", "study", "learning"], icon: "school-outline" },
    { terms: ["career", "job", "network"], icon: "briefcase-outline" },
    { terms: ["club", "community", "student"], icon: "star-outline" },
    { terms: ["social", "mixer", "party"], icon: "account-group-outline" },
    { terms: ["sport", "fitness", "game"], icon: "basketball" },
    { terms: ["music", "art", "culture"], icon: "music-note-outline" },
    { terms: ["tech", "coding", "workshop"], icon: "hammer-wrench" },
];


export function formatEventDate(value: string): string {
    try {
        return new Date(value).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return value;
    }
}


export function formatEventDateTime(value: string): string {
    try {
        return new Date(value).toLocaleString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

export function getDiscoveryEventCoverThumbnail(event: {
    cover_image?: { thumbnail_url: string } | null;
}): string | null {
    return event.cover_image?.thumbnail_url ?? null;
}

export function getOrganizerEventCoverThumbnail(event: {
    images: Array<{ thumbnail_url: string }>;
}): string | null {
    return event.images[0]?.thumbnail_url ?? null;
}

export function getEventHeroImage(event: {
    gallery_images?: Array<{ display_url: string }> | undefined;
}): string | null {
    return event.gallery_images?.[0]?.display_url ?? null;
}

export function hasEventGallery(event: {
    gallery_images?: Array<unknown> | undefined;
}): boolean {
    return (event.gallery_images?.length ?? 0) > 0;
}


export function getCategoryPresentation(
    categoryName: string,
    index: number = 0,
): CategoryPresentation {
    const normalizedName = categoryName.toLowerCase();
    const match = CATEGORY_ICON_RULES.find(({ terms }) =>
        terms.some((term) => normalizedName.includes(term)),
    );

    return {
        icon: match?.icon ?? "calendar-star",
        bgColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    };
}
