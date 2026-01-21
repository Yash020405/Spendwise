import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../utils/ThemeContext';
import Logo from '../../components/Logo';

const { width } = Dimensions.get('window');

const ONBOARDING_SLIDES = [
    {
        id: '1',
        icon: 'account-balance-wallet',
        title: 'Track Every Rupee',
        subtitle: 'Log expenses in seconds and know exactly where your money goes.',
        color: '#6366F1',
    },
    {
        id: '2',
        icon: 'pie-chart',
        title: 'Visual Insights',
        subtitle: 'Beautiful charts show your spending patterns at a glance.',
        color: '#10B981',
    },
    {
        id: '3',
        icon: 'trending-up',
        title: 'Smarter Decisions',
        subtitle: 'Compare months, set budgets, and take control of your finances.',
        color: '#F59E0B',
    },
];

export default function WelcomeScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleNext = () => {
        if (currentIndex < ONBOARDING_SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            router.push('/(auth)/register');
        }
    };

    const handleSkip = () => {
        router.push('/(auth)/landing');
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const renderSlide = ({ item }: { item: typeof ONBOARDING_SLIDES[0] }) => {
        return (
            <View style={[styles.slide, { width }]}>
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                    <View style={[styles.iconInner, { backgroundColor: item.color }]}>
                        <MaterialIcons name={item.icon as any} size={44} color="#FFFFFF" />
                    </View>
                </View>

                <Text style={[styles.title, { color: theme.colors.text }]}>
                    {item.title}
                </Text>

                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    {item.subtitle}
                </Text>
            </View>
        );
    };

    const renderPagination = () => (
        <View style={styles.pagination}>
            {ONBOARDING_SLIDES.map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        {
                            backgroundColor: ONBOARDING_SLIDES[currentIndex].color,
                            width: index === currentIndex ? 24 : 8,
                            opacity: index === currentIndex ? 1 : 0.3,
                        },
                    ]}
                />
            ))}
        </View>
    );

    const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header with branding */}
            <View style={styles.header}>
                <View style={styles.brandRow}>
                    <Logo size={32} />
                    <Text style={[styles.brandName, { color: theme.colors.text }]}>
                        Spendwise
                    </Text>
                </View>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>
                        Skip
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={ONBOARDING_SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                style={styles.flatList}
            />

            {/* Pagination */}
            {renderPagination()}

            {/* Bottom Actions */}
            <View style={styles.bottomSection}>
                <TouchableOpacity
                    style={[styles.nextButton, { backgroundColor: ONBOARDING_SLIDES[currentIndex].color }]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={styles.nextButtonText}>
                        {isLastSlide ? "Get Started" : 'Next'}
                    </Text>
                    <MaterialIcons
                        name={isLastSlide ? 'arrow-forward' : 'arrow-forward'}
                        size={20}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.loginLink}
                    onPress={() => router.push('/(auth)/login')}
                >
                    <Text style={[styles.loginText, { color: theme.colors.textSecondary }]}>
                        Already a member?{' '}
                        <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                            Sign In
                        </Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logoMini: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    brandName: {
        fontSize: 16,
        fontWeight: '700',
    },
    skipButton: {
        padding: 8,
    },
    skipText: {
        fontSize: 15,
        fontWeight: '500',
    },
    flatList: {
        flex: 1,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    iconInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 10,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    bottomSection: {
        paddingHorizontal: 24,
        paddingBottom: 32,
    },
    nextButton: {
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
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    loginLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    loginText: {
        fontSize: 14,
    },
});
