import * as Types from "@wpazderski/kvapi-types";
import { InvalidParamError } from "../errors";
import { GenericApi } from "../GenericApi";

export class EntriesApi {
    
    constructor(private genericApi: GenericApi, private entryAccess: Types.data.entry.EntryAccess) {
    }
    
    async getAll(): Promise<Types.data.entry.KeyValueMap> {
        const response: Types.api.entries.GetEntriesResponse = await this.genericApi.get(`${this.entryAccess}-entries`);
        const entries: Types.data.entry.KeyValueMap = {};
        for (const key in response.entries) {
            let value = (response.entries as any)[key];
            value = await this.genericApi.maybeDecrypt(value, this.entryAccess);
            (entries as any)[key] = value;
        }
        return entries;
    }
    
    async get(key: Types.data.entry.Key): Promise<Types.data.entry.Value> {
        key = key.trim() as Types.data.entry.Key;
        if (!key) {
            throw new InvalidParamError("key");
        }
        const response: Types.api.entries.GetEntryResponse = await this.genericApi.get(`${this.entryAccess}-entries/${key}`);
        return this.genericApi.maybeDecrypt(response.value, this.entryAccess);
    }
    
    async set(key: Types.data.entry.Key, value: Types.data.entry.Value): Promise<void> {
        key = key.trim() as Types.data.entry.Key;
        if (!key) {
            throw new InvalidParamError("key");
        }
        await this.genericApi.buildRequestAsynchronously(async () => {
            value = await this.genericApi.maybeEncrypt(value, this.entryAccess);
            const request: Types.api.entries.CreateOrUpdateEntryRequest = { value };
            return () => this.genericApi.put(`${this.entryAccess}-entries/${key}`, request);
        });
    }
    
    async delete(key: Types.data.entry.Key): Promise<void> {
        key = key.trim() as Types.data.entry.Key;
        if (!key) {
            throw new InvalidParamError("key");
        }
        await this.genericApi.delete(`${this.entryAccess}-entries/${key}`, {});
    }
    
}
