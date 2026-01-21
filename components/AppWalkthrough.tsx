import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/ThemeContext';

const WALKTHROUGH_STEPS = [
    {
        icon: 'add-circle',
        title: 'Add Expenses',
        description: 'Tap the + button to quickly log your daily expenses in seconds.',
        color: '#6366F1',
    },
    {
        icon: 'pie-chart',
        title: 'Track Spending',
        description: 'View beautiful charts showing where your money goes each month.',
        color: '#10B981',
    },
    {
        icon: 'account-balance-wallet',
        title: 'Set Budgets',
        description: 'Set monthly budgets and get alerts when you\'re close to the limit.',
        color: '#F59E0B',
    },
];

interface Props {
    onComplete: () => void;
}

export default function AppWalkthrough({ onComplete }: Props) {
    const { theme } = useTheme();
    const [visible, setVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        checkFirstTime();
    }, []);

    const checkFirstTime = async () => {
        const hasSeenWalkthrough = await AsyncStorage.getItem('@has_seen_walkthrough');
        if (!hasSeenWalkthrough) {
            setVisible(true);
        }
    };

    const handleNext = () => {
        if (currentStep < WALKTHROUGH_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = async () => {
        await AsyncStorage.setItem('@has_seen_walkthrough', 'true');
        setVisible(false);
        onComplete();
    };

    const step = WALKTHROUGH_STEPS[currentStep];
    const isLastStep = currentStep === WALKTHROUGH_STEPS.length - 1;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
                    {/* Progress dots */}
                    <View style={styles.progressContainer}>
                        {WALKTHROUGH_STEPS.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: index === currentStep ? step.color : theme.colors.border,
                                        width: index === currentStep ? 20 : 8,
                                    },
                                ]}
                            />
                        ))}
                    </View>

                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: step.color + '15' }]}>
                        <View style={[styles.iconInner, { backgroundColor: step.color }]}>
                            <MaterialIcons name={step.icon as any} size={36} color="#FFFFFF" />
                        </View>
                    </View>

                    {/* Content */}
                    <Text style={[styles.title, { color: theme.colors.text }]}>
                        {step.title}
                    </Text>
                    <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                        {step.description}
                    </Text>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={handleComplete}
                        >
                            <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>
                                Skip
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: step.color }]}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextText}>
                                {isLastStep ? "Let's Start!" : 'Next'}
                            </Text>
                            <MaterialIcons
                                name={isLastStep ? 'check' : 'arrow-forward'}
                                size={18}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
    },
    progressContainer: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 28,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    iconInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 10,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 28,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    skipButton: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    skipText: {
        fontSize: 15,
        fontWeight: '500',
    },
    nextButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 6,
    },
    nextText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
