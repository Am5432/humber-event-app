process.env.EXPO_PUBLIC_API_URL = "https://api.example.com";

import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

jest.mock("expo-image-picker");
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

jest.mock("../../src/lib/events", () => {
  const actual = jest.requireActual("../../src/lib/events");
  return {
    ...actual,
    fetchCategories: jest.fn(),
    fetchOrganizerEvent: jest.fn(),
    createOrganizerEvent: jest.fn(),
    updateOrganizerEvent: jest.fn(),
  };
});

import * as ImagePicker from "expo-image-picker";
import type { OrganizerEvent, OrganizerEventInput } from "../../src/types/events";

const { stripJsonContentTypeForFormData } = require("../../src/lib/api");
const {
  buildOrganizerEventFormData,
  createOrganizerEvent,
  fetchCategories,
  fetchOrganizerEvent,
  updateOrganizerEvent,
} = require("../../src/lib/events");
const { OrganizerEventEditor } = require("../../src/components/OrganizerEventEditor");

const mockFetchCategories = fetchCategories as jest.MockedFunction<typeof fetchCategories>;
const mockFetchOrganizerEvent = fetchOrganizerEvent as jest.MockedFunction<typeof fetchOrganizerEvent>;
const mockCreateOrganizerEvent = createOrganizerEvent as jest.MockedFunction<typeof createOrganizerEvent>;
const mockUpdateOrganizerEvent = updateOrganizerEvent as jest.MockedFunction<typeof updateOrganizerEvent>;
const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.Mock;

class MockFormData {
  private readonly values = new Map<string, unknown[]>();

  append(key: string, value: unknown) {
    const current = this.values.get(key) ?? [];
    current.push(value);
    this.values.set(key, current);
  }

  get(key: string) {
    return this.values.get(key)?.[0] ?? null;
  }

  getAll(key: string) {
    return this.values.get(key) ?? [];
  }
}

const baseEvent: OrganizerEvent = {
  id: "evt-1",
  title: "Career Fair",
  description: "Meet employers",
  date_time: "2026-05-15T18:00:00.000Z",
  location: "North Campus",
  capacity: 40,
  organizer_id: "5",
  status: "draft",
  created_at: "2026-04-01T00:00:00Z",
  submitted_at: null,
  rejection_reason: null,
  categories: ["Career"],
  images: [
    {
      id: "img-cover",
      position: 0,
      original_url: "/media/events/evt-1/img-cover/original.jpg",
      display_url: "/media/events/evt-1/img-cover/display.jpg",
      thumbnail_url: "/media/events/evt-1/img-cover/thumbnail.jpg",
      width: 1280,
      height: 720,
    },
    {
      id: "img-gallery",
      position: 1,
      original_url: "/media/events/evt-1/img-gallery/original.jpg",
      display_url: "/media/events/evt-1/img-gallery/display.jpg",
      thumbnail_url: "/media/events/evt-1/img-gallery/thumbnail.jpg",
      width: 1280,
      height: 720,
    },
  ],
};

describe("OrganizerEventEditor", () => {
  const originalFormData = global.FormData;
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

  beforeEach(() => {
    jest.clearAllMocks();
    global.FormData = MockFormData as unknown as typeof FormData;
    mockFetchCategories.mockResolvedValue([
      { id: "career", name: "Career", description: null },
      { id: "social", name: "Social", description: null },
    ]);
    mockFetchOrganizerEvent.mockResolvedValue(baseEvent);
    mockCreateOrganizerEvent.mockResolvedValue(baseEvent);
    mockUpdateOrganizerEvent.mockResolvedValue(baseEvent);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });
  });

  afterAll(() => {
    global.FormData = originalFormData;
    alertSpy.mockRestore();
  });

  it("builds ordered multipart data and removes the forced json header for FormData", () => {
    const payload: OrganizerEventInput = {
      title: "Career Fair",
      description: "Meet employers",
      date_time: "2026-05-15T18:00:00.000Z",
      location: "North Campus",
      capacity: 40,
      category_ids: ["career", "social"],
      images: [
        {
          client_id: "existing-img-cover",
          source: "existing",
          existing_image_id: "img-cover",
          uri: "/media/events/evt-1/img-cover/display.jpg",
          file_name: "img-cover",
          mime_type: "image/jpeg",
          display_url: "/media/events/evt-1/img-cover/display.jpg",
          thumbnail_url: "/media/events/evt-1/img-cover/thumbnail.jpg",
        },
        {
          client_id: "organizer-image-1",
          source: "upload",
          existing_image_id: null,
          uri: "file:///new-upload.jpg",
          file_name: "new-upload.jpg",
          mime_type: "image/jpeg",
          display_url: null,
          thumbnail_url: null,
        },
      ],
    };

    const formData = buildOrganizerEventFormData(payload) as unknown as MockFormData;
    expect(formData.get("image_manifest_json")).toBe(
      JSON.stringify([
        { position: 0, source: "existing", id: "img-cover" },
        { position: 1, source: "upload", client_id: "organizer-image-1" },
      ]),
    );
    expect(formData.getAll("category_ids")).toEqual(["career", "social"]);
    expect(formData.getAll("image_file_client_ids")).toEqual(["organizer-image-1"]);
    expect(formData.getAll("image_files")).toEqual([
      {
        uri: "file:///new-upload.jpg",
        name: "new-upload.jpg",
        type: "image/jpeg",
      },
    ]);

    const config = stripJsonContentTypeForFormData({
      data: buildOrganizerEventFormData(payload),
      headers: {
        "Content-Type": "application/json",
      },
    } as never);

    expect(config.headers["Content-Type"]).toBeUndefined();
  });

  it("renders a safe empty organizer editor state", async () => {
    mockFetchCategories.mockResolvedValue([]);

    render(<OrganizerEventEditor mode="create" />);

    await waitFor(() => {
      expect(screen.getByText("Create Event")).toBeTruthy();
    });

    expect(screen.getByText("Event images")).toBeTruthy();
    expect(screen.getAllByText("No event images yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("Images must be JPEG, PNG, or WebP files under 8 MB.")).toBeTruthy();
    expect(screen.getByText("Choose Date")).toBeTruthy();
    expect(screen.getByText("Choose Time")).toBeTruthy();
  });

  it("uses picker controls instead of manual date entry", async () => {
    render(<OrganizerEventEditor mode="edit" eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Edit Event")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("event-date-trigger"));

    const datePicker = screen.getByTestId("event-date-picker");
    fireEvent(datePicker, "onChange", { type: "set" }, new Date("2026-05-20T18:00:00.000Z"));

    fireEvent.press(screen.getByTestId("event-time-trigger"));

    const timePicker = screen.getByTestId("event-time-picker");
    fireEvent(timePicker, "onChange", { type: "set" }, new Date("2026-05-20T19:30:00.000Z"));

    await waitFor(() => {
      expect(screen.getByText(/2026/)).toBeTruthy();
    });
  });

  it("preloads existing images, updates cover order, and submits the final image array", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///gallery-upload.png",
          fileName: "gallery-upload.png",
          mimeType: "image/png",
        },
      ],
    });

    render(<OrganizerEventEditor mode="edit" eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Edit Event")).toBeTruthy();
      expect(screen.getByText("img-cover (cover)")).toBeTruthy();
    });

    expect(screen.getByTestId("cover-preview-filename").props.children).toBe("img-cover");

    fireEvent.press(screen.getByText("Add Images"));

    await waitFor(() => {
      expect(screen.getByText("gallery-upload.png")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("move-right-existing-img-cover"));

    await waitFor(() => {
      expect(screen.getByTestId("cover-preview-filename").props.children).toBe("img-gallery");
    });

    fireEvent.press(screen.getByTestId("remove-image-existing-img-cover"));

    await waitFor(() => {
      expect(screen.queryByText("img-cover (cover)")).toBeNull();
    });

    fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateOrganizerEvent).toHaveBeenCalled();
    });

    const submittedPayload = mockUpdateOrganizerEvent.mock.calls[0][1] as OrganizerEventInput;
    expect(submittedPayload.images.map((image) => image.client_id)).toEqual([
      "existing-img-gallery",
      "organizer-image-1",
    ]);
    expect(submittedPayload.date_time).toBe(baseEvent.date_time);
    expect(alertSpy).toHaveBeenCalledWith("Saved", "Your organizer event was updated.");
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows the limit error when a picker result would exceed ten images", async () => {
    const existingImages = Array.from({ length: 10 }, (_, index) => ({
      id: `img-${index + 1}`,
      position: index,
      original_url: `/media/events/evt-1/img-${index + 1}/original.jpg`,
      display_url: `/media/events/evt-1/img-${index + 1}/display.jpg`,
      thumbnail_url: `/media/events/evt-1/img-${index + 1}/thumbnail.jpg`,
      width: 1280,
      height: 720,
    }));
    mockFetchOrganizerEvent.mockResolvedValue({
      ...baseEvent,
      images: existingImages,
    });

    render(<OrganizerEventEditor mode="edit" eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Edit Event")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Add Images"));

    await waitFor(() => {
      expect(screen.getByText("You can upload up to 10 images.")).toBeTruthy();
    });
  });
});
