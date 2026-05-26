import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

import { useAuth } from "../../src/context/AuthContext";
import { OrganizerEventEditor } from "../../src/components/OrganizerEventEditor";

export default function EditOrganizerEventScreen() {
    const { user } = useAuth();
    const params = useLocalSearchParams<{ eventId: string }>();
    const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
    const canManageEvents = user?.role === "organizer" || user?.role === "admin";

    if (!canManageEvents) {
        return <Redirect href="/(tabs)/profile" />;
    }

    return <OrganizerEventEditor mode="edit" eventId={eventId} />;
}
