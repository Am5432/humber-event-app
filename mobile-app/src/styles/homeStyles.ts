
import { fontFamilies, fontSizes, borderRadius } from "../theme/typography";
import { colors } from "../theme/colors";
import { StyleSheet } from "react-native";

const homeStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.surface },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primaryContainer,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    avatarButton: {
        borderRadius: borderRadius.full,
    },
    avatarText: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.bodyLg,
        color: colors.onPrimary,
    },
    headerTitle: {
        flex: 1,
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h3,
        color: colors.onSurface,
    },
    searchButton: {
        padding: 4,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    scrollContentCompact: { paddingTop: 12 },
    sectionTitle: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h4,
        color: colors.onSurface,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 20,
        marginBottom: 12,
    },
    topSectionHeaderRow: {
        marginTop: 0,
    },
    sectionAction: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodySm,
        color: colors.secondary,
    },
    carouselContent: { paddingBottom: 4 },
    carousel: { marginHorizontal: -20, paddingHorizontal: 20 },
    masonryRow: {
        flexDirection: "row",
        gap: 8,
    },
    masonryCol: {
        flex: 1,
        gap: 8,
    },
    tileTall: {
        height: 160,
    },
    tileShort: {
        height: 100,
    },
    tileMed: {
        height: 130,
    },
    heroCard: {
        backgroundColor: colors.primaryContainer,
        borderRadius: borderRadius.xxl,
        padding: 20,
        gap: 10,
    },
    heroEyebrow: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.labelLg,
        color: colors.primaryFixedDim,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    heroTitle: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h2,
        color: colors.onPrimary,
    },
    heroCopy: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodyLg,
        color: colors.onPrimary,
        lineHeight: 24,
    },
    heroAction: {
        alignSelf: "flex-start",
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.full,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    heroHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },
    heroTitleBlock: {
        flex: 1,
        gap: 10,
    },
    heroDismissButton: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceContainerLow,
    },
    heroActionText: {
        fontFamily: fontFamilies.label,
        fontSize: fontSizes.bodySm,
        color: colors.onPrimary,
    },
    centered: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodyLg,
        color: colors.onSurfaceVariant,
        textAlign: "center",
    },
    eventList: { gap: 0 },
    statsContainer: {
        marginBottom: 8,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: "45%",
        backgroundColor: colors.surfaceContainerLowest,
        borderRadius: borderRadius.lg,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    statValue: {
        fontFamily: fontFamilies.headline,
        fontSize: fontSizes.h3,
        color: colors.onSurface,
        marginTop: 8,
    },
    statLabel: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodySm,
        color: colors.onSurfaceVariant,
        marginTop: 2,
    },
    categoryEmpty: {
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: borderRadius.lg,
        padding: 16,
    },
    categoryEmptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodySm,
        color: colors.onSurfaceVariant,
    },
    registrationsEmpty: {
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: borderRadius.lg,
        padding: 16,
    },
    registrationsEmptyText: {
        fontFamily: fontFamilies.body,
        fontSize: fontSizes.bodySm,
        color: colors.onSurfaceVariant,
    },
});


export default homeStyles;
