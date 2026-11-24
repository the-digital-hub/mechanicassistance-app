// AsyncStorage has no native side under jest: every suite gets the library's in-memory mock (a suite can still mock it its own way).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// The notifications bell reads the inbox context (sockets, i18n): the suites that render a screen header do not need it.
jest.mock('@/components/HeaderBell', () => ({ HeaderBell: () => null }));
