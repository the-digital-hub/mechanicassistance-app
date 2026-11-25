/** Preset "what stood out" options, the same step in every rating form: stars, then these, then the free text. */
export const OWNER_REVIEW_TAGS = ['on_time', 'professional', 'fair_price', 'clear_explanation', 'friendly'] as const;
export const CLIENT_REVIEW_TAGS = ['punctual', 'clear_description', 'respectful', 'easy_access'] as const;

/**
 * `POST /appointments/:id/client-review` accepts `experienceTags` (backend, 25-nov, AI). It was off while its DTO (`forbidNonWhitelisted`)
 * could have answered 400; set it back to false if an older backend ever has to be served.
 */
export const SEND_CLIENT_REVIEW_TAGS = true;
