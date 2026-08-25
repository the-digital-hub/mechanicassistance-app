# Mechanic availability: what the wizard collects and what survives

Audit of `app/setup/availability.tsx` against `users-service` / `profile-service`
and against the production database. Read this before changing the availability
step or building anything on top of the schedule.

## The contract

| Field | Wire format | Lands in |
|---|---|---|
| `selectedDays` | `["Monday", …]`, English weekday names | one `mechanic_availability` row per day |
| `startTime` / `endTime` | **`HH:mm`, 24-hour** (`"09:00"`, `"17:00"`) | `mechanic_availability.startTime` / `.endTime` |
| `schedule` | `[{day, startTime, endTime}]` | one row per entry; **wins over `selectedDays`** |
| `serviceRadius` | integer, 1–50 miles | `mechanic_details.serviceRadiusMiles` |
| `applySameTime` | boolean | nothing — accepted and ignored |

Times are naive local strings: there is no timezone column and no UTC
conversion anywhere in the stack. A mechanic's "09:00" means 09:00 wherever they
are, and two mechanics in different zones are not comparable.

`HH:mm` 24-hour is the canon on the wire and in the column. The 12-hour form
exists only in the picker UI (`formatTime12h`), and is never persisted.
`profile-service` enforces the format with `@Matches`; `users-service` enforces
it through `AvailabilityDto`.

## Persistence paths

Two, and they are not interchangeable:

1. **During signup** — the step writes to AsyncStorage, and `UserDAO.register`
   folds it into `POST /api/users`. This is the only path the wizard can use: a
   signup-scoped token is rejected on `/api/mechanic-availability` (it is not in
   `SIGNUP_SCOPED_ROUTES`), because the account does not exist yet.
2. **After signup** — `POST /api/mechanic-availability`, one slot per call,
   upserting on `(userId, day)`. Scoped to the caller's own schedule; the
   `userId` in the body is ignored and a mismatch is refused.

`PATCH /api/users/:id` replaces the whole week (`deleteMany` + `create`), so a
day the mechanic unselects disappears rather than lingering.

## Availability is write-only

**No service reads `mechanicAvailabilities` to decide anything.** It is written
at registration, returned in the user profile, and otherwise unused:
`appointments-service` never consults it when matching or fanning out assistance
requests. A mechanic outside their own stated hours is offered work exactly like
one inside them.

Two consequences worth knowing before relying on the data:

- Most mechanics in production have no availability rows at all — the step is
  skippable and nothing gates on it.
- Nothing has ever validated the schedule semantically beyond format and range.

If the assist feed should respect the schedule, that is a product decision that
has not been made, not a bug in this step.

## What the screen does not do

It never reads existing availability back. `GET /api/users/:id` returns
`mechanicAvailabilities`, but the screen always re-initialises to Mon–Fri
09:00–17:00. Re-entering the step therefore shows defaults, not what was saved.
Hydrating from the API is deliberately unimplemented.

## History

Before the fix, the screen sent 12-hour strings (`"09:00 AM"`) into a column the
API documented as 24-hour and did not validate, so production accumulated both
formats in the same column and the values could not be compared or ordered. The
service-radius slider travelled in the payload with nowhere to land. There was
no ownership check on any `/api/mechanic-availability` route, and no index or
unique constraint on `mechanic_availability`.

Migrations `0004_availability_time_format_and_radius.sql` (normalise + radius
column + indexes) and `0005_prune_non_mechanic_availability.sql` (drop rows on
non-mechanic accounts) live in `users-service/prisma/manual-migrations/`.
