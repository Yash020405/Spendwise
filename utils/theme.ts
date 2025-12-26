// Theme configuration for PocketExpense+
export const lightTheme = {
    name: 'light',
    colors: {
        // Primary colors
        primary: '#6366F1',
        primaryLight: '#818CF8',
        primaryDark: '#4F46E5',

        // Background colors
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceSecondary: '#F1F5F9',

        // Text colors
        text: '#0F172A',
        textSecondary: '#64748B',
        textTertiary: '#94A3B8',
        textInverse: '#FFFFFF',

        // Border colors
        border: '#E2E8F0',
        borderLight: '#F1F5F9',

        // Status colors
        success: '#10B981',
        successLight: '#D1FAE5',
        warning: '#F59E0B',
        warningLight: '#FEF3C7',
        error: '#EF4444',
        errorLight: '#FEE2E2',
        info: '#3B82F6',
        infoLight: '#DBEAFE',

        // Category colors
        categories: {
            food: '#F59E0B',
            transport: '#3B82F6',
            shopping: '#EC4899',
            entertainment: '#8B5CF6',
            bills: '#EF4444',
            health: '#10B981',
            education: '#06B6D4',
            other: '#6B7280',
        },

        // Chart colors
        chart: ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4'],
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        full: 9999,
    },
    typography: {
        h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
        h2: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
        h3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
        h4: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
        body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
        bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
        caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
        button: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
    },
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 5,
        },
    },
};

export const darkTheme = {
    ...lightTheme,
    name: 'dark',
    colors: {
        // Primary colors (same)
        primary: '#818CF8',
        primaryLight: '#A5B4FC',
        primaryDark: '#6366F1',

        // Background colors
        background: '#0F172A',
        surface: '#1E293B',
        surfaceSecondary: '#334155',

        // Text colors
        text: '#F8FAFC',
        textSecondary: '#94A3B8',
        textTertiary: '#64748B',
        textInverse: '#0F172A',

        // Border colors
        border: '#334155',
        borderLight: '#1E293B',

        // Status colors (slightly lighter for dark mode)
        success: '#34D399',
        successLight: '#064E3B',
        warning: '#FBBF24',
        warningLight: '#78350F',
        error: '#F87171',
        errorLight: '#7F1D1D',
        info: '#60A5FA',
        infoLight: '#1E3A8A',

        // Category colors (same)
        categories: {
            food: '#FBBF24',
            transport: '#60A5FA',
            shopping: '#F472B6',
            entertainment: '#A78BFA',
            bills: '#F87171',
            health: '#34D399',
            education: '#22D3EE',
            other: '#9CA3AF',
        },

        // Chart colors
        chart: ['#818CF8', '#F472B6', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F87171', '#22D3EE'],
    },
};

export type Theme = typeof lightTheme;
