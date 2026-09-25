import {
  availabilityFromUser,
  baseLocationFromAddresses,
} from "../availabilityUtils";

const row = (day: string, startTime: string, endTime: string) => ({
  id: day,
  day,
  startTime,
  endTime,
});

describe("availabilityFromUser", () => {
  it("keeps the form defaults when nothing was saved", () => {
    expect(availabilityFromUser({})).toEqual({});
  });

  it("collapses identical hours into the week-wide pair, in week order", () => {
    const value = availabilityFromUser({
      mechanicAvailabilities: [
        row("Wednesday", "08:00", "16:00"),
        row("Monday", "08:00", "16:00"),
      ],
      mechanicDetails: { id: "m", serviceRadiusMiles: 30 },
    });

    expect(value).toEqual({
      serviceRadius: 30,
      selectedDays: ["Monday", "Wednesday"],
      startTime: "08:00",
      endTime: "16:00",
      applySameTime: true,
    });
  });

  it("reopens per day when the hours differ, trimming seconds", () => {
    const value = availabilityFromUser({
      mechanicAvailabilities: [
        row("Monday", "09:00:00", "17:00:00"),
        row("Saturday", "10:00", "14:00"),
      ],
    });

    expect(value.applySameTime).toBe(false);
    expect(value.schedule).toEqual([
      { day: "Monday", startTime: "09:00", endTime: "17:00" },
      { day: "Saturday", startTime: "10:00", endTime: "14:00" },
    ]);
  });

  it("skips rows without usable times", () => {
    const value = availabilityFromUser({
      mechanicAvailabilities: [{ id: "x", day: "Monday" }],
    });
    expect(value).toEqual({});
  });
});

describe("baseLocationFromAddresses", () => {
  it("uses the first address and falls back when coordinates are missing", () => {
    const location = baseLocationFromAddresses([
      { id: "a", street: "1 Main St", city: "Austin", state: "TX" },
    ]);
    expect(location?.address).toBe("1 Main St · Austin, TX");
    expect(typeof location?.latitude).toBe("number");
  });

  it("returns null without a street", () => {
    expect(baseLocationFromAddresses([])).toBeNull();
    expect(baseLocationFromAddresses([{ id: "a", city: "Austin" }])).toBeNull();
  });
});
