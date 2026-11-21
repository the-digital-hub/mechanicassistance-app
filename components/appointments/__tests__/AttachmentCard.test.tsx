import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }), VideoView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/lib/config/ConfigService', () => ({ ConfigService: { getApiBaseUrl: () => 'https://api.example.com' } }));

import { AttachmentCard } from '../AttachmentStrip';

const photos = [
    { url: 'https://cdn.example.com/a.jpg', type: 'image', note: 'Front bumper' },
    { url: 'https://cdn.example.com/b.mp4', type: 'video' },
    { url: '/uploads/c.jpg', type: 'image' },
];

function renderCard() {
    const view = render(<AttachmentCard photos={photos} title="Photos & video (3)" />);
    // The thumbnails are sized from the width the card gives them.
    fireEvent(view.getByTestId('attachment-card').children[1] as never, 'layout', { nativeEvent: { layout: { width: 300, height: 0, x: 0, y: 0 } } });
    return view;
}

describe('AttachmentCard', () => {
    it('shows the photos and videos as small thumbnails, three to a row', () => {
        const { getAllByTestId } = renderCard();
        expect(getAllByTestId('attachment-photo')).toHaveLength(2);
        expect(getAllByTestId('attachment-video')).toHaveLength(1);
        const style = ([] as unknown[]).concat(getAllByTestId('attachment-photo')[0].props.style).flat();
        const merged = Object.assign({}, ...style.filter(Boolean)) as { width: number };
        expect(merged.width).toBe(93); // (300 - 2 gaps of 10) / 3
    });

    it('opens a photo full size when it is tapped, and closes it again', () => {
        const { getAllByTestId, queryByTestId, getAllByText } = renderCard();
        expect(queryByTestId('image-viewer')).toBeNull();
        fireEvent.press(getAllByTestId('attachment-photo')[0]);
        expect(queryByTestId('image-viewer')).toBeTruthy();
        // The note is under its thumbnail and, with the photo open, under the photo.
        expect(getAllByText('Front bumper')).toHaveLength(2);
        fireEvent.press(queryByTestId('image-viewer-close')!);
        expect(queryByTestId('image-viewer')).toBeNull();
    });

    it('renders nothing without attachments', () => {
        const { queryByTestId } = render(<AttachmentCard photos={[]} />);
        expect(queryByTestId('attachment-card')).toBeNull();
    });
});
