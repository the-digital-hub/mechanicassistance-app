/** Preset "what stood out" options, the same step in every rating form: stars, then these, then the free text. */
export const OWNER_REVIEW_TAGS = ['on_time', 'professional', 'fair_price', 'clear_explanation', 'friendly'] as const;
export const CLIENT_REVIEW_TAGS = ['punctual', 'clear_description', 'respectful', 'easy_access'] as const;

/**
 * `POST /appointments/:id/client-review` is documented as `{rating, review?}` and its DTO whitelists fields
 * (`forbidNonWhitelisted`), so sending `experienceTags` could be a 400. Flip to true once the backend accepts it
 * (see docs/backlog-backend.md); until then the technician still picks options, but only stars and text are sent.
 */
export const SEND_CLIENT_REVIEW_TAGS = false;
