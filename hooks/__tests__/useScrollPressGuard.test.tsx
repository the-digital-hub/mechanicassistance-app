import { renderHook } from '@testing-library/react-native';
import { SCROLL_SETTLE_MS, useGuardedPress, useScrollPressGuard } from '../useScrollPressGuard';

describe('useScrollPressGuard', () => {
  let now = 10_000;

  beforeEach(() => {
    now = 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets a press through when the list has not scrolled', () => {
    const { result } = renderHook(() => useScrollPressGuard());
    const onPress = jest.fn();
    result.current.guard(onPress)();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('drops a press while the user is dragging', () => {
    const { result } = renderHook(() => useScrollPressGuard());
    const onPress = jest.fn();
    result.current.scrollProps.onScrollBeginDrag();
    now += 1_000;
    result.current.guard(onPress)();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('drops a press that lands right after a scroll event (tap that stops a fling)', () => {
    const { result } = renderHook(() => useScrollPressGuard());
    const onPress = jest.fn();
    result.current.scrollProps.onScroll();
    now += SCROLL_SETTLE_MS - 1;
    result.current.guard(onPress)();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('lets a press through once the list has settled', () => {
    const { result } = renderHook(() => useScrollPressGuard());
    const onPress = jest.fn();
    result.current.scrollProps.onScrollBeginDrag();
    result.current.scrollProps.onScrollEndDrag();
    now += SCROLL_SETTLE_MS;
    result.current.guard(onPress)('arg');
    expect(onPress).toHaveBeenCalledWith('arg');
  });

  it('useGuardedPress passes through without a provider', () => {
    const onPress = jest.fn();
    const { result } = renderHook(() => useGuardedPress(onPress));
    result.current();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
