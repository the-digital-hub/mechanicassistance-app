import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PinBoxes } from '../PinBoxes';

jest.mock('@/lib/ui/fonts', () => ({ FONT: { bold: 'x', medium: 'x', regular: 'x', semibold: 'x' } }));

describe('PinBoxes', () => {
    it('shows each digit in its own box and keeps only digits, up to the length', () => {
        const onChange = jest.fn();
        const tree = render(<PinBoxes value="12" onChange={onChange} testID="pin" />);
        expect(tree.getByText('1')).toBeTruthy();
        expect(tree.getByText('2')).toBeTruthy();
        fireEvent.changeText(tree.getByTestId('pin'), '12a345');
        expect(onChange).toHaveBeenCalledWith('1234');
    });
});
