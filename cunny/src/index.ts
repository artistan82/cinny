
import express from "express";
import cors from "cors";
import webpush from "web-push";
import { addSubscription, getSubscriptions, removeSubscription, getSubscriptionByUserDevice, getSubscriptionByEndpoint, getSubscriptionsByUser, enqueuePushJob, getPendingQueue, getJobById, cancelJob, requeueJob } from "./db.js";
import { logInfo, logWarn, logError, logAudit } from "./logger.js";
import { ensureInitialized, getVapidData as getVapidDetails } from "./init.js";
import { pushAuthMiddleware, adminAuthMiddleware } from "./auth.js";
import { rotatePushSecret as rotatePushSecretInternal, rotateAdminKey as rotateAdminKeyInternal, revokeAdminKeyById as revokeAdminKeyInternal, listAdminKeys as listAdminKeysInternal } from "./secretManager.js";
import { Worker } from 'worker_threads';

let pushWorker: Worker | null = null;
let inProcessWorkerStop: (() => Promise<void>) | null = null;
let workerInProcess = false;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

ensureInitialized();

const vapidDetails = getVapidDetails();
webpush.setVapidDetails(
    `mailto:${vapidDetails.email}`,
    vapidDetails.publicKey,
    vapidDetails.privateKey
);

app.get("/vapidPublicKey", (req, res) => {
    res.json({ publicKey: vapidDetails.publicKey });
});

app.post("/subscribe", (req, res) => {
    const { user_id, device_id, endpoint, keys } = req.body;
    if (!user_id || !endpoint || !keys) {
        return res.status(400).json({ error: "missing user_id, endpoint, or keys" });
    }
    const result = addSubscription({ user_id, device_id, endpoint, keys });
    if (result.success) {
        res.status(201).json({ message: "subscribed" });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.post("/unsubscribe", (req, res) => {
    const { endpoint } = req.body;
    const result = removeSubscription(endpoint);
    if (result.success) {
        res.json({ message: "unsubscribed" });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.post("/sendNotification", async (req, res) => {
    const { user_id, payload } = req.body;
    if (!user_id || !payload) {
        return res.status(400).json({ error: "missing user_id or payload" });
    }
    const subscriptions = getSubscriptions().filter(sub => sub.user_id === user_id);
    if (subscriptions.length === 0) {
        return res.status(404).json({ error: "no subscriptions found for user" });
    }
    let results = [];
    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
            results.push({ endpoint: sub.endpoint, success: true });
        } catch (error) {
            results.push({ endpoint: sub.endpoint, error: error instanceof Error ? error.message : String(error) });
        }
    }
    res.json({ results });
});

// List all subscriptions (debug)
app.get("/subscriptions", adminAuthMiddleware, (req, res) => {
    res.json(getSubscriptions());
});

// List subscriptions for a specific user (debug)
app.get("/subscriptions/:user_id", adminAuthMiddleware, (req, res) => {
    const userId = req.params.user_id;
    if (!userId) return res.status(400).json({ error: "missing user_id" });
    res.json(getSubscriptionsByUser(userId));
});

app.post("/admin/rotate-push", adminAuthMiddleware, (req, res) => {
    const entry = rotatePushSecretInternal();
    logAudit("rotate-push", { id: entry.id }, req.ip || req.socket?.remoteAddress);
    res.json({ pushGatewaySecret: entry.secret, id: entry.id, created_at: entry.created_at });
});

app.post("/admin/rotate-admin", adminAuthMiddleware, (req, res) => {
    // optional query param ?append=false to replace keys instead of appending
    const append = req.query.append !== 'false';
    const entry = rotateAdminKeyInternal(append);
    logAudit("rotate-admin", { id: entry.id }, req.ip || req.socket?.remoteAddress);
    res.json({ adminKey: entry.key, id: entry.id, created_at: entry.created_at });
});

app.post("/admin/revoke-admin", adminAuthMiddleware, (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "missing id" });
    const result = revokeAdminKeyInternal(id);
    logAudit("revoke-admin", { id }, req.ip || req.socket?.remoteAddress);
    res.json(result);
});

app.get("/admin/keys", adminAuthMiddleware, (req, res) => {
    res.json(listAdminKeysInternal());
});

app.get("/_matrix/push/v1/health", (req, res) => {
    res.json({ status: "ok" });
});

app.post("/_matrix/push/v1/notify", pushAuthMiddleware, async (req, res) => {
    const body = req.body;
    if (!body || !Array.isArray(body.devices) || !body.event) {
        return res.status(400).json({ error: "invalid payload" });
    }
    let queued = 0;
    for (const device of body.devices) {
        const { user_id, device_id, data } = device;
        let subscription = null as any;
        if (user_id && device_id) {
            const stored = getSubscriptionByUserDevice(user_id, device_id);
            if (stored) subscription = { endpoint: stored.endpoint, keys: stored.keys };
        }
        if (!subscription) subscription = data?.webpush;
        if (!subscription) continue;

        enqueuePushJob({ user_id, device_id, endpoint: subscription.endpoint, keys: subscription.keys, payload: body.event });
        queued++;
    }

    res.json({ queued });
});

app.get('/admin/queue', adminAuthMiddleware, (req, res) => {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const rows = getPendingQueue(limit);
    res.json(rows.map(r => ({ id: r.id, user_id: r.user_id, device_id: r.device_id, endpoint: r.endpoint, attempts: r.attempts, max_attempts: r.max_attempts, next_try_at: r.next_try_at, last_attempt_at: r.last_attempt_at, status_code: r.status_code, error_text: r.error_text, created_at: r.created_at })));
});

app.get('/admin/queue/:id', adminAuthMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const job = getJobById(id);
    if (!job) return res.status(404).json({ error: 'not found' });
    res.json(job);
});

app.post('/admin/queue/:id/cancel', adminAuthMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    cancelJob(id);
    logAudit('queue-cancel', { id }, req.ip || req.socket?.remoteAddress);
    res.json({ ok: true });
});

app.post('/admin/queue/:id/requeue', adminAuthMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const delay = parseInt(String(req.body?.delayMs || 0), 10) || 0;
    requeueJob(id, delay);
    logAudit('queue-requeue', { id, delay }, req.ip || req.socket?.remoteAddress);
    res.json({ ok: true });
});

const _server = app.listen(port, async () => {
    (app as any).locals = (app as any).locals || {};
    (app as any).locals.serverInstance = _server;
    logInfo("server", `Server running on http://localhost:${port}`);
    try {
        const url = new URL('./pushWorker.js', import.meta.url).href;
        const mod = await import(url) as any;
        if (typeof mod?.stop === 'function') inProcessWorkerStop = () => mod.stop();
        workerInProcess = true;
        logInfo('worker', 'Push worker started in-process');
    } catch (err) {
        logError('worker', `Failed to start push worker via dynamic import ./pushWorker.js: ${err instanceof Error ? err.message : String(err)}`);
    }
});

const server = app.listen as unknown;

async function gracefulShutdown(signal: string) {
    try {
        logInfo('shutdown', `Received ${signal}, starting graceful shutdown`);

        if (pushWorker) {
            try {
                pushWorker.postMessage('stop');
                const wait = new Promise<void>((resolve) => {
                    const t = setTimeout(() => resolve(), 5000);
                    pushWorker?.once('exit', () => { clearTimeout(t); resolve(); });
                });
                await wait;
                logInfo('shutdown', 'Worker thread stopped');
            } catch (e) {
                logWarn('shutdown', `Error stopping worker thread: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (workerInProcess && inProcessWorkerStop) {
            try {
                await Promise.race([inProcessWorkerStop(), new Promise<void>(r => setTimeout(r, 5000))]);
                logInfo('shutdown', 'In-process worker stopped');
            } catch (e) {
                logWarn('shutdown', `Error stopping in-process worker: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        try {
            const srv = (app as any).locals?.serverInstance || null;
            if (srv && typeof srv.close === 'function') {
                await new Promise<void>((resolve, reject) => srv.close((err: any) => err ? reject(err) : resolve()));
                logInfo('shutdown', 'HTTP server closed');
            }
        } catch (e) {
            logWarn('shutdown', `Error closing HTTP server: ${e instanceof Error ? e.message : String(e)}`);
        }

        logInfo('shutdown', 'Graceful shutdown complete, exiting');
        process.exit(0);
    } catch (err) {
        logError('shutdown', `Shutdown failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
