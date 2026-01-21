// Mock React Native for Jest
module.exports = {
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
    absoluteFillObject: {},
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    Value: jest.fn(() => ({
      interpolate: jest.fn(),
    })),
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn(),
    })),
    sequence: jest.fn(() => ({
      start: jest.fn(),
    })),
    loop: jest.fn(() => ({
      start: jest.fn(),
    })),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 393, height: 852 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  PixelRatio: {
    get: jest.fn(() => 2),
    roundToNearestPixel: jest.fn((size) => size),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
  },
  Keyboard: {
    dismiss: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  RefreshControl: 'RefreshControl',
  FlatList: 'FlatList',
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
};
