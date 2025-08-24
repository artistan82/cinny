
import express from "express";
import cors from "cors";
import webpush from "web-push";
import { addSubscription, getSubscriptions, removeSubscription, getSubscriptionByUserDevice, getSubscriptionByEndpoint, getSubscriptionsByUser } from "./db.js";
import { logInfo, logWarn, logError } from "./logger.js";
import { ensureInitialized, getVapidData as getVapidDetails } from "./init.js";
import { pushAuthMiddleware, adminAuthMiddleware } from "./auth.js";

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

app.get("/_matrix/push/v1/health", (req, res) => {
    res.json({ status: "ok" });
});

app.post("/_matrix/push/v1/notify", pushAuthMiddleware, async (req, res) => {
    const body = req.body;
    if (!body || !Array.isArray(body.devices) || !body.event) {
        return res.status(400).json({ error: "invalid payload" });
    }

    let results = [];
    for (const device of body.devices) {
        // device.user_id and device.device_id are provided by Synapse
        // device.data.webpush should contain the subscription
        const { user_id, device_id, data } = device;

        // Prefer persisted subscription (user+device) if present, otherwise use the provided data.webpush fallback.
        let subscription = null;
        if (user_id && device_id) {
            const stored = getSubscriptionByUserDevice(user_id, device_id);
            if (stored) subscription = { endpoint: stored.endpoint, keys: stored.keys };
        }
        if (!subscription) subscription = data?.webpush;

        if (!subscription) {
            results.push({ device_id, error: "no webpush subscription available" });
            continue;
        }

        try {
            await webpush.sendNotification(subscription, JSON.stringify(body.event));
            results.push({ device_id, success: true });
        } catch (error) {
            const errAny = error as any;
            const statusCode = errAny?.statusCode || errAny?.status || undefined;
            // If endpoint is known and error indicates the subscription is gone, remove it
            const endpoint = (subscription as any)?.endpoint || undefined;
            if (statusCode === 404 || statusCode === 410) {
                if (endpoint) {
                    const removed = removeSubscription(endpoint);
                    if (removed.success) {
                        logInfo("push", `Removed invalid subscription for endpoint ${endpoint} due to status ${statusCode}`);
                        results.push({ device_id, error: errAny?.message || String(errAny), removed: true });
                        continue;
                    } else {
                        logWarn("push", `Failed to remove subscription for ${endpoint}: ${removed.error}`);
                    }
                }
            }

            results.push({ device_id, error: errAny instanceof Error ? errAny.message : String(errAny) });
        }
    }
    res.json({ results });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
