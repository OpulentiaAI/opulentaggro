/**
 * ERPNext authentication for the MCP server.
 *
 * Production: ERPNEXT_API_KEY + ERPNEXT_API_SECRET (token header).
 * Local dev only: ERPNEXT_NO_AUTH=1 or MCP_NO_AUTH=1 against localhost —
 * logs in via Frappe session (ERPNEXT_DEV_USER / ERPNEXT_DEV_PASSWORD).
 * NEVER enable no-auth against non-localhost URLs.
 */
export function isLocalhostUrl(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    }
    catch {
        return false;
    }
}
export function isNoAuthModeEnabled() {
    const flag = process.env.ERPNEXT_NO_AUTH === "1" ||
        process.env.MCP_NO_AUTH === "1" ||
        process.env.ERPNEXT_NO_AUTH === "true" ||
        process.env.MCP_NO_AUTH === "true";
    if (!flag) {
        return false;
    }
    const baseUrl = process.env.ERPNEXT_URL || "";
    if (!baseUrl) {
        throw new Error("ERPNEXT_NO_AUTH/MCP_NO_AUTH requires ERPNEXT_URL to be set to a localhost URL");
    }
    if (!isLocalhostUrl(baseUrl)) {
        throw new Error("ERPNEXT_NO_AUTH/MCP_NO_AUTH is only allowed when ERPNEXT_URL points to localhost (dev only)");
    }
    return true;
}
export function devCredentials() {
    return {
        user: process.env.ERPNEXT_DEV_USER || "Administrator",
        password: process.env.ERPNEXT_DEV_PASSWORD ||
            process.env.FRAPPE_ADMIN_PASSWORD ||
            "admin",
    };
}
export async function loginDevSession(axiosInstance) {
    const { user, password } = devCredentials();
    const response = await axiosInstance.post("/api/method/login", {
        usr: user,
        pwd: password,
    });
    const message = response.data?.message;
    if (message === "Logged In" || message === "No App") {
        return;
    }
    if (response.data?.message?.full_name) {
        return;
    }
    throw new Error(`Dev session login failed for ${user}: ${JSON.stringify(response.data?.message ?? response.data)}`);
}
