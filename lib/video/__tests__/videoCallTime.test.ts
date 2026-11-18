import { videoCallBookedLabel, videoCallZones } from '../videoCallTime';

const OLD_TZ = process.env.TZ;

describe('video call times across time zones', () => {
    // The device zone is New York in these tests.
    beforeAll(() => { process.env.TZ = 'America/New_York'; });
    afterAll(() => { process.env.TZ = OLD_TZ; });

    const slot = '2026-11-19T20:00:00.000Z'; // 3:00 PM in New York, 2:00 PM in Chicago, 12:00 PM in Los Angeles

    it('a "now" call that already happened says when, not "now"', () => {
        const done = '2026-11-18T20:15:00Z';
        expect(videoCallBookedLabel({ date: '2026-11-18T20:00:00Z', startNow: true }, 'en-US')).toBeNull();
        expect(videoCallBookedLabel({ date: '2026-11-18T20:00:00Z', startNow: true, startedAt: done }, 'en-US')).toMatch(/3:15 PM/);
        expect(videoCallBookedLabel({ startNow: true, completedAt: done }, 'en-US')).toMatch(/Nov 18/);
    });

    it('names the zone on a booked call', () => {
        expect(videoCallBookedLabel({ date: slot }, 'en-US')).toMatch(/3:00 PM/);
        expect(videoCallBookedLabel({ date: slot }, 'en-US')).toMatch(/E[SD]T|GMT-5/);
    });

    it('says nothing for a call asked for now', () => {
        expect(videoCallZones({ date: slot, startNow: true }, 'en-US')).toBeNull();
        expect(videoCallZones({ date: null }, 'en-US')).toBeNull();
    });

    it('shows no second clock when the owner is in the same zone or unknown', () => {
        expect(videoCallZones({ date: slot, timezone: 'America/New_York' }, 'en-US')?.theirs).toBeNull();
        expect(videoCallZones({ date: slot }, 'en-US')?.theirs).toBeNull();
    });

    it('shows both clocks when the owner booked from another zone', () => {
        const zones = videoCallZones({ date: slot, timezone: 'America/Los_Angeles' }, 'en-US');
        expect(zones?.mine).toMatch(/3:00 PM/);
        expect(zones?.theirs).toMatch(/12:00 PM/);
    });

    it('ignores a zone the runtime does not know', () => {
        expect(videoCallZones({ date: slot, timezone: 'Mars/Olympus' }, 'en-US')?.theirs).toBeNull();
    });
});
