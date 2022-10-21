import * as Types from "@wpazderski/kvapi-types";
import { Encryption } from "../Encryption";
import { InvalidParamError } from "../errors";
import { GenericApi } from "../GenericApi";

export interface UsersApiOptions {
    onBeforeUserUpdated: (userId: Types.data.user.Id, request: Types.api.users.UpdateUserRequest) => Promise<void>;
    onUserUpdated: (user: Types.data.user.UserPublic | Types.data.user.UserWithoutPassword) => Promise<void>;
}

export class UsersApi {
    
    constructor(private genericApi: GenericApi, private options: UsersApiOptions) {
    }
    
    async getAll(): Promise<Types.data.user.UsersPublic> {
        const result: Types.api.users.GetUsersResponse = await this.genericApi.get("users");
        return result.users;
    }
    
    async get(userId: Types.data.user.Id): Promise<Types.data.user.UserPublic | Types.data.user.UserWithoutPassword> {
        userId = userId.trim() as Types.data.user.Id;
        if (!userId) {
            throw new InvalidParamError("userId");
        }
        const result: Types.api.users.GetUserResponse = await this.genericApi.get(`users/${userId}`);
        return result.user;
    }
    
    async create(request: Types.api.users.CreateUserRequest): Promise<Types.data.user.UserPublic> {
        request = {
            login: request.login,
            password: await Encryption.sha512(request.password),
            role: request.role,
        };
        const result: Types.api.users.CreateUserResponse = await this.genericApi.post("users", request);
        return result.user;
    }
    
    async update(userId: Types.data.user.Id, request: Types.api.users.UpdateUserRequest): Promise<Types.data.user.UserPublic | Types.data.user.UserWithoutPassword> {
        userId = userId.trim() as Types.data.user.Id;
        if (!userId) {
            throw new InvalidParamError("userId");
        }
        const result: Types.api.users.UpdateUserResponse = await this.genericApi.buildRequestAsynchronously(async () => {
            request = { ...request };
            await this.options.onBeforeUserUpdated(userId, request);
            if (request.password) {
                request.password = await Encryption.sha512(request.password);
            }
            return () => this.genericApi.patch(`users/${userId}`, request);
        });
        if ("privateData" in result.user) {
            this.options.onUserUpdated({
                id: userId,
                login: result.user.login,
                role: result.user.role,
                lastPasswordUpdateTimestamp: result.user.lastPasswordUpdateTimestamp,
                privateData: result.user.privateData,
            });
        }
        else {
            this.options.onUserUpdated({
                id: userId,
                login: result.user.login,
                role: result.user.role,
            });
        }
        return result.user;
    }
    
    async delete(userId: Types.data.user.Id): Promise<void> {
        userId = userId.trim() as Types.data.user.Id;
        if (!userId) {
            throw new InvalidParamError("userId");
        }
        await this.genericApi.delete<Types.api.users.DeleteUserRequest, Types.api.users.DeleteUserResponse>(`users/${userId}`, {});
    }
    
}
