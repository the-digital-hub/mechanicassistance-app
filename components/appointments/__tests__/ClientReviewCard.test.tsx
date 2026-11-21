import { act, render } from '@testing-library/react-native';
import React from 'react';

import { ClientReviewCard } from '../ClientReviewCard';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const props = {
    rating: 5,
    setRating: jest.fn(),
    tags: [] as string[],
    setTags: jest.fn(),
    reviewText: '',
    setReviewText: jest.fn(),
    onSubmit: jest.fn(),
};

describe('technician rating of the customer', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('is not shown at all when it was already sent', () => {
        const tree = render(<ClientReviewCard {...props} isSubmitted />);
        expect(tree.queryByTestId('client-review-card')).toBeNull();
    });

    it('says it was sent for a moment, then closes', () => {
        const tree = render(<ClientReviewCard {...props} isSubmitted={false} />);
        expect(tree.queryByTestId('client-review-card')).not.toBeNull();

        tree.rerender(<ClientReviewCard {...props} isSubmitted />);
        expect(tree.queryByTestId('client-review-sent')).not.toBeNull();

        act(() => { jest.advanceTimersByTime(2300); });
        expect(tree.queryByTestId('client-review-card')).toBeNull();
    });
});
