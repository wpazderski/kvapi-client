import * as Types from "@wpazderski/kvapi-types";
import { Encryption } from "../Encryption";
import { GenericApi } from "../GenericApi";

export interface SessionApiOptions {
    onSessionStarted: (response: Types.api.sessions.CreateSessionResponse, userPassword: Types.data.user.PlainPassword) => Promise<void>;
    onSessionTerminated: () => Promise<void>;
}

export class SessionsApi {
    
    constructor(private genericApi: GenericApi, private options: SessionApiOptions) {
    }
    
    async create(userLogin: Types.data.user.Login, userPassword: Types.data.user.PlainPassword): Promise<Types.api.sessions.CreateSessionResponse> {
        const plainUserPassword = userPassword;
        userPassword = await Encryption.sha512(userPassword);
        const request: Types.api.sessions.CreateSessionRequest = { userLogin, userPassword };
        const response: Types.api.sessions.CreateSessionResponse = await this.genericApi.post("sessions", request, false);
        if (response && response.id) {
            await this.options.onSessionStarted(response, plainUserPassword);
        }
        return response;
    }
    
    async update(): Promise<void> {
        await this.genericApi.patch<Types.api.sessions.UpdateSessionRequest, Types.api.sessions.UpdateSessionResponse>("sessions", {}, false);
    }
    
    async delete(): Promise<void> {
        await this.genericApi.delete<Types.api.sessions.DeleteSessionRequest, Types.api.sessions.DeleteSessionResponse>("sessions", {}, false);
        await this.options.onSessionTerminated();
    }
    
}
