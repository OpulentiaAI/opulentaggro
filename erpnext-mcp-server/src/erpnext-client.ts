import axios, { AxiosInstance } from "axios";
import { isNoAuthModeEnabled, loginDevSession } from "./auth.js";

export class ERPNextClient {
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private authenticated: boolean = false;
  private readonly noAuthMode: boolean;
  private authReady: Promise<void> | null = null;

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

    if (apiKey && apiSecret) {
      this.axiosInstance.defaults.headers.common["Authorization"] =
        `token ${apiKey}:${apiSecret}`;
      this.authenticated = true;
    } else if (this.noAuthMode) {
      console.error(
        "[erpnext-mcp] DEV ONLY: ERPNEXT_NO_AUTH=1 — using Frappe session login (localhost)"
      );
      this.authReady = this.initDevSession();
    }
  }

  private async initDevSession(): Promise<void> {
    await loginDevSession(this.axiosInstance);
    this.authenticated = true;
  }

  async ensureAuthenticated(): Promise<void> {
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

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  authMode(): string {
    if (this.noAuthMode && this.authenticated) {
      return "dev_session";
    }
    if (this.authenticated) {
      return "api_token";
    }
    return "none";
  }

  async getDocument(doctype: string, name: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to get ${doctype} ${name}: ${error?.message || "Unknown error"}`);
    }
  }

  async getDocList(
    doctype: string,
    filters?: Record<string, any>,
    fields?: string[],
    limit?: number
  ): Promise<any[]> {
    try {
      const params: Record<string, any> = {};

      if (fields && fields.length) {
        params["fields"] = JSON.stringify(fields);
      }

      if (filters) {
        params["filters"] = JSON.stringify(filters);
      }

      if (limit) {
        params["limit_page_length"] = limit;
      }

      const response = await this.axiosInstance.get(
        `/api/resource/${encodeURIComponent(doctype)}`,
        { params }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to get ${doctype} list: ${error?.message || "Unknown error"}`);
    }
  }

  async createDocument(doctype: string, doc: Record<string, any>): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/api/resource/${encodeURIComponent(doctype)}`,
        { data: doc }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to create ${doctype}: ${error?.message || "Unknown error"}`);
    }
  }

  async updateDocument(doctype: string, name: string, doc: Record<string, any>): Promise<any> {
    try {
      const response = await this.axiosInstance.put(
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
        { data: doc }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to update ${doctype} ${name}: ${error?.message || "Unknown error"}`);
    }
  }

  async runReport(reportName: string, filters?: Record<string, any>): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/api/method/frappe.desk.query_report.run`, {
        params: {
          report_name: reportName,
          filters: filters ? JSON.stringify(filters) : undefined,
        },
      });
      return response.data.message;
    } catch (error: any) {
      throw new Error(`Failed to run report ${reportName}: ${error?.message || "Unknown error"}`);
    }
  }

  async callMethod(
    method: string,
    args?: Record<string, any>,
    httpMethod: "GET" | "POST" = "POST"
  ): Promise<any> {
    try {
      const encodedMethod = method.split(".").map(encodeURIComponent).join(".");
      let response;
      if (httpMethod === "GET") {
        response = await this.axiosInstance.get(`/api/method/${encodedMethod}`, { params: args });
      } else {
        response = await this.axiosInstance.post(`/api/method/${encodedMethod}`, args);
      }
      return response.data.message;
    } catch (error: any) {
      throw new Error(`Failed to call method ${method}: ${error?.message || "Unknown error"}`);
    }
  }

  async deleteDocument(doctype: string, name: string): Promise<void> {
    try {
      await this.axiosInstance.delete(
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
      );
    } catch (error: any) {
      throw new Error(`Failed to delete ${doctype} ${name}: ${error?.message || "Unknown error"}`);
    }
  }

  async getAllDocTypes(): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get("/api/resource/DocType", {
        params: {
          fields: JSON.stringify(["name"]),
          limit_page_length: 500,
        },
      });

      if (response.data && response.data.data) {
        return response.data.data.map((item: any) => item.name);
      }

      return [];
    } catch (error: any) {
      console.error("Failed to get DocTypes:", error?.message || "Unknown error");

      try {
        const altResponse = await this.axiosInstance.get(
          "/api/method/frappe.desk.search.search_link",
          {
            params: {
              doctype: "DocType",
              txt: "",
              limit: 500,
            },
          }
        );

        if (altResponse.data && altResponse.data.results) {
          return altResponse.data.results.map((item: any) => item.value);
        }

        return [];
      } catch (altError: any) {
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
