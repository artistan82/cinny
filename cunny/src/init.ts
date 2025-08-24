import fs from "fs";
import path, { dirname } from "path";
import Database from "better-sqlite3";
import webpush from "web-push";
import { fileURLToPath } from "url";
import { logInfo, logError, setLoggerConfig } from "./logger.js";
import { ensureSecrets, getPushGatewaySecret as secretGetPushGatewaySecret, getAdminApiKeys as secretGetAdminApiKeys, reload as reloadSecrets } from "./secretManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = path.join(__dirname, "../data");
const dbPath = path.join(dataDir, "cunny.db");
const schemaPath = path.join(__dirname, "../config/schema.sql");
const vapidKeyPath = path.join(dataDir, "vapid.json");
const markerPath = path.join(dataDir, ".initialized");

let db: Database.Database;
let vapidKeys: { publicKey: string; privateKey: string };
let vapidEmail: string = process.env.VAPID_EMAIL || "admin@example.com";
let initialized = false;

setLoggerConfig({
    logPath: path.join(dataDir, "cunny.log"),
    auditPath: path.join(dataDir, "admin-audit.log"),
    logLevel: process.env.LOG_LEVEL as any || "info"
});

export function ensureInitialized() {    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logInfo("init", `Created data directory at ${dataDir}`);
    }

    if (!fs.existsSync(markerPath)) {
        db = new Database(dbPath);
        if (!fs.existsSync(schemaPath)) {
            logError("init", `Database schema file missing at ${schemaPath}`);
            process.exit(1);
        }
        const schema = fs.readFileSync(schemaPath, "utf-8");
        db.exec(schema);
        logInfo("database", `Database schema loaded and executed.`);

        if (fs.existsSync(vapidKeyPath)) {
            vapidKeys = JSON.parse(fs.readFileSync(vapidKeyPath, "utf-8"));
            logInfo("vapid", `Loaded existing VAPID keys.`);
        } else {
            vapidKeys = webpush.generateVAPIDKeys();
            fs.writeFileSync(vapidKeyPath, JSON.stringify(vapidKeys, null, 2));
            logInfo("vapid", `Generated new VAPID keys.`);
        }
        
        ensureSecrets();
        reloadSecrets();
        
        fs.writeFileSync(markerPath, "initialized");
        logInfo("init", `First run initialization complete.`);
    } else {
        db = new Database(dbPath);
        vapidKeys = JSON.parse(fs.readFileSync(vapidKeyPath, "utf-8"));
        reloadSecrets();
        logInfo("init", `Initialization complete.`);
    }

    initialized = true;
}

export function getVapidData() {
    return { email: vapidEmail, ...vapidKeys };
}

export function getPushGatewaySecret() {
    return secretGetPushGatewaySecret();
}

export function getAdminApiKeys() {
    return secretGetAdminApiKeys();
}

export { db };
