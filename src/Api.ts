import * as Types from "@wpazderski/kvapi-types";
import { AppInfoApi } from "./specificApis/AppInfoApi";
import { EntriesApi } from "./specificApis/EntriesApi";
import { GenericApi, GenericApiOptions, RequestHeaders } from "./GenericApi";
import { SessionsApi } from "./specificApis/SessionsApi";
import { UsersApi } from "./specificApis/UsersApi";
import { Encryption } from "./Encryption";

interface UserPrivateData {
    encryptionKey: string;
}

export interface ApiOptions extends Omit<GenericApiOptions, "commonHeadersProvider"> {
}

export class Api {
    
    private _appInfoApi: AppInfoApi;
    private _publicEntriesApi: EntriesApi;
    private _privateEntriesApi: EntriesApi;
    private _sessionsApi: SessionsApi;
    private _usersApi: UsersApi;
    private _userSessionId: Types.data.session.Id | null = null;
    private _user: Types.data.user.UserWithoutPassword | null = null;
    private _userPasswordBasedEncryption: Encryption | null = null;
    protected _genericApi: GenericApi;
    
    get appInfo(): AppInfoApi {
        return this._appInfoApi;
    }
    
    get publicEntries(): EntriesApi {
        return this._publicEntriesApi;
    }
    
    get privateEntries(): EntriesApi {
        return this._privateEntriesApi;
    }
    
    get sessions(): SessionsApi {
        return this._sessionsApi;
    }
    
    get users(): UsersApi {
        return this._usersApi;
    }
    
    get userSessionId(): Types.data.session.Id | null {
        return this.parentApi ? this.parentApi.userSessionId : this._userSessionId;
    }
    private set userSessionId(sessionId: Types.data.session.Id | null) {
        if (this.parentApi) {
            this.parentApi.userSessionId = sessionId;
        }
        else {
            this._userSessionId = sessionId;
        }
    }
    
    get user(): Types.data.user.UserWithoutPassword | null {
        return this.parentApi ? this.parentApi.user : this._user;
    }
    private set user(userId: Types.data.user.UserWithoutPassword | null) {
        if (this.parentApi) {
            this.parentApi.user = userId;
        }
        else {
            this._user = userId;
        }
    }
    
    get userPasswordBasedEncryption(): Encryption | null {
        return this.parentApi ? this.parentApi.userPasswordBasedEncryption : this._userPasswordBasedEncryption;
    }
    private set userPasswordBasedEncryption(userPasswordBasedEncryption: Encryption | null) {
        if (this.parentApi) {
            this.parentApi.userPasswordBasedEncryption = userPasswordBasedEncryption;
        }
        else {
            this._userPasswordBasedEncryption = userPasswordBasedEncryption;
        }
    }
    
    get genericApi(): GenericApi {
        return this._genericApi;
    }
    
    constructor(protected baseUrl: string, private options?: Partial<ApiOptions>, private parentApi: Api | null = null) {
        this._genericApi = new GenericApi(
            baseUrl,
            {
                ...this.options,
                commonHeadersProvider: () => {
                    const headers: RequestHeaders = {};
                    if (this.userSessionId !== null) {
                        headers["kvapi-session-id"] = this.userSessionId;
                    }
                    return headers;
                },
            },
            parentApi ? parentApi.genericApi : null,
        );
        this._appInfoApi = new AppInfoApi(this.genericApi);
        this._publicEntriesApi = new EntriesApi(this.genericApi, "public");
        this._privateEntriesApi = new EntriesApi(this.genericApi, "private");
        this._sessionsApi = new SessionsApi(
            this.genericApi,
            {
                onSessionStarted: (response, userPassword) => this.onSessionStarted(response, userPassword),
                onSessionTerminated: () => this.onSessionTerminated(),
            },
        );
        this._usersApi = new UsersApi(
            this.genericApi,
            {
                onBeforeUserUpdated: async (userId, request) => this.onBeforeUserUpdated(userId, request),
                onUserUpdated: async (user, plainPassword) => this.onUserUpdated(user, plainPassword),
            },
        );
    }
    
    private async onSessionStarted(createSessionResponse: Types.api.sessions.CreateSessionResponse, userPassword: Types.data.user.PlainPassword): Promise<void> {
        this.userSessionId = createSessionResponse.id;
        this.user = createSessionResponse.user;
        if (!this.genericApi.isE2EEncrypted()) {
            return;
        }
        const passwordBasedKey = await Encryption.generateKeyFromPassword(userPassword);
        const passwordBasedEncryption = new Encryption(passwordBasedKey);
        this.userPasswordBasedEncryption = passwordBasedEncryption;
        let encryptionKey: CryptoKey;
        if (createSessionResponse.user.privateData) {
            const privateData: UserPrivateData = JSON.parse(await passwordBasedEncryption.decrypt(createSessionResponse.user.privateData));
            encryptionKey = await Encryption.importKey(privateData.encryptionKey);
        }
        else {
            encryptionKey = await Encryption.generateRandomKey();
            const privateData: UserPrivateData = {
                encryptionKey: await Encryption.exportKey(encryptionKey),
            };
            const privateDataStr = await passwordBasedEncryption.encrypt(JSON.stringify(privateData)) as Types.data.user.PrivateData;
            await this.users.update(createSessionResponse.user.id, { privateData: privateDataStr });
        }
        this.genericApi.maybeInitEncryption(encryptionKey);
    }
    
    private async onSessionTerminated(): Promise<void> {
        this.userSessionId = null;
        this.user = null;
        this.userPasswordBasedEncryption = null;
        this.genericApi.disposeEncryption();
    }
    
    private async onBeforeUserUpdated(userId: Types.data.user.Id, request: Types.api.users.UpdateUserRequest): Promise<void> {
        if (!this.user) {
            return;
        }
        if (userId !== this.user.id) {
            return;
        }
        if (!this.genericApi.isE2EEncrypted()) {
            return;
        }
        if (!request.password) {
            return;
        }
        
        // Updating own password with e2ee enabled requires updating privateData
        const newPassword = request.password;
        const newPasswordBasedKey = await Encryption.generateKeyFromPassword(newPassword);
        const oldPasswordBasedEncryption = this.userPasswordBasedEncryption!;
        const newPasswordBasedEncryption = new Encryption(newPasswordBasedKey);
        let privateData: UserPrivateData;
        if (request.privateData) {
            try {
                privateData = JSON.parse(await newPasswordBasedEncryption.decrypt(request.privateData));
            }
            catch {
                privateData = JSON.parse(await oldPasswordBasedEncryption.decrypt(request.privateData));
            }
        }
        else {
            privateData = JSON.parse(await oldPasswordBasedEncryption.decrypt(this.user.privateData!));
        }
        const privateDataStr = await newPasswordBasedEncryption.encrypt(JSON.stringify(privateData)) as Types.data.user.PrivateData;
        request.privateData = privateDataStr;
    }
    
    private async onUserUpdated(user: Types.data.user.UserPublic | Types.data.user.UserWithoutPassword, plainPassword?: Types.data.user.PlainPassword): Promise<void> {
        if (!this.user) {
            return;
        }
        if (user.id !== this.user.id) {
            return;
        }
        if (this.genericApi.isE2EEncrypted() && plainPassword) {
            const newPasswordBasedKey = await Encryption.generateKeyFromPassword(plainPassword);
            const newPasswordBasedEncryption = new Encryption(newPasswordBasedKey);
            this.userPasswordBasedEncryption = newPasswordBasedEncryption;
        }
        this.user = {
            ...this.user,
            ...user,
        };
    }
    
    createBatchedApi(): Api {
        return new Api(this.baseUrl, { ...this.options, batchMode: true }, this);
    }
    
    executeBatch(): Promise<void> {
        return this.genericApi.executeBatch();
    }
    
}
