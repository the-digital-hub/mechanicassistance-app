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
  it("leaves the point out when the address has no coordinates", () => {
    const location = baseLocationFromAddresses([
      { id: "a", street: "1 Main St", city: "Austin", state: "TX" },
    ]);
    expect(location?.address).toBe("1 Main St · Austin, TX");
    expect(location?.latitude).toBeUndefined();
    expect(location?.longitude).toBeUndefined();
  });

  it("prefers the address marked as service base", () => {
    const location = baseLocationFromAddresses([
      { id: "a", street: "1 Main St", locationLat: 1, locationLng: 1 },
      { id: "b", street: "2 Shop Rd", locationLat: 2, locationLng: 2, isServiceBase: true },
    ]);
    expect(location).toMatchObject({ address: "2 Shop Rd", latitude: 2, longitude: 2 });
  });

  it("skips the vehicle-owner home and addresses off the map", () => {
    const location = baseLocationFromAddresses([
      { id: "a", street: "1 Home Ave", role: "user", locationLat: 1, locationLng: 1 },
      { id: "b", street: "2 No Point St", role: "mechanic" },
      { id: "c", street: "3 Shop Rd", role: "mechanic", locationLat: 3, locationLng: 3 },
    ]);
    expect(location).toMatchObject({ address: "3 Shop Rd", latitude: 3 });
  });

  it("returns null without a street", () => {
    expect(baseLocationFromAddresses([])).toBeNull();
    expect(baseLocationFromAddresses([{ id: "a", city: "Austin" }])).toBeNull();
  });
});
