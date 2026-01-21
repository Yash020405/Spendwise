import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../utils/ThemeContext';
import Logo from '../../components/Logo';

export default function LandingScreen() {
    const { theme } = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Hero Section */}
            <View style={styles.heroSection}>
                <View style={styles.logoContainer}>
                    <Logo size={120} />
                </View>

                <Text style={[styles.appName, { color: theme.colors.text }]}>
                    Spendwise
                </Text>

                <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>
                    Your smart expense tracker
                </Text>
            </View>

            {/* Features */}
            <View style={styles.featuresSection}>
                <FeatureRow icon="check-circle" text="Track daily expenses" theme={theme} />
                <FeatureRow icon="check-circle" text="Visual spending insights" theme={theme} />
                <FeatureRow icon="check-circle" text="Multi-currency support" theme={theme} />
                <FeatureRow icon="check-circle" text="Set & manage budgets" theme={theme} />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionSection}>
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push('/(auth)/register')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                    onPress={() => router.push('/(auth)/login')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                        Sign In
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const FeatureRow = ({ icon, text, theme }: { icon: string; text: string; theme: any }) => (
    <View style={styles.featureRow}>
        <MaterialIcons name={icon as any} size={20} color={theme.colors.success} />
        <Text style={[styles.featureText, { color: theme.colors.text }]}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    heroSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appName: {
        fontSize: 30,
        fontWeight: '800',
        marginBottom: 6,
    },
    tagline: {
        fontSize: 16,
    },
    featuresSection: {
        paddingVertical: 24,
        gap: 14,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureText: {
        fontSize: 15,
        fontWeight: '500',
    },
    actionSection: {
        paddingBottom: 32,
        gap: 12,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    secondaryButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    secondaryButtonText: {
        fontSize: 17,
        fontWeight: '600',
    },
});
