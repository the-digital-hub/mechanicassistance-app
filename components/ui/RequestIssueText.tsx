import React from 'react';
import { Text } from 'react-native';
import { useRequestIssueLabel } from '@/lib/i18n/requestIssueLabel';

interface Props {
    requestId?: string;
    /** Shown while the issue names load, and when the request has none. */
    fallback?: string;
    className?: string;
}

/** A request's issue names in the viewer's language (see `requestIssueLabel`). */
export function RequestIssueText({ requestId, fallback, className }: Props) {
    const label = useRequestIssueLabel(requestId);
    return <Text className={className}>{label || fallback}</Text>;
}
