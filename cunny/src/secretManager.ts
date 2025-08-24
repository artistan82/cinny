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

let cached: { push?: string; admin?: AdminEntry[] } | null = null;

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
        logWarn("secrets", `failed to parse ${p}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}

export function ensureSecrets() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Push secret
    if (!fs.existsSync(pushPath)) {
        const pushSecret = process.env.PUSH_GATEWAY_SECRET || crypto.randomBytes(24).toString("hex");
        atomicWrite(pushPath, { pushGatewaySecret: pushSecret });
        logInfo("secrets", `created push gateway secret at ${pushPath}`);
    }

    // Admin keys: store array of entries
    if (!fs.existsSync(adminPath)) {
        const adminKey = process.env.ADMIN_API_KEY || crypto.randomBytes(18).toString("hex");
        const entry: AdminEntry = { id: crypto.randomUUID(), key: adminKey, created_at: new Date().toISOString() };
        atomicWrite(adminPath, { adminApiKeys: [entry] });
        logInfo("secrets", `created admin api key at ${adminPath}`);
    }

    reload();
}

export function reload() {
    try {
        const pushJson = readJsonIfExists(pushPath);
        const adminJson = readJsonIfExists(adminPath);
        const push = process.env.PUSH_GATEWAY_SECRET || (pushJson && pushJson.pushGatewaySecret) || undefined;
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
        cached = { push, admin };
        return cached;
    } catch (err) {
        logError("secrets", `reload failed: ${err instanceof Error ? err.message : String(err)}`);
        cached = { push: undefined, admin: [] };
        return cached;
    }
}

export function getPushGatewaySecret() {
    if (!cached) reload();
    return cached?.push;
}

export function getAdminApiKeys() {
    if (!cached) reload();
    return (cached?.admin || []).map(e => e.key);
}

export function rotatePushSecret() {
    const newSecret = crypto.randomBytes(24).toString("hex");
    atomicWrite(pushPath, { pushGatewaySecret: newSecret });
    reload();
    logInfo("secrets", "rotated push gateway secret");
    return newSecret;
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
    logInfo("secrets", `rotated admin api key (append=${append})`);
    return entry;
}

export function revokeAdminKeyById(id: string) {
    const raw = readJsonIfExists(adminPath) || {};
    let arr: any[] = Array.isArray(raw.adminApiKeys) ? raw.adminApiKeys : [];
    const before = arr.length;
    arr = arr.filter((e: any) => (e.id || '') !== id);
    atomicWrite(adminPath, { adminApiKeys: arr });
    reload();
    logInfo("secrets", `revoked admin key ${id} (removed ${before - arr.length})`);
    return { removed: before - arr.length };
}
