import axios from "axios";
import { isNoAuthModeEnabled, isServiceSessionConfigured, loginDevSession, loginServiceSession, preferServiceSessionAuth, } from "./auth.js";
export class ERPNextClient {
    baseUrl;
    axiosInstance;
    authenticated = false;
    noAuthMode;
    authModeName = "none";
    authReady = null;
    constructor() {
        this.baseUrl = process.env.ERPNEXT_URL || "";
        if (!this.baseUrl) {
            throw new Error("ERPNEXT_URL environment variable is required");
        }
        this.baseUrl = this.baseUrl.replace(/\/$/, "");
        this.noAuthMode = isNoAuthModeEnabled();
        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            withCredentials: true,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
        const apiKey = process.env.ERPNEXT_API_KEY;
        const apiSecret = process.env.ERPNEXT_API_SECRET;
        if (preferServiceSessionAuth() && isServiceSessionConfigured()) {
            this.authModeName = "service_session";
            this.authReady = this.initServiceSession();
        }
        else if (apiKey && apiSecret) {
            this.axiosInstance.defaults.headers.common["Authorization"] =
                `token ${apiKey}:${apiSecret}`;
            this.authenticated = true;
            this.authModeName = "api_token";
        }
        else if (this.noAuthMode) {
            console.error("[erpnext-mcp] DEV ONLY: ERPNEXT_NO_AUTH=1 — using Frappe session login (localhost)");
            this.authReady = this.initDevSession();
        }
        else if (isServiceSessionConfigured()) {
            this.authModeName = "service_session";
            this.authReady = this.initServiceSession();
        }
    }
    async initDevSession() {
        await loginDevSession(this.axiosInstance);
        this.authenticated = true;
        this.authModeName = "dev_session";
    }
    async initServiceSession() {
        await loginServiceSession(this.axiosInstance);
        this.authenticated = true;
        this.authModeName = "service_session";
    }
    async ensureAuthenticated() {
        if (this.authReady) {
            await this.authReady;
        }
        if (!this.authenticated) {
            const hint = this.noAuthMode
                ? "Set ERPNEXT_DEV_USER/ERPNEXT_DEV_PASSWORD or fix site login."
                : "Set ERPNEXT_API_KEY + ERPNEXT_API_SECRET, or ERPNEXT_NO_AUTH=1 for localhost dev.";
            throw new Error(`Not authenticated with ERPNext. ${hint}`);
        }
    }
    isAuthenticated() {
        return this.authenticated;
    }
    authMode() {
        return this.authenticated ? this.authModeName : "none";
    }
    async getDocument(doctype, name) {
        try {
            const response = await this.axiosInstance.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Failed to get ${doctype} ${name}: ${error?.message || "Unknown error"}`);
        }
    }
    async getDocList(doctype, filters, fields, limit) {
        try {
            const params = {};
            if (fields && fields.length) {
                params["fields"] = JSON.stringify(fields);
            }
            if (filters) {
                params["filters"] = JSON.stringify(filters);
            }
            if (limit) {
                params["limit_page_length"] = limit;
            }
            const response = await this.axiosInstance.get(`/api/resource/${encodeURIComponent(doctype)}`, { params });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Failed to get ${doctype} list: ${error?.message || "Unknown error"}`);
        }
    }
    async createDocument(doctype, doc) {
        try {
            const response = await this.axiosInstance.post(`/api/resource/${encodeURIComponent(doctype)}`, { data: doc });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Failed to create ${doctype}: ${error?.message || "Unknown error"}`);
        }
    }
    async updateDocument(doctype, name, doc) {
        try {
            const response = await this.axiosInstance.put(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { data: doc });
            return response.data.data;
        }
        catch (error) {
            throw new Error(`Failed to update ${doctype} ${name}: ${error?.message || "Unknown error"}`);
        }
    }
    async runReport(reportName, filters) {
        try {
            const response = await this.axiosInstance.get(`/api/method/frappe.desk.query_report.run`, {
                params: {
                    report_name: reportName,
                    filters: filters ? JSON.stringify(filters) : undefined,
                },
            });
            return response.data.message;
        }
        catch (error) {
            throw new Error(`Failed to run report ${reportName}: ${error?.message || "Unknown error"}`);
        }
    }
    async callMethod(method, args, httpMethod = "POST") {
        try {
            const encodedMethod = method.split(".").map(encodeURIComponent).join(".");
            let response;
            if (httpMethod === "GET") {
                response = await this.axiosInstance.get(`/api/method/${encodedMethod}`, { params: args });
            }
            else {
                response = await this.axiosInstance.post(`/api/method/${encodedMethod}`, args);
            }
            return response.data.message;
        }
        catch (error) {
            const frappeMessage = error?.response?.data?.message ||
                error?.response?.data?.exc ||
                error?.response?.data?._server_messages;
            const detail = frappeMessage || error?.message || "Unknown error";
            throw new Error(`Failed to call method ${method}: ${detail}`);
        }
    }
    async deleteDocument(doctype, name) {
        try {
            await this.axiosInstance.delete(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
        }
        catch (error) {
            throw new Error(`Failed to delete ${doctype} ${name}: ${error?.message || "Unknown error"}`);
        }
    }
    async getAllDocTypes() {
        try {
            const response = await this.axiosInstance.get("/api/resource/DocType", {
                params: {
                    fields: JSON.stringify(["name"]),
                    limit_page_length: 500,
                },
            });
            if (response.data && response.data.data) {
                return response.data.data.map((item) => item.name);
            }
            return [];
        }
        catch (error) {
            console.error("Failed to get DocTypes:", error?.message || "Unknown error");
            try {
                const altResponse = await this.axiosInstance.get("/api/method/frappe.desk.search.search_link", {
                    params: {
                        doctype: "DocType",
                        txt: "",
                        limit: 500,
                    },
                });
                if (altResponse.data && altResponse.data.results) {
                    return altResponse.data.results.map((item) => item.value);
                }
                return [];
            }
            catch (altError) {
                console.error("Alternative DocType fetch failed:", altError?.message || "Unknown error");
                return [
                    "Customer",
                    "Supplier",
                    "Item",
                    "Sales Order",
                    "Purchase Order",
                    "Sales Invoice",
                    "Purchase Invoice",
                    "Employee",
                    "Lead",
                    "Opportunity",
                    "Quotation",
                    "Payment Entry",
                    "Journal Entry",
                    "Stock Entry",
                ];
            }
        }
    }
}
