jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('@/context/VerificationContext', () => ({ useVerification: jest.fn() }));
jest.mock('@/lib/dao/CertificationsDAO', () => ({ certificationsDAO: { list: jest.fn() } }));
jest.mock('@/lib/dao/MechanicDocumentsDAO', () => ({ mechanicDocumentsDAO: { list: jest.fn() } }));
jest.mock('@/lib/dao/PaymentMethodDAO', () => ({ paymentMethodDAO: { list: jest.fn() } }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/dao/LegalDAO', () => ({ legalDAO: { policies: jest.fn() } }));

import { buildMechanicTips, buildOwnerTips, busiestWeekday, daysSince } from '../useMechanicTips';

const complete = {
    identityApproved: true, aseVerified: true, hasHours: true,
    hasDocuments: true, hasPhoto: true, hasCertifications: true, noJobsYet: false,
};
const keys = (over: Partial<typeof complete> | Record<string, unknown>) => buildMechanicTips({ ...complete, ...over } as typeof complete).map((t) => t.key);

describe('buildMechanicTips', () => {
    it('says nothing to a technician who has everything and already works', () => {
        expect(keys({})).toEqual([]);
    });

    it('only suggests what is missing, most important first', () => {
        expect(keys({ identityApproved: false, aseVerified: false, hasHours: false })).toEqual(['identity', 'ase', 'hours']);
    });

    it('does not claim anything that is not known yet (null = still loading)', () => {
        expect(keys({ hasDocuments: null, hasCertifications: null })).toEqual([]);
    });

    it('adds the general advice only while there is no job yet', () => {
        expect(keys({ noJobsYet: true })).toEqual(['fast', 'rating']);
    });

    it('never shows more than five', () => {
        expect(keys({
            identityApproved: false, aseVerified: false, hasHours: false,
            hasDocuments: false, hasPhoto: false, hasCertifications: false, noJobsYet: true,
        })).toHaveLength(5);
    });

    it('leads to where each one is done', () => {
        const tips = buildMechanicTips({ ...complete, hasHours: false, hasPhoto: false });
        expect(tips.map((t) => t.route)).toEqual(['/(tabs)/availability', '/(tabs)/personal-info']);
    });
});


describe('the unpaid plan', () => {
    it('is the first tip of a technician whose plan is not paid, and leads to Membership with its amount', () => {
        const tips = buildMechanicTips({ ...complete, identityApproved: false, membershipDue: '$60.00' });
        expect(tips.map((t) => t.key)).toEqual(['membership', 'identity']);
        expect(tips[0]).toMatchObject({ route: '/membership', params: { amount: '$60.00' } });
    });

    it('is not there once it is paid or covered (null or absent)', () => {
        expect(buildMechanicTips({ ...complete, membershipDue: null })).toEqual([]);
        expect(buildMechanicTips({ ...complete })).toEqual([]);
    });

    it('is the first tip of an owner whose plan is not paid', () => {
        const tips = buildOwnerTips({ hasCard: false, hasVehicle: true, hasAddress: true, hasPhoto: true, noRequestsYet: false, membershipDue: '$15.00' });
        expect(tips.map((t) => t.key)).toEqual(['membership', 'card']);
        expect(tips[0]).toMatchObject({ route: '/membership', params: { amount: '$15.00' } });
        expect(buildOwnerTips({ hasCard: true, hasVehicle: true, hasAddress: true, hasPhoto: true, noRequestsYet: false, membershipDue: null })).toEqual([]);
    });
});

describe('buildOwnerTips', () => {
    const ready = { hasCard: true, hasVehicle: true, hasAddress: true, hasPhoto: true, noRequestsYet: false };

    it('says nothing to an owner who is all set and has asked before', () => {
        expect(buildOwnerTips(ready)).toEqual([]);
    });

    it('lists only what is missing, in order, each leading to where it is done', () => {
        const tips = buildOwnerTips({ ...ready, hasCard: false, hasVehicle: false, hasAddress: false });
        expect(tips.map((t) => t.key)).toEqual(['card', 'vehicle', 'address']);
        expect(tips.map((t) => t.route)).toEqual(['/payment-cards', '/(tabs)/vehicles', '/addresses']);
    });

    it('claims nothing about what is not read yet', () => {
        expect(buildOwnerTips({ ...ready, hasCard: null, hasVehicle: null })).toEqual([]);
    });

    it('adds the general advice only before the first request', () => {
        expect(buildOwnerTips({ ...ready, noRequestsYet: true }).map((t) => t.key)).toEqual(['describe', 'video']);
    });
});

describe('stages', () => {
    const profileOk = { identityApproved: true, aseVerified: true, hasHours: true, hasDocuments: true, hasPhoto: true, hasCertifications: true };

    it('points a ready technician with no jobs at the open requests', () => {
        const tips = buildMechanicTips({ ...profileOk, noJobsYet: true, openRequests: 3, hasAnyActivity: false });
        expect(tips[0]).toMatchObject({ key: 'first_offer', route: '/(tabs)/assist', params: { count: 3 } });
    });

    it('does not push a first offer on someone who already has activity or no requests around', () => {
        expect(buildMechanicTips({ ...profileOk, noJobsYet: true, openRequests: 3, hasAnyActivity: true }).map((t) => t.key)).not.toContain('first_offer');
        expect(buildMechanicTips({ ...profileOk, noJobsYet: true, openRequests: 0, hasAnyActivity: false }).map((t) => t.key)).not.toContain('first_offer');
    });

    it('in a lull, reminds them of their best day and a small service area', () => {
        const tips = buildMechanicTips({ ...profileOk, noJobsYet: false, daysSinceLastJob: 9, busiestDay: 6, radiusMiles: 10 });
        expect(tips.map((t) => t.key)).toEqual(['comeback_day', 'comeback_radius']);
        expect(tips[0].params).toEqual({ day: 6 });
    });

    it('is not a lull while jobs keep coming', () => {
        expect(buildMechanicTips({ ...profileOk, noJobsYet: false, daysSinceLastJob: 3, busiestDay: 6, radiusMiles: 10 })).toEqual([]);
    });

    it('reminds an owner who has not asked for a long time', () => {
        const owner = { hasCard: true, hasVehicle: true, hasAddress: true, hasPhoto: true, noRequestsYet: false };
        expect(buildOwnerTips({ ...owner, daysSinceLastRequest: 45 }).map((t) => t.key)).toEqual(['checkup']);
        expect(buildOwnerTips({ ...owner, daysSinceLastRequest: 10 })).toEqual([]);
    });
});

describe('behaviour helpers', () => {
    it('finds the weekday with the most jobs, only with a real pattern', () => {
        // Three Saturdays (2026-11-07, 14, 21) and one Monday.
        expect(busiestWeekday(['2026-11-07T15:00:00Z', '2026-11-14T15:00:00Z', '2026-11-21T15:00:00Z', '2026-11-16T15:00:00Z'])).toBe(6);
        expect(busiestWeekday(['2026-11-07T15:00:00Z', '2026-11-14T15:00:00Z'])).toBeNull();
        expect(busiestWeekday(['2026-11-02T15:00:00Z', '2026-11-11T15:00:00Z', '2026-11-20T15:00:00Z'])).toBeNull();
    });

    it('counts whole days since a date', () => {
        const now = Date.UTC(2026, 10, 23, 12);
        expect(daysSince('2026-11-13T12:00:00Z', now)).toBe(10);
        expect(daysSince(undefined, now)).toBeNull();
        expect(daysSince('not a date', now)).toBeNull();
    });
});

describe('a legal text with a new version to accept', () => {
    it('comes first for a technician, and only while it is pending', () => {
        expect(keys({ identityApproved: false, policyPending: true })).toEqual(['policy', 'identity']);
        expect(keys({ policyPending: false })).toEqual([]);
        const tip = buildMechanicTips({ ...complete, policyPending: true })[0];
        expect(tip).toMatchObject({ key: 'policy', i18n: 'policy', route: '/privacy' });
    });

    it('comes first for an owner too', () => {
        const owner = { hasCard: false, hasVehicle: true, hasAddress: true, hasPhoto: true, noRequestsYet: false };
        expect(buildOwnerTips({ ...owner, policyPending: true }).map((t) => t.key)).toEqual(['policy', 'card']);
        expect(buildOwnerTips({ ...owner, hasCard: true, policyPending: false })).toEqual([]);
    });
});
