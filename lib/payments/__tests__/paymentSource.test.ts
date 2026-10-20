import type { PaymentCard } from '@/lib/dao/interfaces';
import type { Wallet } from '@/lib/dao/WalletDAO';

import { parseTopUp, pickDefaultSource, shortfall, suggestedTopUp, walletCovers } from '../paymentSource';

jest.mock('@/lib/dao/WalletDAO', () => ({ MIN_TOP_UP: 5, MAX_TOP_UP: 500 }));

const wallet = (available: string): Wallet => ({ id: 'w', balance: available, heldBalance: '0', availableBalance: available });
const card = { id: 'card-1', isDefault: true } as PaymentCard;

describe('paymentSource', () => {
    it('pays from the wallet when it covers the amount, else the default card', () => {
        expect(pickDefaultSource(20, wallet('25.00'), card)).toBe('wallet');
        expect(pickDefaultSource(20, wallet('20.00'), card)).toBe('wallet');
        expect(pickDefaultSource(20, wallet('19.99'), card)).toBe('card-1');
        expect(pickDefaultSource(20, null, card)).toBe('card-1');
        expect(pickDefaultSource(20, wallet('0'), null)).toBeNull();
    });

    it('with no price yet, any balance counts', () => {
        expect(walletCovers(wallet('1.00'), null)).toBe(true);
        expect(walletCovers(wallet('0'), null)).toBe(false);
    });

    it('computes the shortfall in cents', () => {
        expect(shortfall(40, wallet('12.35'))).toBe(27.65);
        expect(shortfall(40, wallet('50'))).toBe(0);
    });

    it('proposes the shortfall as the top-up, within billing limits', () => {
        expect(suggestedTopUp(40, wallet('12.35'))).toBe('27.65');
        expect(suggestedTopUp(20, wallet('18.00'))).toBe('5.00');
        expect(suggestedTopUp(900, wallet('0'))).toBe('500.00');
    });

    it('accepts a typed top-up only between 5 and 500', () => {
        expect(parseTopUp('20')).toBe('20.00');
        expect(parseTopUp('$27.65')).toBe('27.65');
        expect(parseTopUp('4.99')).toBeNull();
        expect(parseTopUp('501')).toBeNull();
        expect(parseTopUp('abc')).toBeNull();
    });
});
