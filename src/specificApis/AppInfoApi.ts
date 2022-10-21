import * as Types from "@wpazderski/kvapi-types";
import { GenericApi } from "../GenericApi";

export class AppInfoApi {
    
    constructor(private genericApi: GenericApi) {
    }
    
    async get(): Promise<Types.api.appInfo.GetAppInfoResponse> {
        const response: Types.api.appInfo.GetAppInfoResponse = await this.genericApi.get("app-info");
        return response;
    }
    
}
