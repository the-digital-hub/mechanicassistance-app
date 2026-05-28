import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CallControls } from '../CallControls';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

describe('CallControls', () => {
  const baseProps = {
    isAudioMuted: false,
    isCameraOff: false,
    onToggleAudio: jest.fn(),
    onToggleCamera: jest.fn(),
    onSwitchCamera: jest.fn(),
    onHangUp: jest.fn(),
  };

  it('fires the matching callback when each control is pressed', () => {
    const props = { ...baseProps };
    const { getByTestId } = render(<CallControls {...props} />);
    fireEvent.press(getByTestId('ctrl-audio'));
    fireEvent.press(getByTestId('ctrl-camera'));
    fireEvent.press(getByTestId('ctrl-switch'));
    fireEvent.press(getByTestId('ctrl-hangup'));
    expect(props.onToggleAudio).toHaveBeenCalledTimes(1);
    expect(props.onToggleCamera).toHaveBeenCalledTimes(1);
    expect(props.onSwitchCamera).toHaveBeenCalledTimes(1);
    expect(props.onHangUp).toHaveBeenCalledTimes(1);
  });
});
