import type { ModalProps } from 'react-native';

/**
 * Every orientation, for the `supportedOrientations` of each `<Modal>`.
 *
 * React Native's Modal only supports portrait unless told otherwise. While a screen has turned the app
 * sideways (the video call in landscape, the VIN scanner), presenting a portrait-only Modal makes iOS raise
 * "Supported orientations has no common orientation with the application" and the app is killed (TestFlight
 * build 83: a Modal opened during the call). A Modal that allows all of them is fine in both positions.
 */
export const MODAL_ORIENTATIONS: NonNullable<ModalProps['supportedOrientations']> = [
    'portrait',
    'portrait-upside-down',
    'landscape',
    'landscape-left',
    'landscape-right',
];
