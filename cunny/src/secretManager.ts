import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { logInfo, logWarn, logError } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../data");
const pushPath = path.join(dataDir, "pushgateway.json");
const adminPath = path.join(dataDir, "adminapi.json");

type AdminEntry = { id: string; key: string; created_at: string };
type PushEntry = { id: string; secret: string; created_at: string };

let cached: { pushes?: PushEntry[]; admin?: AdminEntry[] } | null = null;

function atomicWrite(filePath: string, obj: any) {
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, filePath);
}

function readJsonIfExists(p: string) {
    try {
        if (!fs.existsSync(p)) return null;
        const raw = fs.readFileSync(p, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        logWarn("secrets", `Failed to parse ${p}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}

export function ensureSecrets() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Push secret(s)
    if (!fs.existsSync(pushPath)) {
        const pushSecret = process.env.PUSH_GATEWAY_SECRET || crypto.randomBytes(24).toString("hex");
        const entry: PushEntry = { id: crypto.randomUUID(), secret: pushSecret, created_at: new Date().toISOString() };
        atomicWrite(pushPath, { pushGatewaySecrets: [entry] });
        logInfo("secrets", `Created push gateway secret at ${pushPath}`);
    }

    // Admin keys: store array of entries
    if (!fs.existsSync(adminPath)) {
        const adminKey = process.env.ADMIN_API_KEY || crypto.randomBytes(18).toString("hex");
        const entry: AdminEntry = { id: crypto.randomUUID(), key: adminKey, created_at: new Date().toISOString() };
        atomicWrite(adminPath, { adminApiKeys: [entry] });
        logInfo("secrets", `Created admin API key at ${adminPath}`);
    }

    reload();
}

export function reload() {
    try {
        const pushJson = readJsonIfExists(pushPath);
        const adminJson = readJsonIfExists(adminPath);
        let pushes: PushEntry[] = [];
        if (process.env.PUSH_GATEWAY_SECRET) {
            pushes = [{ id: crypto.randomUUID(), secret: process.env.PUSH_GATEWAY_SECRET, created_at: new Date().toISOString() }];
        } else if (pushJson && Array.isArray(pushJson.pushGatewaySecrets)) {
            const raw = pushJson.pushGatewaySecrets;
            pushes = raw.map((e: any) => ({
                id: e.id || crypto.randomUUID(),
                secret: e.secret,
                created_at: e.created_at || new Date().toISOString()
            }));
        }

        let admin: AdminEntry[] = [];
        if (process.env.ADMIN_API_KEYS) {
            admin = process.env.ADMIN_API_KEYS.split(",").map(k => ({
                id: crypto.randomUUID(),
                key: k.trim(),
                created_at: new Date().toISOString()
            }));
        } else if (adminJson && Array.isArray(adminJson.adminApiKeys)) {
            const raw = adminJson.adminApiKeys;
            if (raw.length > 0 && typeof raw[0] === 'string') {
                admin = raw.map((k: string) => ({
                    id: crypto.randomUUID(),
                    key: String(k),
                    created_at: new Date().toISOString()
                }));
            } else if (raw.length > 0 && raw[0].key) {
                admin = raw.map((e: any) => ({
                    id: e.id || crypto.randomUUID(),
                    key: e.key,
                    created_at: e.created_at || new Date().toISOString()
                }));
            }
        }
        cached = { pushes, admin };
        return cached;
    } catch (err) {
        logError("secrets", `Reload failed: ${err instanceof Error ? err.message : String(err)}`);
        cached = { pushes: [], admin: [] };
        return cached;
    }
}

export function getPushGatewaySecret() {
    if (!cached) reload();
    return cached?.pushes && cached.pushes.length > 0 ? cached.pushes[0].secret : undefined;
}

export function getAdminApiKeys() {
    if (!cached) reload();
    return (cached?.admin || []).map(e => e.key);
}

export function rotatePushSecret() {
    const newSecret = crypto.randomBytes(24).toString("hex");
    const entry: PushEntry = { id: crypto.randomUUID(), secret: newSecret, created_at: new Date().toISOString() };
    const raw = readJsonIfExists(pushPath) || {};
    let arr: any[] = [];
    if (Array.isArray(raw.pushGatewaySecrets)) arr = raw.pushGatewaySecrets;
    arr = [entry].concat(arr.map((e: any) => (e.id ? e : { id: crypto.randomUUID(), secret: e.pushGatewaySecret || e, created_at: new Date().toISOString() })));
    const maxHistory = Math.max(1, parseInt(process.env.PUSH_SECRET_HISTORY || "2", 10));
    if (arr.length > maxHistory) arr = arr.slice(0, maxHistory);
    atomicWrite(pushPath, { pushGatewaySecrets: arr });
    reload();
    logInfo("secrets", "Rotated push gateway secret");
    return entry;
}

export function getPushGatewaySecrets() {
    if (!cached) reload();
    return (cached?.pushes || []).map(p => p.secret);
}

export function rotateAdminKey(append = true) {
    const newKey = crypto.randomBytes(18).toString("hex");
    const entry: AdminEntry = { id: crypto.randomUUID(), key: newKey, created_at: new Date().toISOString() };
    const raw = readJsonIfExists(adminPath) || {};
    let arr: any[] = [];
    if (Array.isArray(raw.adminApiKeys)) {
        arr = raw.adminApiKeys.map((e: any) => (typeof e === 'string' ? { id: crypto.randomUUID(), key: e, created_at: new Date().toISOString() } : e));
    }
    if (append) arr.push(entry);
    else arr = [entry];
    atomicWrite(adminPath, { adminApiKeys: arr });
    reload();
    logInfo("secrets", `Rotated admin API key (append=${append})`);
    return entry;
}

export function revokeAdminKeyById(id: string) {
    const raw = readJsonIfExists(adminPath) || {};
    let arr: any[] = Array.isArray(raw.adminApiKeys) ? raw.adminApiKeys : [];
    const before = arr.length;
    arr = arr.filter((e: any) => (e.id || '') !== id);
    atomicWrite(adminPath, { adminApiKeys: arr });
    reload();
    logInfo("secrets", `Revoked admin API key ${id} (removed ${before - arr.length})`);
    return { removed: before - arr.length };
}

export function listAdminKeys() {
    if (!cached) reload();
    return (cached?.admin || []).map(a => ({ id: a.id, created_at: a.created_at }));
}
