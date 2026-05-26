import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { resolveApiBaseUrl } from "../lib/api";
import {
  createOrganizerEvent,
  fetchCategories,
  fetchOrganizerEvent,
  updateOrganizerEvent,
} from "../lib/events";
import { colors } from "../theme/colors";
import { borderRadius, fontFamilies, fontSizes } from "../theme/typography";
import type {
  EventCategory,
  EventImageAsset,
  OrganizerDraftImage,
  OrganizerEvent,
  OrganizerEventInput,
} from "../types/events";

interface OrganizerEventEditorProps {
  eventId?: string;
  mode: "create" | "edit";
}

const MAX_EVENT_IMAGES = 10;
const IMAGE_SECTION_TITLE = "Event images";
const IMAGE_SECTION_HELPER = "Add up to 10 images. The first image is your cover.";
const IMAGE_SECTION_EMPTY = "No event images yet.";
const IMAGE_SECTION_PREVIEW = "Cover preview";
const IMAGE_ADD_LABEL = "Add Images";
const IMAGE_MOVE_LEFT = "Move left";
const IMAGE_MOVE_RIGHT = "Move right";
const IMAGE_REMOVE = "Remove image";
const IMAGE_LIMIT_ERROR = "You can upload up to 10 images.";
const IMAGE_VALIDATION_COPY = "Images must be JPEG, PNG, or WebP files under 8 MB.";
const DATE_TIME_EMPTY = "Select event date and time";

function getCurrentPickerDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function formatDateTimeDisplay(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return DATE_TIME_EMPTY;
  }

  return parsed.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toCategoryIds(
  categories: EventCategory[],
  event: OrganizerEvent | null,
): string[] {
  if (!event) {
    return [];
  }

  return categories
    .filter((category) => event.categories.includes(category.name))
    .map((category) => category.id);
}

function resolvePreviewUri(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith("/")) {
    try {
      return `${resolveApiBaseUrl()}${value}`;
    } catch {
      return value;
    }
  }
  return value;
}

function mimeTypeFromAsset(
  mimeType: string | null | undefined,
  fileName: string,
  uri: string,
): string | null {
  const normalizedMime = mimeType?.toLowerCase();
  if (
    normalizedMime === "image/jpeg" ||
    normalizedMime === "image/png" ||
    normalizedMime === "image/webp"
  ) {
    return normalizedMime;
  }

  const candidate = `${fileName} ${uri}`.toLowerCase();
  if (candidate.includes(".jpg") || candidate.includes(".jpeg")) {
    return "image/jpeg";
  }
  if (candidate.includes(".png")) {
    return "image/png";
  }
  if (candidate.includes(".webp")) {
    return "image/webp";
  }
  return null;
}

function toDraftImages(images: EventImageAsset[]): OrganizerDraftImage[] {
  return [...images]
    .sort((left, right) => left.position - right.position)
    .map((image) => ({
      client_id: `existing-${image.id}`,
      source: "existing",
      existing_image_id: image.id,
      uri: image.display_url,
      file_name: image.id,
      mime_type: "image/jpeg",
      display_url: image.display_url,
      thumbnail_url: image.thumbnail_url,
    }));
}

export function OrganizerEventEditor({
  eventId,
  mode,
}: OrganizerEventEditorProps) {
  const router = useRouter();
  const clientIdRef = useRef(0);
  const isEditMode = mode === "edit";
  const [availableCategories, setAvailableCategories] = useState<EventCategory[]>([]);
  const [existingEvent, setExistingEvent] = useState<OrganizerEvent | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [draftImages, setDraftImages] = useState<OrganizerDraftImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateTimeDirty, setDateTimeDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadEditorState = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [categories, event] = await Promise.all([
          fetchCategories(),
          isEditMode && eventId ? fetchOrganizerEvent(eventId) : Promise.resolve(null),
        ]);

        if (!isActive) {
          return;
        }

        setAvailableCategories(categories);

        if (event) {
          setExistingEvent(event);
          setTitle(event.title);
          setDescription(event.description);
          setDateTime(event.date_time);
          setDateTimeDirty(false);
          setLocation(event.location);
          setCapacity(String(event.capacity));
          setSelectedCategoryIds(toCategoryIds(categories, event));
          setDraftImages(toDraftImages(event.images ?? []));
        }
      } catch (loadError) {
        console.error("[OrganizerEventEditor] load error", loadError);
        if (isActive) {
          setError("Failed to load organizer event details.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadEditorState();

    return () => {
      isActive = false;
    };
  }, [eventId, isEditMode]);

  const isEditable =
    !existingEvent ||
    existingEvent.status === "draft" ||
    existingEvent.status === "rejected" ||
    existingEvent.status === "approved";
  const headerTitle = isEditMode ? "Edit Event" : "Create Event";
  const saveLabel = isEditMode ? "Save Changes" : "Create Event";
  const previewImage = draftImages[0] ?? null;
  const previewUri = resolvePreviewUri(
    previewImage?.display_url ?? previewImage?.thumbnail_url ?? previewImage?.uri ?? null,
  );
  const dateTimeDisplay = formatDateTimeDisplay(dateTime);
  const pickerDate = getCurrentPickerDate(dateTime);

  const helperText = useMemo(() => {
    if (!isEditMode) {
      return "Choose the event date and time using the pickers below.";
    }
    if (!existingEvent) {
      return "Update your event details and save when ready.";
    }
    if (!isEditable) {
      return `This event is ${existingEvent.status}. Pending and completed events cannot be edited.`;
    }
    if (existingEvent.status === "approved") {
      return "Approved events can update title, description, capacity, and categories without review. Changing date/time or location sends the event back to pending review.";
    }
    return "Update your event details and save when ready.";
  }, [existingEvent, isEditMode, isEditable]);

  const toggleCategory = (categoryId: string) => {
    if (!isEditable) {
      return;
    }

    setSelectedCategoryIds((currentIds) =>
      currentIds.includes(categoryId)
        ? currentIds.filter((currentId) => currentId !== categoryId)
        : [...currentIds, categoryId],
    );
  };

  const createClientId = () => {
    clientIdRef.current += 1;
    return `organizer-image-${clientIdRef.current}`;
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setDraftImages((currentImages) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentImages.length) {
        return currentImages;
      }
      const nextImages = [...currentImages];
      const [moved] = nextImages.splice(index, 1);
      nextImages.splice(nextIndex, 0, moved);
      return nextImages;
    });
  };

  const removeImage = (clientId: string) => {
    setDraftImages((currentImages) =>
      currentImages.filter((image) => image.client_id !== clientId),
    );
  };

  const handleAddImages = async () => {
    if (!isEditable) {
      return;
    }

    const remainingSlots = MAX_EVENT_IMAGES - draftImages.length;
    if (remainingSlots <= 0) {
      setImageError(IMAGE_LIMIT_ERROR);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        orderedSelection: true,
        quality: 1,
        selectionLimit: remainingSlots,
        mediaTypes: ["images"],
      });

      if (result.canceled) {
        return;
      }

      const validImages: OrganizerDraftImage[] = [];
      let rejectedSelection = false;

      result.assets.forEach((asset) => {
        const resolvedMimeType = mimeTypeFromAsset(
          asset.mimeType,
          asset.fileName ?? "",
          asset.uri,
        );
        if (!resolvedMimeType) {
          rejectedSelection = true;
          return;
        }

        validImages.push({
          client_id: createClientId(),
          source: "upload",
          existing_image_id: null,
          uri: asset.uri,
          file_name: asset.fileName ?? `event-image-${clientIdRef.current}.jpg`,
          mime_type: resolvedMimeType,
          display_url: null,
          thumbnail_url: null,
        });
      });

      if (validImages.length === 0 && rejectedSelection) {
        setImageError(IMAGE_VALIDATION_COPY);
        return;
      }

      setDraftImages((currentImages) => {
        if (currentImages.length + validImages.length > MAX_EVENT_IMAGES) {
          setImageError(IMAGE_LIMIT_ERROR);
          return currentImages;
        }
        return [...currentImages, ...validImages];
      });
      setImageError(rejectedSelection ? IMAGE_VALIDATION_COPY : null);
    } catch (pickerError) {
      console.error("[OrganizerEventEditor] image picker error", pickerError);
      setImageError("Unable to open your photo library right now.");
    }
  };

  const applySelectedDate = (selectedDate: Date) => {
    const current = getCurrentPickerDate(dateTime);
    current.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );
    setDateTimeDirty(true);
    setDateTime(current.toISOString());
  };

  const applySelectedTime = (selectedTime: Date) => {
    const current = getCurrentPickerDate(dateTime);
    current.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    setDateTimeDirty(true);
    setDateTime(current.toISOString());
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (event.type !== "set" || !selectedDate) {
      return;
    }
    applySelectedDate(selectedDate);
  };

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS !== "ios") {
      setShowTimePicker(false);
    }
    if (event.type !== "set" || !selectedDate) {
      return;
    }
    applySelectedTime(selectedDate);
  };

  const buildPayload = (): OrganizerEventInput => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedDateTime = dateTime.trim();
    const trimmedLocation = location.trim();
    const parsedCapacity = Number(capacity);
    const parsedDateTime = new Date(trimmedDateTime);

    if (!trimmedTitle || !trimmedDescription || !trimmedDateTime || !trimmedLocation) {
      throw new Error("All fields are required.");
    }

    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      throw new Error("Capacity must be a positive number.");
    }

    if (Number.isNaN(parsedDateTime.getTime())) {
      throw new Error("Date/time must be a valid ISO date string.");
    }

    if (selectedCategoryIds.length === 0) {
      throw new Error("Select at least one category.");
    }

    return {
      title: trimmedTitle,
      description: trimmedDescription,
      date_time:
        existingEvent && !dateTimeDirty
          ? existingEvent.date_time
          : parsedDateTime.toISOString(),
      location: trimmedLocation,
      capacity: parsedCapacity,
      category_ids: selectedCategoryIds,
      images: draftImages,
    };
  };

  const handleSave = async () => {
    if (!isEditable) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = buildPayload();
      if (isEditMode && eventId) {
        const updatedEvent = await updateOrganizerEvent(eventId, payload);
        if (existingEvent?.status === "approved" && updatedEvent.status === "pending") {
          Alert.alert(
            "Saved",
            "Your event changes were saved and sent back for approval because the date/time or location changed.",
          );
        } else {
          Alert.alert("Saved", "Your organizer event was updated.");
        }
      } else {
        await createOrganizerEvent(payload);
        Alert.alert("Created", "Your organizer event was created as a draft.");
      }
      router.back();
    } catch (saveError) {
      console.error("[OrganizerEventEditor] save error", saveError);
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save organizer event.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.secondary} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.helperText}>{helperText}</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              editable={isEditable}
              placeholder="Career fair, workshop, mixer..."
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              editable={isEditable}
              placeholder="Describe what students should expect."
              multiline
            />

            <Text style={styles.label}>Date and time</Text>
            <View style={styles.dateTimeSection}>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.dateTimeDisplayButton,
                  !isEditable ? styles.disabledButton : null,
                ]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.85}
                disabled={!isEditable}
                testID="event-date-picker-trigger"
              >
                <Text
                  style={[
                    styles.dateTimeDisplayText,
                    dateTimeDisplay === DATE_TIME_EMPTY ? styles.placeholderText : null,
                  ]}
                >
                  {dateTimeDisplay}
                </Text>
              </TouchableOpacity>
              <View style={styles.dateTimeActionRow}>
                <TouchableOpacity
                  style={[
                    styles.secondaryAction,
                    !isEditable ? styles.disabledButton : null,
                  ]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.85}
                  disabled={!isEditable}
                  testID="event-date-trigger"
                >
                  <Text style={styles.secondaryActionText}>Choose Date</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.secondaryAction,
                    !isEditable ? styles.disabledButton : null,
                  ]}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.85}
                  disabled={!isEditable}
                  testID="event-time-trigger"
                >
                  <Text style={styles.secondaryActionText}>Choose Time</Text>
                </TouchableOpacity>
              </View>
              {showDatePicker ? (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  testID="event-date-picker"
                />
              ) : null}
              {showTimePicker ? (
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimeChange}
                  testID="event-time-picker"
                />
              ) : null}
            </View>

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              editable={isEditable}
              placeholder="North Campus, Room 101"
            />

            <Text style={styles.label}>Capacity</Text>
            <TextInput
              style={styles.input}
              value={capacity}
              onChangeText={setCapacity}
              editable={isEditable}
              keyboardType="numeric"
              placeholder="50"
            />

            <Text style={styles.label}>Categories</Text>
            <View style={styles.categoryGrid}>
              {availableCategories.map((category) => {
                const selected = selectedCategoryIds.includes(category.id);
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      selected ? styles.categoryChipSelected : styles.categoryChipUnselected,
                    ]}
                    onPress={() => toggleCategory(category.id)}
                    activeOpacity={0.85}
                    disabled={!isEditable}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected
                          ? styles.categoryChipTextSelected
                          : styles.categoryChipTextUnselected,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.imagesSection}>
              <Text style={styles.sectionTitle}>{IMAGE_SECTION_TITLE}</Text>
              <Text style={styles.sectionHelper}>{IMAGE_SECTION_HELPER}</Text>

              <View style={styles.coverPreviewCard}>
                <Text style={styles.coverPreviewLabel}>{IMAGE_SECTION_PREVIEW}</Text>
                {previewUri ? (
                  <Image
                    source={{ uri: previewUri }}
                    style={styles.coverPreviewImage}
                    testID="organizer-cover-preview-image"
                  />
                ) : (
                  <View style={styles.coverPreviewPlaceholder}>
                    <MaterialCommunityIcons
                      name="image-outline"
                      size={28}
                      color={colors.onSurfaceVariant}
                    />
                  </View>
                )}
                <Text style={styles.coverPreviewName} testID="cover-preview-filename">
                  {previewImage?.file_name ?? IMAGE_SECTION_EMPTY}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.addImagesButton,
                  !isEditable ? styles.disabledButton : null,
                ]}
                onPress={() => void handleAddImages()}
                activeOpacity={0.85}
                disabled={!isEditable}
              >
                <MaterialCommunityIcons name="image-plus" size={18} color={colors.onPrimary} />
                <Text style={styles.addImagesButtonText}>{IMAGE_ADD_LABEL}</Text>
              </TouchableOpacity>

              <Text style={styles.validationText}>{IMAGE_VALIDATION_COPY}</Text>
              {imageError ? <Text style={styles.errorText}>{imageError}</Text> : null}

              {draftImages.length === 0 ? (
                <Text style={styles.emptyImagesCopy}>{IMAGE_SECTION_EMPTY}</Text>
              ) : (
                <View style={styles.imageList}>
                  {draftImages.map((image, index) => {
                    const moveLeftDisabled = !isEditable || index === 0;
                    const moveRightDisabled = !isEditable || index === draftImages.length - 1;
                    return (
                      <View
                        key={image.client_id}
                        style={styles.imageRow}
                        testID={`organizer-image-row-${image.client_id}`}
                      >
                        <View style={styles.imageRowBody}>
                          <Text style={styles.imageRowTitle}>
                            {image.file_name}
                            {index === 0 ? " (cover)" : ""}
                          </Text>
                          <Text style={styles.imageRowMeta}>
                            {image.source === "existing" ? "Saved image" : "New upload"}
                          </Text>
                        </View>
                        <View style={styles.imageRowActions}>
                          <TouchableOpacity
                            style={[
                              styles.secondaryAction,
                              moveLeftDisabled ? styles.disabledButton : null,
                            ]}
                            onPress={() => moveImage(index, -1)}
                            disabled={moveLeftDisabled}
                            testID={`move-left-${image.client_id}`}
                          >
                            <Text style={styles.secondaryActionText}>{IMAGE_MOVE_LEFT}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.secondaryAction,
                              moveRightDisabled ? styles.disabledButton : null,
                            ]}
                            onPress={() => moveImage(index, 1)}
                            disabled={moveRightDisabled}
                            testID={`move-right-${image.client_id}`}
                          >
                            <Text style={styles.secondaryActionText}>{IMAGE_MOVE_RIGHT}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.removeAction,
                              !isEditable ? styles.disabledButton : null,
                            ]}
                            onPress={() => removeImage(image.client_id)}
                            disabled={!isEditable}
                            testID={`remove-image-${image.client_id}`}
                          >
                            <Text style={styles.removeActionText}>{IMAGE_REMOVE}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!isEditable || isSaving) ? styles.disabledButton : null,
              ]}
              onPress={() => void handleSave()}
              activeOpacity={0.85}
              disabled={!isEditable || isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? "Saving..." : saveLabel}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h3,
    color: colors.onSurface,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xxl,
    padding: 20,
    gap: 14,
  },
  helperText: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  errorText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.error,
  },
  label: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onSurface,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  dateTimeSection: {
    gap: 10,
  },
  dateTimeDisplayButton: {
    justifyContent: "center",
  },
  dateTimeDisplayText: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  placeholderText: {
    color: colors.onSurfaceVariant,
  },
  dateTimeActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  categoryChipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  categoryChipUnselected: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
  },
  categoryChipText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
  },
  categoryChipTextSelected: {
    color: colors.onPrimary,
  },
  categoryChipTextUnselected: {
    color: colors.onSurface,
  },
  imagesSection: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fontFamilies.headline,
    fontSize: fontSizes.h4,
    color: colors.onSurface,
  },
  sectionHelper: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
  },
  coverPreviewCard: {
    borderRadius: borderRadius.xxl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  coverPreviewLabel: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onSurface,
  },
  coverPreviewImage: {
    height: 180,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerHigh,
  },
  coverPreviewPlaceholder: {
    height: 180,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPreviewName: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  addImagesButton: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addImagesButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.onPrimary,
  },
  validationText: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
  },
  emptyImagesCopy: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurfaceVariant,
  },
  imageList: {
    gap: 10,
  },
  imageRow: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },
  imageRowBody: {
    gap: 4,
  },
  imageRowTitle: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.onSurface,
  },
  imageRowMeta: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySm,
    color: colors.onSurfaceVariant,
  },
  imageRowActions: {
    gap: 8,
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onSurface,
  },
  removeAction: {
    minHeight: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  removeActionText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodySm,
    color: colors.onPrimary,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveButtonText: {
    fontFamily: fontFamilies.label,
    fontSize: fontSizes.bodyLg,
    color: colors.onPrimary,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
