import * as Types from "@wpazderski/kvapi-types";
import { Deferred } from "./utils/Deferred";
import { ServerError } from "./errors/ServerError";
import { Encryption } from "./Encryption";

export type RequestHeaders = { [key: string]: string };

interface BatchedRequestEx extends Types.api.batch.BatchedRequest {
    deferred: Deferred<any>;
}

export interface GenericApiOptions {
    batchMode: boolean;
    e2ee: boolean;
    commonHeadersProvider: () => RequestHeaders;
}

export class GenericApi {
    
    private options: GenericApiOptions;
    private currentBatchedRequestsEx: (BatchedRequestEx | Deferred<BatchedRequestEx | null>)[] = [];
    private _encryption: Encryption | null = null;
    
    private get encryption(): Encryption | null {
        return this.parentGenericApi ? this.parentGenericApi.encryption : this._encryption;
    }
    private set encryption(encryption: Encryption | null) {
        if (this.parentGenericApi) {
            this.parentGenericApi.encryption = encryption;
        }
        else {
            this._encryption = encryption;
        }
    }
    
    constructor(private baseUrl: string, options?: Partial<GenericApiOptions>, private parentGenericApi: GenericApi | null = null) {
        this.options = {
            batchMode: false,
            e2ee: false,
            commonHeadersProvider: () => ({}),
            ...options,
        };
        if (this.baseUrl && !this.baseUrl.endsWith("/")) {
            this.baseUrl += "/";
        }
    }
    
    isE2EEncrypted(): boolean {
        return this.options.e2ee;
    }
    
    maybeInitEncryption(encryptionKey: CryptoKey): void {
        if (!this.options.e2ee || this.encryption) {
            return;
        }
        this.encryption = new Encryption(encryptionKey);
    }
    
    disposeEncryption(): void {
        this.encryption = null;
    }
    
    async maybeEncrypt<T extends string>(data: T, entryAccess?: Types.data.entry.EntryAccess): Promise<T> {
        if (!this.shouldUseEncryption(entryAccess)) {
            return data;
        }
        const encrypted = await this.encryption!.encrypt(data);
        return encrypted as T;
    }
    
    async maybeDecrypt<T extends string>(data: T, entryAccess?: Types.data.entry.EntryAccess): Promise<T> {
        if (!this.shouldUseEncryption(entryAccess)) {
            return data;
        }
        const decrypted = await this.encryption!.decrypt(data);
        return decrypted as T;
    }
    
    private shouldUseEncryption(entryAccess?: Types.data.entry.EntryAccess): boolean {
        if (!this.options.e2ee) {
            return false;
        }
        if (entryAccess === "public") {
            return false;
        }
        if (!this.encryption && GenericApi) {
        }
        if (!this.encryption) {
            throw new Error("Encryption not initialized");
        }
        return true;
    }
    
    get<TResponse>(url: string, canBeBatched: boolean = true): Promise<TResponse> {
        return this.request("get", url, undefined, canBeBatched);
    }
    
    post<TRequest, TResponse>(url: string, data: TRequest, canBeBatched: boolean = true): Promise<TResponse> {
        return this.request("post", url, data, canBeBatched);
    }
    
    patch<TRequest, TResponse>(url: string, data: TRequest, canBeBatched: boolean = true): Promise<TResponse> {
        return this.request("patch", url, data, canBeBatched);
    }
    
    put<TRequest, TResponse>(url: string, data: TRequest, canBeBatched: boolean = true): Promise<TResponse> {
        return this.request("put", url, data, canBeBatched);
    }
    
    delete<TRequest, TResponse>(url: string, data: TRequest, canBeBatched: boolean = true): Promise<TResponse> {
        return this.request("delete", url, data, canBeBatched);
    }
    
    request<TRequest, TResponse>(method: Types.api.request.Method, url: string, data?: TRequest, canBeBatched: boolean = true): Promise<TResponse> {
        if (this.options.batchMode && canBeBatched) {
            const deferred = new Deferred<TResponse>();
            this.currentBatchedRequestsEx.push({ method, url, data, deferred });
            return deferred.getPromise();
        }
        else {
            return this.requestCore(method, url, data);
        }
    }
    
    private async requestCore<TRequest, TResponse>(method: Types.api.request.Method, url: string, data?: TRequest): Promise<TResponse> {
        const headers: RequestHeaders = {
            ...this.options.commonHeadersProvider(),
            "Content-Type": "application/json",
        };
        const response = await fetch(this.getFullUrl(url), {
            method: method.toUpperCase(),
            headers,
            body: data !== undefined ? JSON.stringify(data) : null,
        });
        if (response.status === 200) {
            return await response.json();
        }
        else {
            let details: any;
            try {
                details = await response.json();
            }
            catch {}
            throw new ServerError(response.status, response.statusText, details);
        }
    }
    
    private getFullUrl(url: string): string {
        if (url.startsWith("/")) {
            url = url.substring(1);
        }
        return this.baseUrl + url;
    }
    
    async executeBatch(): Promise<void> {
        if (this.currentBatchedRequestsEx.length === 0) {
            return;
        }
        
        const batchedRequestsEx = this.currentBatchedRequestsEx;
        this.currentBatchedRequestsEx = [];
        const batchedRequestsExResolved: BatchedRequestEx[] = [];
        for (const batchedRequestEx of batchedRequestsEx) {
            if (batchedRequestEx instanceof Deferred) {
                const req = await batchedRequestEx.getPromise();
                if (req !== null) {
                    batchedRequestsExResolved.push(req);
                }
            }
            else {
                batchedRequestsExResolved.push(batchedRequestEx);
            }
        }
        const batchedRequests = batchedRequestsExResolved.map(request => (<Types.api.batch.BatchedRequest>{
            method: request.method,
            url: request.url,
            data: request.data,
        }));
        
        const data: Types.api.batch.Request = {
            batchedRequests,
        };
        const result = await this.requestCore("post", "batch", data) as Types.api.batch.Response;
        for (let i = 0; i < batchedRequests.length; ++i) {
            try {
                const request = batchedRequestsExResolved[i]!;
                const response = result.batchedResponses[i]!;
                if (response.statusCode === 200) {
                    request.deferred.resolve(JSON.parse(response.response));
                }
                else {
                    let details: any;
                    try {
                        details = JSON.parse(response.response);
                    }
                    catch {}
                    request.deferred.reject(new ServerError(response.statusCode, response.statusText, details));
                }
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    
    async buildRequestAsynchronously<T>(builder: () => Promise<() => Promise<T>>): Promise<T> {
        if (!this.options.batchMode) {
            return (await builder())();
        }
        const deferred = new Deferred<BatchedRequestEx | null>();
        this.currentBatchedRequestsEx.push(deferred);
        try {
            const requestScheduler = await builder();
            const requestPromise = requestScheduler();
            const idx = this.currentBatchedRequestsEx.findIndex(req => req && !(req instanceof Deferred) && req.deferred.getPromise() === requestPromise);
            if (idx < 0) {
                throw new Error("buildRequestAsynchronously: no batched request");
            }
            const batchedRequest = this.currentBatchedRequestsEx[idx];
            if (!batchedRequest || batchedRequest instanceof Deferred) {
                throw new Error("buildRequestAsynchronously: unexpected batched request object");
            }
            this.currentBatchedRequestsEx.splice(idx, 1);
            deferred.resolve(batchedRequest);
            return requestPromise;
        }
        catch (err) {
            deferred.resolve(null);
            throw err;
        }
    }
    
    getCurrentBatchSize(): number {
        return this.currentBatchedRequestsEx.length;
    }
    
}
