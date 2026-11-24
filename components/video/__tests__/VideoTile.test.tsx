import React from 'react';
import { render } from '@testing-library/react-native';
import { VideoTile } from '../VideoTile';

jest.mock('@daily-co/react-native-webrtc', () => ({
  RTCView: 'RTCView',
}));

describe('VideoTile', () => {
  it('shows the placeholder with the name when camera is off', () => {
    const { getByText, queryByTestId } = render(
      <VideoTile name="Ana Diaz" isCameraOff stream={null} isLocal={false} />,
    );
    expect(getByText('Ana Diaz')).toBeTruthy();
    expect(queryByTestId('rtc-view')).toBeNull();
  });

  it('renders the stream view when camera is on and a stream exists', () => {
    const fakeStream: any = { toURL: () => 'stream-url' };
    const { getByTestId } = render(
      <VideoTile name="Ana Diaz" isCameraOff={false} stream={fakeStream} isLocal={false} />,
    );
    expect(getByTestId('rtc-view')).toBeTruthy();
  });

  it('mirrors only the local picture of the selfie camera', () => {
    const fakeStream: any = { toURL: () => 'stream-url' };
    const mirrored = (props: { isLocal: boolean; backCamera?: boolean }) =>
      render(<VideoTile name="Ana" isCameraOff={false} stream={fakeStream} {...props} />).getByTestId('rtc-view').props.mirror;
    expect(mirrored({ isLocal: true })).toBe(true);
    expect(mirrored({ isLocal: true, backCamera: true })).toBe(false);
    expect(mirrored({ isLocal: false })).toBe(false);
  });

  it('lifts the small picture above the big one (Android surface order)', () => {
    const fakeStream: any = { toURL: () => 'stream-url' };
    const zOrder = (overlay?: boolean) =>
      render(<VideoTile name="Ana" isCameraOff={false} stream={fakeStream} isLocal={false} overlay={overlay} />).getByTestId('rtc-view').props.zOrder;
    expect(zOrder(true)).toBe(1);
    expect(zOrder()).toBe(0);
  });
});
