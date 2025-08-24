import { logWarn, logInfo } from "./logger.js";
import { getPushGatewaySecret, getAdminApiKeys } from "./init.js";

function extractAuthValue(req: any) {
    const authHeader = (req.headers?.authorization as string) || (req.headers?.["x-api-key"] as string) || "";
    if (!authHeader) return "";
    if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();

    return authHeader.trim();
}

export function pushAuthMiddleware(req: any, res: any, next: any) {
    const secret = getPushGatewaySecret();
    const provided = extractAuthValue(req);
    if (provided !== secret) {
        logWarn("auth", `Unauthorized notify attempt from ${req.ip || req.socket?.remoteAddress}`);

        return res.status(401).json({ error: "unauthorized" });
    }

    return next();
}

export function adminAuthMiddleware(req: any, res: any, next: any) {
    const allowed = getAdminApiKeys() || [];
    const provided = extractAuthValue(req);
    if (!provided) {
        logWarn("auth", `Missing admin auth from ${req.ip || req.socket?.remoteAddress}`);

        return res.status(401).json({ error: "unauthorized" });
    }
    if (!allowed.includes(provided)) {
        logWarn("auth", `Invalid admin auth from ${req.ip || req.socket?.remoteAddress}`);

        return res.status(403).json({ error: "forbidden" });
    }
    logInfo("auth", `Admin auth successful for ${req.ip || req.socket?.remoteAddress}`);
    
    return next();
}