import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pricingDAO } from '../dao/PricingDAO';
import type { VehicleIssue, VehicleIssueSnapshot } from '../dao/interfaces';
import { getLanguageId, translatedName } from './catalogTranslations';

/**
 * The text a request shows under "Assistance needed", in the viewer's language.
 *
 * The request's `title` stores the catalog names in whatever language the
 * customer's catalog had, so it cannot be translated for the mechanic. The
 * request's issue snapshots carry the catalog ids, and the catalog carries the
 * translations, so the name is resolved from those instead.
 */

let issuesById: Promise<Map<string, VehicleIssue>> | null = null;

function loadCatalog(): Promise<Map<string, VehicleIssue>> {
    const pending = issuesById ?? pricingDAO.getVehicleIssueCatalog().then((categories) => {
        const map = new Map<string, VehicleIssue>();
        categories.forEach((category) => category.issues.forEach((issue) => map.set(issue.id, issue)));
        return map;
    });
    issuesById = pending;
    // A failed fetch must not stick for the rest of the session.
    pending.catch(() => { if (issuesById === pending) issuesById = null; });
    return pending;
}

const snapshotsByRequest = new Map<string, Promise<VehicleIssueSnapshot[]>>();

function loadSnapshots(requestId: string): Promise<VehicleIssueSnapshot[]> {
    let pending = snapshotsByRequest.get(requestId);
    if (!pending) {
        pending = pricingDAO.getRequestIssues(requestId);
        snapshotsByRequest.set(requestId, pending);
        pending.catch(() => snapshotsByRequest.delete(requestId));
    }
    return pending;
}

/**
 * Translated issue names of a request, comma-joined. Empty until resolved, and
 * empty when the request has no issues or either lookup fails — callers fall
 * back to the request's notes / title.
 */
export function useRequestIssueLabel(requestId?: string): string {
    const { i18n } = useTranslation();
    const [label, setLabel] = useState('');

    useEffect(() => {
        if (!requestId) return;
        let cancelled = false;
        (async () => {
            try {
                const [snapshots, catalog, languageId] = await Promise.all([
                    loadSnapshots(requestId),
                    loadCatalog(),
                    getLanguageId(i18n.language),
                ]);
                const names = snapshots
                    .map((s) => {
                        const issue = catalog.get(s.vehicleIssueId);
                        return issue ? translatedName(issue, languageId) : s.name;
                    })
                    .filter(Boolean);
                if (!cancelled) setLabel(Array.from(new Set(names)).join(', '));
            } catch {
                if (!cancelled) setLabel('');
            }
        })();
        return () => { cancelled = true; };
    }, [requestId, i18n.language]);

    return label;
}
