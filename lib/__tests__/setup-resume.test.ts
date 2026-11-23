import { getSetupResumeRoute } from '@/lib/setup-resume';

describe('getSetupResumeRoute', () => {
    it('resumes after the last recorded step', () => {
        expect(getSetupResumeRoute({ lastStep: 'otp', phone: {}, otp: {} })).toBe('/setup/role-selection');
        expect(getSetupResumeRoute({ lastStep: 'basicInfo', role: { role: 'user' }, basicInfo: {} })).toBe('/setup/address');
    });

    it('goes by the furthest step with data when lastStep went back (a screen was reopened and continued again)', () => {
        const progress = { lastStep: 'basicInfo', role: { role: 'mechanic' as const }, basicInfo: {}, identity: { skipped: true }, address: {} };
        expect(getSetupResumeRoute(progress)).toBe('/setup/credentials');
    });

    it('has nothing to resume without a recorded step', () => {
        expect(getSetupResumeRoute({ lastStep: '' })).toBeNull();
    });
});
