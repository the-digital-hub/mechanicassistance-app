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
});
