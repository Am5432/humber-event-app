import React from "react";
import { Redirect } from "expo-router";

import { useAuth } from "../../src/context/AuthContext";
import { OrganizerEventEditor } from "../../src/components/OrganizerEventEditor";

export default function CreateOrganizerEventScreen() {
    const { user } = useAuth();
    const canManageEvents = user?.role === "organizer" || user?.role === "admin";

    if (!canManageEvents) {
        return <Redirect href="/(tabs)/profile" />;
    }

    return <OrganizerEventEditor mode="create" />;
}
