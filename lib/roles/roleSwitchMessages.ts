import type { Router } from 'expo-router';
import type { TFunction } from 'i18next';
import { ApiError } from '@/lib/api/types';
import type { OpenWork } from '@/lib/dao/interfaces';
import { appAlert } from '@/lib/ui/appAlert';

/** Where the mechanic's blocking service stands (users-service `findBlockingJob`). */
export type BlockingJobStage =
    | 'on_the_way'
    | 'on_site'
    | 'in_progress'
    | 'awaiting_confirmation'
    | 'live_video_call';

const STAGES: readonly BlockingJobStage[] = [
    'on_the_way',
    'on_site',
    'in_progress',
    'awaiting_confirmation',
    'live_video_call',
];

export interface BlockingJob {
    appointmentId: string;
    stage: BlockingJobStage;
}

/**
 * The service that stopped a role switch, read from the 409
 * `ROLE_SWITCH_BLOCKED_BY_ACTIVE_JOB`. `null` for any other error, including
 * the old `ACTIVE_JOBS` 409 without details.
 */
export function blockingJobOf(err: unknown): BlockingJob | null {
    if (!(err instanceof ApiError) || err.statusCode !== 409) return null;
    const body = err.apiError as { code?: unknown; details?: Record<string, unknown> } | null;
    if (body?.code !== 'ROLE_SWITCH_BLOCKED_BY_ACTIVE_JOB') return null;
    const id = body.details?.appointmentId;
    const stage = body.details?.stage;
    if (typeof id !== 'string') return null;
    return {
        appointmentId: id,
        stage: STAGES.includes(stage as BlockingJobStage) ? (stage as BlockingJobStage) : 'in_progress',
    };
}

/** Message for a blocked switch: names the stage when the backend said it. */
export function blockedMessage(err: unknown, t: TFunction): string {
    const job = blockingJobOf(err);
    if (!job) return t('profile.switchRole.activeJobsMessage');
    return t('profile.switchRole.blockedMessage', { stage: t(`profile.switchRole.stage_${job.stage}`) });
}

/** Alert for a blocked switch, with a button to open the service when known. */
export function alertRoleSwitchBlocked(err: unknown, t: TFunction, router: Router): void {
    const job = blockingJobOf(err);
    appAlert(
        t('profile.switchRole.activeJobsTitle'),
        blockedMessage(err, t),
        job
            ? [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                      text: t('profile.switchRole.blockedOpen'),
                      onPress: () =>
                          router.push({ pathname: '/appointments/[id]', params: { id: job.appointmentId } }),
                  },
              ]
            : undefined,
    );
}

/** Reminder of what the role just left still has open. Nothing when empty. */
export function alertOpenWork(openWork: OpenWork | undefined, t: TFunction, locale?: string): void {
    if (!openWork) return;
    const lines: string[] = [];
    if (openWork.ownerRequestsOpen > 0) {
        lines.push(t('profile.switchRole.ownerRequestsOpen', { count: openWork.ownerRequestsOpen }));
    }
    const next = openWork.upcomingMechanicJobs[0];
    if (next) {
        const when = next.date ? new Date(next.date) : null;
        lines.push(
            when && !Number.isNaN(when.getTime())
                ? t('profile.switchRole.upcomingMechanicJob', {
                      date: when.toLocaleString(locale, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                      }),
                  })
                : t('profile.switchRole.upcomingMechanicJobNoDate'),
        );
    }
    if (lines.length > 0) appAlert(t('profile.switchRole.openWorkTitle'), lines.join('\n\n'));
}
