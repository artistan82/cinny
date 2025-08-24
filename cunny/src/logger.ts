import fs from "fs";

type LogLevel = "debug" | "info" | "warn" | "error";

let logConfig = {
    logPath: undefined as string | undefined,
    auditPath: undefined as string | undefined,
    logLevel: "info" as LogLevel,
};

export function setLoggerConfig(config: { logPath?: string; auditPath?: string; logLevel?: LogLevel }) {
    if (config.logPath) logConfig.logPath = config.logPath;
    if (config.auditPath) logConfig.auditPath = config.auditPath;
    if (config.logLevel) logConfig.logLevel = config.logLevel;
}

function formatLog(level: LogLevel, component: string, message: string) {
    const timestamp = new Date().toISOString();
    // Pad component and level for alignment
    const compPad = component.padEnd(12, ' ');
    const levelPad = level.toUpperCase().padEnd(7, ' ');
    
    return `${timestamp} | ${compPad} | ${levelPad} | ${message}`;
}

function shouldLog(level: LogLevel) {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];

    return levels.indexOf(level) >= levels.indexOf(logConfig.logLevel);
}

export function logDebug(component: string, message: string) {
    if (!shouldLog("debug")) return;

    const out = formatLog("debug", component, message);
    console.debug(out);
    appendToFile(out);
}

export function logInfo(component: string, message: string) {
    if (!shouldLog("info")) return;
    
    const out = formatLog("info", component, message);
    console.log(out);
    appendToFile(out);
}

export function logWarn(component: string, message: string) {
    if (!shouldLog("warn")) return;
    
    const out = formatLog("warn", component, message);
    console.warn(out);
    appendToFile(out);
}

export function logError(component: string, message: string) {
    if (!shouldLog("error")) return;
    
    const out = formatLog("error", component, message);
    console.error(out);
    appendToFile(out);
}

function appendToFile(line: string) {
    if (!logConfig.logPath) return;
    fs.appendFileSync(logConfig.logPath, line + "\n");
}

/**
 * Append an audit entry to the dedicated audit log file (if configured).
 * This is intended for admin actions like key rotation and revocation.
 */
export function logAudit(action: string, details: any, remoteIp?: string) {
    try {
        if (!logConfig.auditPath) {
            // fallback: if no auditPath configured, fall back to main log file
            if (!logConfig.logPath) return;
            fs.appendFileSync(logConfig.logPath, `[AUDIT] ${new Date().toISOString()} | ${remoteIp || '-'} | ${action} | ${JSON.stringify(details)}\n`);
            return;
        }

        // ensure audit file exists (directory should already exist)
        const line = `${new Date().toISOString()} | ${remoteIp || '-'} | ${action} | ${JSON.stringify(details)}`;
        fs.appendFileSync(logConfig.auditPath, line + "\n", { encoding: 'utf-8' });
    } catch (err) {
        // best-effort: log to main logger
        const msg = `Failed to write audit entry: ${err instanceof Error ? err.message : String(err)}`;
        const out = formatLog("warn", "audit", msg);
        console.warn(out);
        appendToFile(out);
    }
}
