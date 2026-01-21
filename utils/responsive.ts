/**
 * Responsive Design Utilities
 * Provides consistent scaling and breakpoints for different screen sizes
 */

import { Dimensions, PixelRatio, Platform, ScaledSize } from 'react-native';

// Base dimensions (iPhone 14 Pro)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

// Get current dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Device type detection
export const isSmallDevice = SCREEN_WIDTH < 375;
export const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
export const isLargeDevice = SCREEN_WIDTH >= 414;
export const isTablet = SCREEN_WIDTH >= 768;

// Screen size breakpoints
export const BREAKPOINTS = {
  small: 375,    // iPhone SE, older phones
  medium: 414,   // iPhone Plus/Max models
  large: 768,    // Tablets
  xlarge: 1024,  // Large tablets
};

/**
 * Scale a value based on screen width
 * Useful for horizontal spacing and widths
 */
export const scaleWidth = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale a value based on screen height
 * Useful for vertical spacing and heights
 */
export const scaleHeight = (size: number): number => {
  const scale = SCREEN_HEIGHT / BASE_HEIGHT;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Moderate scaling - less aggressive than full scaling
 * Good for fonts and paddings
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size + (scale - 1) * size * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale font size with accessibility considerations
 */
export const scaleFontSize = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  
  // Clamp font sizes to reasonable bounds
  const minSize = size * 0.85;
  const maxSize = size * 1.3;
  
  return Math.round(
    Math.min(Math.max(PixelRatio.roundToNearestPixel(newSize), minSize), maxSize)
  );
};

/**
 * Get responsive value based on breakpoints
 */
export const getResponsiveValue = <T>(values: {
  small?: T;
  medium?: T;
  large?: T;
  tablet?: T;
  default: T;
}): T => {
  if (isTablet && values.tablet !== undefined) return values.tablet;
  if (isLargeDevice && values.large !== undefined) return values.large;
  if (isMediumDevice && values.medium !== undefined) return values.medium;
  if (isSmallDevice && values.small !== undefined) return values.small;
  return values.default;
};

/**
 * Responsive spacing presets
 */
export const spacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(32),
  xxl: moderateScale(48),
};

/**
 * Responsive font sizes
 */
export const fontSize = {
  xs: scaleFontSize(10),
  sm: scaleFontSize(12),
  md: scaleFontSize(14),
  lg: scaleFontSize(16),
  xl: scaleFontSize(18),
  xxl: scaleFontSize(24),
  xxxl: scaleFontSize(32),
  display: scaleFontSize(40),
};

/**
 * Card dimensions based on screen size
 */
export const cardDimensions = {
  width: getResponsiveValue({
    small: SCREEN_WIDTH - 32,
    medium: SCREEN_WIDTH - 40,
    large: SCREEN_WIDTH - 48,
    tablet: (SCREEN_WIDTH - 64) / 2,
    default: SCREEN_WIDTH - 40,
  }),
  padding: getResponsiveValue({
    small: 12,
    medium: 16,
    large: 20,
    tablet: 24,
    default: 16,
  }),
  borderRadius: getResponsiveValue({
    small: 12,
    medium: 16,
    large: 20,
    default: 16,
  }),
};

/**
 * Grid columns based on screen width
 */
export const getGridColumns = (): number => {
  if (isTablet) return 4;
  if (isLargeDevice) return 3;
  return 2;
};

/**
 * Hook-like function to get current dimensions
 * Note: For real-time updates, use Dimensions.addEventListener
 */
export const getDimensions = (): { width: number; height: number } => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

/**
 * Calculate safe area insets
 */
export const getStatusBarHeight = (): number => {
  return Platform.select({
    ios: 44,
    android: 24,
    default: 0,
  });
};

/**
 * Bottom tab bar height
 */
export const getTabBarHeight = (): number => {
  return getResponsiveValue({
    small: 56,
    medium: 60,
    large: 64,
    tablet: 72,
    default: 60,
  });
};

/**
 * Touch target size (minimum 44x44 for accessibility)
 */
export const touchTarget = {
  minSize: 44,
  padding: moderateScale(10),
};

/**
 * Common responsive styles
 */
export const responsiveStyles = {
  container: {
    paddingHorizontal: getResponsiveValue({
      small: 16,
      medium: 20,
      large: 24,
      tablet: 32,
      default: 20,
    }),
  },
  header: {
    paddingTop: getResponsiveValue({
      small: 12,
      medium: 16,
      large: 20,
      default: 16,
    }),
    paddingBottom: getResponsiveValue({
      small: 8,
      medium: 12,
      large: 16,
      default: 12,
    }),
  },
  title: {
    fontSize: getResponsiveValue({
      small: 24,
      medium: 28,
      large: 32,
      tablet: 36,
      default: 28,
    }),
  },
  subtitle: {
    fontSize: getResponsiveValue({
      small: 14,
      medium: 15,
      large: 16,
      tablet: 18,
      default: 15,
    }),
  },
};

export default {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  isTablet,
  BREAKPOINTS,
  scaleWidth,
  scaleHeight,
  moderateScale,
  scaleFontSize,
  getResponsiveValue,
  spacing,
  fontSize,
  cardDimensions,
  getGridColumns,
  getDimensions,
  getStatusBarHeight,
  getTabBarHeight,
  touchTarget,
  responsiveStyles,
};
