import { parentPort } from 'worker_threads';
import webpush from 'web-push';
import { ensureInitialized } from './init.js';
import { logInfo, logWarn, logError } from './logger.js';

// Ensure the worker has its own DB connection and secrets loaded.
// init.ensureInitialized will create/open the database and prepare data files.
ensureInitialized();

// Dynamically import DB helpers after initialization so they get a valid `db` instance.
const dbModule = await import('./db.js') as any;
const { fetchDuePushJobs, markPushJobAttempted, removePushJob, getSubscriptionByEndpoint, removeSubscription, recordJobError, markJobFailed } = dbModule;

const POLL_INTERVAL_MS = parseInt(process.env.PUSH_WORKER_POLL_MS || '2000', 10);
const FETCH_LIMIT = parseInt(process.env.PUSH_WORKER_FETCH_LIMIT || '20', 10);
const MAX_CONCURRENCY = Math.max(1, parseInt(process.env.PUSH_WORKER_CONCURRENCY || '4', 10));

let running = true;
let active = 0;

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function processJob(job: any) {
    active++;
    try {
        const subscription = { endpoint: job.endpoint, keys: job.keys };
        try {
            await webpush.sendNotification(subscription, JSON.stringify(job.payload));
            removePushJob(job.id);
            logInfo('', `Delivered job ${job.id} to ${job.endpoint}`);
        } catch (err) {
            const errAny: any = err;
            const status = errAny?.statusCode || errAny?.status || undefined;
            if (status === 404 || status === 410) {
                removeSubscription(job.endpoint);
                removePushJob(job.id);
                logInfo('', `Removed invalid subscription ${job.endpoint} (job ${job.id})`);
            } else {
                const attempts = (job.attempts || 0) + 1;
                try {
                    const msg = errAny?.message || String(errAny);
                    const code = typeof status === 'number' ? status : undefined;
                    const text = `message=${msg}` + (errAny?.body ? ` body=${JSON.stringify(errAny.body)}` : '');
                    recordJobError(job.id, text, code);
                } catch (recErr) {
                    logWarn('', `Failed to record job error for ${job.id}: ${recErr instanceof Error ? recErr.message : String(recErr)}`);
                }
                if (attempts >= (job.max_attempts || 5)) {
                    try {
                        const code = typeof status === 'number' ? status : undefined;
                        const structured = `message=${errAny?.message || String(errAny)}` + (errAny?.body ? ` body=${JSON.stringify(errAny.body)}` : '');
                        markJobFailed(job.id, attempts, structured, code);
                    } catch (mErr) {
                        logWarn('', `Failed to mark job ${job.id} as failed: ${mErr instanceof Error ? mErr.message : String(mErr)}`);
                        removePushJob(job.id);
                    }
                    logWarn('', `Job ${job.id} permanently failed after ${attempts} attempts: ${errAny?.message || String(errAny)}`);
                } else {
                    const baseMs = 1000 * Math.pow(2, attempts - 1);
                    const jitter = Math.floor(Math.random() * 1000);
                    const nextTry = new Date(Date.now() + baseMs + jitter).toISOString();
                    markPushJobAttempted(job.id, attempts, nextTry);
                    logWarn('', `Job ${job.id} attempt ${attempts} failed, scheduling retry at ${nextTry}`);
                }
            }
        }
    } finally {
        active--;
    }
}

async function loop() {
    while (running) {
        if (active >= MAX_CONCURRENCY) {
            await sleep(200);
            continue;
        }

        const slots = Math.max(1, MAX_CONCURRENCY - active);
        const jobs = fetchDuePushJobs(Math.min(FETCH_LIMIT, slots));
        if (jobs.length === 0) {
            await sleep(POLL_INTERVAL_MS);
            continue;
        }

        for (const job of jobs) {
            processJob(job).catch(err => logError('push-worker', `processJob error: ${err instanceof Error ? err.message : String(err)}`));
        }

        await sleep(10);
    }
}

const donePromise = (async () => {
    try {
        await loop();
        logInfo('shutdown', 'worker loop completed, exiting');
    } catch (err) {
        logError('', `worker loop crashed: ${err instanceof Error ? err.message : String(err)}`);
    }
})();


export function stop() {
    running = false;
    return donePromise;
}

if (parentPort) {
    parentPort.on('message', (m) => {
        if (m === 'stop') running = false;
    });
}
