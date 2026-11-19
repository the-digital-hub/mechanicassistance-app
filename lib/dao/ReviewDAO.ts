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

/** One rating in `GET /reviews/me`: what was written about the signed-in person, with no data of the author. */
export interface MyReview {
    id: string;
    appointmentId: string;
    rating: number;
    review: string | null;
    experienceTags: string[];
    /** ISO date the job closed. */
    createdAt: string;
    serviceTitle: string | null;
    vehicle: string | null;
}

export interface MyReviewsPage {
    items: MyReview[];
    total: number;
    page: number;
    limit: number;
    average: number | null;
    count: number;
}

class ReviewDAOImpl {
    /**
     * The ratings behind the profile's stars, newest first. A technician reads what their customers wrote; anyone
     * else reads what technicians wrote about them.
     */
    mine(page = 1, limit = 20): Promise<MyReviewsPage> {
        return apiClient.get<MyReviewsPage>('/api/reviews/me', { page, limit });
    }

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
