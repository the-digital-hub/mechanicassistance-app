/**
 * Typography standard for question / option screens (issue selection, vehicle
 * condition, vehicle selection…). Use these instead of ad-hoc font sizes.
 * Font family comes from the `font-outfit-*` class: bold for question, group
 * and option titles; regular for values and helper text.
 */
/**
 * App-wide scale (px). Do not introduce sizes outside it:
 *   12 eyebrow/uppercase labels only (with letter spacing) · 13 caption · 14 helper
 *   15 compact title · 16 body · 16.5 option · 17 question / card title · 18 group / button
 *   20 section title (above a block of cards) · 22 · 24–26 screen titles · 28–34 hero numbers.
 * Nothing below 13 except eyebrows. Half sizes (13.5, 14.5, 15.5) are not used.
 */
export const TYPE = {
    /** Uppercase label with letter spacing (badges, "ADDITIONAL SERVICES"). */
    eyebrow: { fontSize: 12, letterSpacing: 1.2 },
    /** Heading above a block of cards or rows ("Your request", "Active job"). */
    section: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
    /** Title inside a card ("What's included", "Checklist"). */
    cardTitle: { fontSize: 17, lineHeight: 23 },
    /** Group / category heading ("Starting & electrical"). */
    group: { fontSize: 18, lineHeight: 24 },
    /** The question a screen asks ("What condition is the vehicle in?"). */
    question: { fontSize: 17, lineHeight: 23 },
    /** A selectable option or list item. */
    option: { fontSize: 16.5, lineHeight: 22 },
    /** Secondary list item (symptoms, nested rows) and typed input text. */
    body: { fontSize: 16, lineHeight: 22 },
    /** Helper text under a field or option. */
    helper: { fontSize: 14, lineHeight: 20 },
    /** Primary button label. */
    button: { fontSize: 18, lineHeight: 24 },
    /** Chips, counters, "(optional)" tags. */
    caption: { fontSize: 13, lineHeight: 18 },
} as const;
