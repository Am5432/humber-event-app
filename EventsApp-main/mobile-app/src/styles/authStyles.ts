import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet } from "react-native";

const authStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#F4F4F8",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: "#F4F4F8",
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: "#1D1D1F",
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 28,
        paddingHorizontal: 10,
    },
    logoMark: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: "#022B52",
        marginRight: 12,
    },
    brandText: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1D1D1F",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        padding: 28,
        shadowColor: "#000000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: "#1D1D1F",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: "#646B75",
        marginBottom: 22,
    },
    input: {
        height: 54,
        borderWidth: 1,
        borderColor: "#E3E4E8",
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: "#FFFFFF",
        color: "#1D1D1F",
        marginBottom: 14,
    },
    errorText: {
        color: "#D63C3C",
        fontSize: 14,
        marginBottom: 12,
    },
    button: {
        height: 56,
        borderRadius: 14,
        backgroundColor: "#4F67E8",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
    },
    buttonPressed: {
        opacity: 0.9,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "800",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: "#E3E4E8",
    },
    dividerText: {
        marginHorizontal: 10,
        color: "#8B8F98",
        fontWeight: "600",
    },
    ssoButton: {
        height: 56,
        borderRadius: 14,
        backgroundColor: colors.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    ssoButtonText: {
        fontFamily: fontFamilies?.label || "System",
        fontSize: 18,
        color: colors.primary,
        fontWeight: "800",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 24,
    },
    footerText: {
        fontSize: 15,
        color: "#646B75",
    },
    linkText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#4F67E8", // Use your primary theme color
    },
});


export default authStyles;