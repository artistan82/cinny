import { db } from "./init.js";
import { logInfo, logWarn } from "./logger.js";

export function addSubscription(subscription: any): { success: boolean; error?: string } {
    // Basic validation
    if (!subscription || typeof subscription !== "object") {
        logWarn("db", "Invalid subscription: not an object");

        return { success: false, error: "Invalid subscription object" };
    }
    const { user_id, device_id, endpoint, keys } = subscription;
    if (!user_id || typeof user_id !== "string") {
        logWarn("db", "Invalid subscription: missing user_id");

        return { success: false, error: "Missing user_id" };
    }
    // device_id is optional but if provided must be a string
    if (device_id && typeof device_id !== "string") {
        logWarn("db", "Invalid subscription: device_id must be a string if provided");

        return { success: false, error: "Invalid device_id" };
    }
    if (!endpoint || typeof endpoint !== "string" || !keys || typeof keys !== "object") {
        logWarn("db", `Invalid subscription: missing endpoint or keys`);

        return { success: false, error: "Missing endpoint or keys" };
    }

    // If device_id is provided, prefer upsert by (user_id, device_id)
    if (device_id) {
        try {
            const existing = db.prepare('SELECT id, endpoint FROM subscriptions WHERE user_id = ? AND device_id = ?').get(user_id, device_id) as { id: number; endpoint: string } | undefined;
            if (existing) {
                // If endpoint changed, ensure no other row uses the new endpoint
                if (existing.endpoint !== endpoint) {
                    const conflict = db.prepare('SELECT id FROM subscriptions WHERE endpoint = ? AND id != ?').get(endpoint, existing.id);
                    if (conflict) {
                        logWarn("db", `Endpoint conflict for ${endpoint}`);
                        return { success: false, error: "Endpoint already in use" };
                    }
                }
                // Update the existing row with new endpoint/keys
                db.prepare('UPDATE subscriptions SET endpoint = ?, keys = ? WHERE id = ?').run(endpoint, JSON.stringify(keys), existing.id);
                logInfo("db", `Updated subscription for user ${user_id} device ${device_id}`);
                return { success: true };
            }
            // No existing subscription for this device: check endpoint duplicate globally
            const exists = db.prepare('SELECT 1 FROM subscriptions WHERE endpoint = ?').get(endpoint);
            if (exists) {
                logWarn("db", `Duplicate subscription for endpoint: ${endpoint}`);
                return { success: false, error: "Subscription already exists" };
            }
            // Insert new row
            const stmt = db.prepare('INSERT INTO subscriptions (user_id, device_id, endpoint, keys) VALUES (?, ?, ?, ?)');
            stmt.run(user_id, device_id, endpoint, JSON.stringify(keys));
            logInfo("db", `Inserted subscription for user ${user_id} device ${device_id}`);
            return { success: true };
        } catch (err) {
            logWarn("db", `addSubscription error: ${err instanceof Error ? err.message : String(err)}`);
            return { success: false, error: "Database error" };
        }
    }

    // No device_id: original behavior keyed by endpoint uniqueness
    const existsNoDevice = db.prepare('SELECT 1 FROM subscriptions WHERE endpoint = ?').get(endpoint);
    if (existsNoDevice) {
        logWarn("db", `Duplicate subscription for endpoint: ${endpoint}`);
        
        return { success: false, error: "Subscription already exists" };
    }
    const stmt = db.prepare('INSERT INTO subscriptions (user_id, device_id, endpoint, keys) VALUES (?, ?, ?, ?)');
    stmt.run(user_id, null, endpoint, JSON.stringify(keys));
    logInfo("db", `Inserted subscription for user ${user_id}`);
    return { success: true };
}

export function getSubscriptions() {
    const stmt = db.prepare('SELECT user_id, device_id, endpoint, keys FROM subscriptions');
    const rows = stmt.all() as { user_id: string; device_id: string | null; endpoint: string; keys: string }[];
    return rows.map(row => ({
        user_id: row.user_id,
        device_id: row.device_id,
        endpoint: row.endpoint,
        keys: JSON.parse(row.keys)
    }));
}

export function getSubscriptionByUserDevice(user_id: string, device_id: string) {
    const stmt = db.prepare('SELECT user_id, device_id, endpoint, keys FROM subscriptions WHERE user_id = ? AND device_id = ?');
    const row = stmt.get(user_id, device_id) as { user_id: string; device_id: string | null; endpoint: string; keys: string } | undefined;
    if (!row) return null;

    return { user_id: row.user_id, device_id: row.device_id, endpoint: row.endpoint, keys: JSON.parse(row.keys) };
}

export function getSubscriptionByEndpoint(endpoint: string) {
    const stmt = db.prepare('SELECT user_id, device_id, endpoint, keys FROM subscriptions WHERE endpoint = ?');
    const row = stmt.get(endpoint) as { user_id: string; device_id: string | null; endpoint: string; keys: string } | undefined;
    if (!row) return null;
    
    return { user_id: row.user_id, device_id: row.device_id, endpoint: row.endpoint, keys: JSON.parse(row.keys) };
}

export function getSubscriptionsByUser(user_id: string) {
    const stmt = db.prepare('SELECT user_id, device_id, endpoint, keys, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(user_id) as { user_id: string; device_id: string | null; endpoint: string; keys: string; created_at: string }[];
    return rows.map(row => ({
        user_id: row.user_id,
        device_id: row.device_id,
        endpoint: row.endpoint,
        keys: JSON.parse(row.keys),
        created_at: row.created_at
    }));
}

export function removeSubscription(endpoint: string): { success: boolean; error?: string } {
    if (!endpoint || typeof endpoint !== "string") {
        logWarn("db", `Invalid unsubscribe: missing or invalid endpoint`);

        return { success: false, error: "Missing or invalid endpoint" };
    }

    const exists = db.prepare("SELECT 1 FROM subscriptions WHERE endpoint = ?").get(endpoint);
    if (!exists) {
        logWarn("db", `Unsubscribe failed: endpoint not found (${endpoint})`);

        return { success: false, error: "Subscription not found" };
    }

    const stmt = db.prepare('DELETE FROM subscriptions WHERE endpoint = ?');
    stmt.run(endpoint);
    logInfo("db", `Unsubscribed endpoint: ${endpoint}`);

    return { success: true };
}
