import React from "react";
import { render, screen } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockResolveApiBaseUrl = jest.fn(() => "https://api.example.com");

jest.mock("../../src/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../src/lib/api", () => ({
  resolveApiBaseUrl: () => mockResolveApiBaseUrl(),
}));

import { AuthenticatedEventImage } from "../../src/components/AuthenticatedEventImage";
import {
  getEventHeroImage,
  hasEventGallery,
} from "../../src/lib/eventPresentation";

describe("AuthenticatedEventImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: "mobile-token",
    });
  });

  it("adds the bearer token when rendering a protected image", () => {
    render(
      <AuthenticatedEventImage
        uri="/media/events/event-1/image-1/thumbnail.jpg"
        testID="protected-image"
      />,
    );

    const image = screen.getByTestId("protected-image");
    expect(image.props.source).toEqual({
      uri: "https://api.example.com/media/events/event-1/image-1/thumbnail.jpg",
      headers: {
        Authorization: "Bearer mobile-token",
      },
    });
  });

  it("renders nothing when the uri is missing", () => {
    render(<AuthenticatedEventImage uri={null} testID="missing-image" />);

    expect(screen.queryByTestId("missing-image")).toBeNull();
  });

  it("keeps absolute urls intact while resolving relative media routes", () => {
    render(
      <AuthenticatedEventImage
        uri="https://cdn.example.com/event.jpg"
        testID="absolute-image"
      />,
    );

    const image = screen.getByTestId("absolute-image");
    expect(image.props.source.uri).toBe("https://cdn.example.com/event.jpg");
  });

  it("handles missing gallery data safely in the presentation helpers", () => {
    expect(getEventHeroImage({ gallery_images: undefined })).toBeNull();
    expect(hasEventGallery({ gallery_images: undefined })).toBe(false);
  });
});
