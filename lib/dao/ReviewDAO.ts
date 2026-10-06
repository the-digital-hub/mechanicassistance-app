import { apiClient } from '../api/apiClient';
import { ApiError } from '../api/types';

// The customer's review of the mechanic (appointments-service src/reviews/).
// One per appointment; only the customer on the appointment may leave it.

export interface MechanicReview {
    id: string;
    appointmentId: string;
    rating: number | null;
    review: string | null;
    experienceTags: string | null;
}

class ReviewDAOImpl {
    /** The review left for this job, or null if nobody has reviewed it yet. */
    async get(appointmentId: string): Promise<MechanicReview | null> {
        try {
            return await apiClient.get<MechanicReview>(`/api/appointments/${appointmentId}/review`);
        } catch (e) {
            if (e instanceof ApiError && e.statusCode === 404) return null;
            throw e;
        }
    }

    /** Sends the review. A 409 means it was already reviewed. */
    submit(appointmentId: string, rating: number, review?: string, tags: string[] = []): Promise<MechanicReview> {
        return apiClient.post(`/api/appointments/${appointmentId}/review`, {
            rating,
            ...(review ? { review } : {}),
            ...(tags.length ? { experienceTags: tags.join(',') } : {}),
        });
    }
}

export const reviewDAO = new ReviewDAOImpl();
