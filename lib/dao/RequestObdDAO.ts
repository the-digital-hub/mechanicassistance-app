import { apiClient } from '../api/apiClient';
import { mediaDAO } from './MediaDAO';
import type { ObdCode, ObdStatus } from './OnSiteDAO';

/**
 * The OBD scanner report a vehicle owner attaches to a video-call request
 * (a photo of the scanner's screen, or a screenshot / PDF from an OBD app).
 * Read in the background by the document service, like an on-site report;
 * an `obd_update` socket event with `scope: 'request'` says when it changes.
 */
export interface RequestObdReport {
    requestId: string;
    status: ObdStatus;
    codeCount: number;
    /** A mechanic browsing an open request only gets the status and the count. */
    summaryOnly: boolean;
    codes: ObdCode[];
    vin: string | null;
    /** True when the report's VIN is another vehicle's. A warning only. */
    vinMismatch: boolean | null;
    documentKey: string | null;
    updatedAt: string | null;
}

/** A short-lived address that opens the report file. Ask again when it expires; never store it. */
export interface RequestObdFileLink {
    /** Service-relative (`/uploads/…?exp=…&sig=…`); pass it through `absoluteMediaUrl`. */
    url: string;
    expiresAt: string;
    fileName: string;
}

/** A file picked in the wizard, uploaded once the request exists. */
export interface PendingObdFile {
    uri: string;
    name?: string;
    mimeType?: string;
}

const base = (requestId: string) => `/api/assistance/${requestId}/obd`;

class RequestObdDAO {
    get(requestId: string): Promise<RequestObdReport> {
        return apiClient.get(base(requestId));
    }

    /** Uploads the report and attaches it to the request (owner only). Replaces a previous one. */
    async attach(requestId: string, file: PendingObdFile): Promise<RequestObdReport> {
        const uploaded = await mediaDAO.uploadDocument(file.uri, {
            name: file.name,
            mimeType: file.mimeType,
            documentType: 'obd',
        });
        return apiClient.post(base(requestId), { documentKey: uploaded.key });
    }

    /**
     * A link to the file the owner sent. The file sits in the owner's private
     * folder, so the mechanic cannot ask media-service for it directly; this
     * checks they are on the call and has it signed for them.
     */
    fileLink(requestId: string): Promise<RequestObdFileLink> {
        return apiClient.get(`${base(requestId)}/file-link`);
    }

    /** Codes typed in by the mechanic; replaces the list. `vin` is checked against the vehicle. */
    setCodes(requestId: string, codes: string[], vin?: string): Promise<RequestObdReport> {
        return apiClient.put(`${base(requestId)}/codes`, vin ? { codes, vin } : { codes });
    }
}

export const requestObdDAO = new RequestObdDAO();
