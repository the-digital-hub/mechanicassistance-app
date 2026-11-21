import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { RatingFields } from '../RatingFields';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const base = {
    rating: 0, onRating: jest.fn(), tags: [] as string[], onTags: jest.fn(),
    options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    tagsTitle: 'What stood out?', comment: '', onComment: jest.fn(), commentPlaceholder: 'Comment',
};

describe('RatingFields', () => {
    beforeEach(() => jest.clearAllMocks());

    it('picks the stars, adds and removes options, and types the comment', () => {
        const tree = render(<RatingFields {...base} tags={['a']} />);
        fireEvent.press(tree.getByTestId('rating-star-4'));
        expect(base.onRating).toHaveBeenCalledWith(4);
        fireEvent.press(tree.getByTestId('rating-tag-b'));
        expect(base.onTags).toHaveBeenCalledWith(['a', 'b']);
        fireEvent.press(tree.getByTestId('rating-tag-a'));
        expect(base.onTags).toHaveBeenLastCalledWith([]);
        fireEvent.changeText(tree.getByPlaceholderText('Comment'), 'Great');
        expect(base.onComment).toHaveBeenCalledWith('Great');
    });
});
