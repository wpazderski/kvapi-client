(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["KvapiClient"] = factory();
	else
		root["KvapiClient"] = factory();
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/Api.ts":
/*!********************!*\
  !*** ./src/Api.ts ***!
  \********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Api = void 0;
const AppInfoApi_1 = __webpack_require__(/*! ./specificApis/AppInfoApi */ "./src/specificApis/AppInfoApi.ts");
const EntriesApi_1 = __webpack_require__(/*! ./specificApis/EntriesApi */ "./src/specificApis/EntriesApi.ts");
const GenericApi_1 = __webpack_require__(/*! ./GenericApi */ "./src/GenericApi.ts");
const SessionsApi_1 = __webpack_require__(/*! ./specificApis/SessionsApi */ "./src/specificApis/SessionsApi.ts");
const UsersApi_1 = __webpack_require__(/*! ./specificApis/UsersApi */ "./src/specificApis/UsersApi.ts");
const Encryption_1 = __webpack_require__(/*! ./Encryption */ "./src/Encryption.ts");
class Api {
    constructor(baseUrl, options, parentApi = null) {
        this.baseUrl = baseUrl;
        this.options = options;
        this.parentApi = parentApi;
        this._userSessionId = null;
        this._user = null;
        this._userPasswordBasedEncryption = null;
        this._genericApi = new GenericApi_1.GenericApi(baseUrl, {
            ...this.options,
            commonHeadersProvider: () => {
                const headers = {};
                if (this.userSessionId !== null) {
                    headers["kvapi-session-id"] = this.userSessionId;
                }
                return headers;
            },
        }, parentApi ? parentApi.genericApi : null);
        this._appInfoApi = new AppInfoApi_1.AppInfoApi(this.genericApi);
        this._publicEntriesApi = new EntriesApi_1.EntriesApi(this.genericApi, "public");
        this._privateEntriesApi = new EntriesApi_1.EntriesApi(this.genericApi, "private");
        this._sessionsApi = new SessionsApi_1.SessionsApi(this.genericApi, {
            onSessionStarted: (response, userPassword) => this.onSessionStarted(response, userPassword),
            onSessionTerminated: () => this.onSessionTerminated(),
        });
        this._usersApi = new UsersApi_1.UsersApi(this.genericApi, {
            onBeforeUserUpdated: async (userId, request) => this.onBeforeUserUpdated(userId, request),
            onUserUpdated: async (user) => this.onUserUpdated(user),
        });
    }
    get appInfo() {
        return this._appInfoApi;
    }
    get publicEntries() {
        return this._publicEntriesApi;
    }
    get privateEntries() {
        return this._privateEntriesApi;
    }
    get sessions() {
        return this._sessionsApi;
    }
    get users() {
        return this._usersApi;
    }
    get userSessionId() {
        return this.parentApi ? this.parentApi.userSessionId : this._userSessionId;
    }
    set userSessionId(sessionId) {
        if (this.parentApi) {
            this.parentApi.userSessionId = sessionId;
        }
        else {
            this._userSessionId = sessionId;
        }
    }
    get user() {
        return this.parentApi ? this.parentApi.user : this._user;
    }
    set user(userId) {
        if (this.parentApi) {
            this.parentApi.user = userId;
        }
        else {
            this._user = userId;
        }
    }
    get userPasswordBasedEncryption() {
        return this.parentApi ? this.parentApi.userPasswordBasedEncryption : this._userPasswordBasedEncryption;
    }
    set userPasswordBasedEncryption(userPasswordBasedEncryption) {
        if (this.parentApi) {
            this.parentApi.userPasswordBasedEncryption = userPasswordBasedEncryption;
        }
        else {
            this._userPasswordBasedEncryption = userPasswordBasedEncryption;
        }
    }
    get genericApi() {
        return this._genericApi;
    }
    async onSessionStarted(createSessionResponse, userPassword) {
        this.userSessionId = createSessionResponse.id;
        this.user = createSessionResponse.user;
        if (!this.genericApi.isE2EEncrypted()) {
            return;
        }
        const passwordBasedKey = await Encryption_1.Encryption.generateKeyFromPassword(userPassword);
        const passwordBasedEncryption = new Encryption_1.Encryption(passwordBasedKey);
        this.userPasswordBasedEncryption = passwordBasedEncryption;
        let encryptionKey;
        if (createSessionResponse.user.privateData) {
            const privateData = JSON.parse(await passwordBasedEncryption.decrypt(createSessionResponse.user.privateData));
            encryptionKey = await Encryption_1.Encryption.importKey(privateData.encryptionKey);
        }
        else {
            encryptionKey = await Encryption_1.Encryption.generateRandomKey();
            const privateData = {
                encryptionKey: await Encryption_1.Encryption.exportKey(encryptionKey),
            };
            const privateDataStr = await passwordBasedEncryption.encrypt(JSON.stringify(privateData));
            await this.users.update(createSessionResponse.user.id, { privateData: privateDataStr });
        }
        this.genericApi.maybeInitEncryption(encryptionKey);
    }
    async onSessionTerminated() {
        this.userSessionId = null;
        this.user = null;
        this.userPasswordBasedEncryption = null;
        this.genericApi.disposeEncryption();
    }
    async onUserUpdated(user) {
        if (!this.user) {
            return;
        }
        if (user.id !== this.user.id) {
            return;
        }
        this.user = {
            ...this.user,
            ...user,
        };
    }
    async onBeforeUserUpdated(userId, request) {
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
        const newPasswordBasedKey = await Encryption_1.Encryption.generateKeyFromPassword(newPassword);
        const oldPasswordBasedEncryption = this.userPasswordBasedEncryption;
        const newPasswordBasedEncryption = new Encryption_1.Encryption(newPasswordBasedKey);
        let privateData;
        if (request.privateData) {
            try {
                privateData = JSON.parse(await newPasswordBasedEncryption.decrypt(request.privateData));
            }
            catch {
                privateData = JSON.parse(await oldPasswordBasedEncryption.decrypt(request.privateData));
            }
        }
        else {
            privateData = JSON.parse(await oldPasswordBasedEncryption.decrypt(this.user.privateData));
        }
        const privateDataStr = await newPasswordBasedEncryption.encrypt(JSON.stringify(privateData));
        this.userPasswordBasedEncryption = newPasswordBasedEncryption;
        request.privateData = privateDataStr;
    }
    createBatchedApi() {
        return new Api(this.baseUrl, { ...this.options, batchMode: true }, this);
    }
    executeBatch() {
        return this.genericApi.executeBatch();
    }
}
exports.Api = Api;


/***/ }),

/***/ "./src/Encryption.ts":
/*!***************************!*\
  !*** ./src/Encryption.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Encryption = void 0;
class Encryption {
    constructor(key) {
        this.key = key;
    }
    static async sha512(text) {
        const arrBuf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
        const arr = [...new Uint8Array(arrBuf)];
        return arr.map(x => x.toString(16).padStart(2, "0")).join("");
    }
    static uint8ArrayToString(arr) {
        return [...arr].map(x => String.fromCharCode(x)).join("");
    }
    static stringToUint8Array(str) {
        return Uint8Array.from(str.split("").map(chr => chr.charCodeAt(0)));
    }
    static uint16ArrayToString(arr) {
        return [...arr].map(x => String.fromCharCode(x)).join("");
    }
    static stringToUint16Array(str) {
        return Uint16Array.from(str.split("").map(chr => chr.charCodeAt(0)));
    }
    static async exportKey(key) {
        const arrBuff = await crypto.subtle.exportKey("raw", key);
        const str = this.uint8ArrayToString(new Uint8Array(arrBuff));
        const safeStr = btoa(str);
        return safeStr;
    }
    static async importKey(str) {
        const uint8Array = new Uint8Array(atob(str).split("").map(x => x.charCodeAt(0)));
        const key = await crypto.subtle.importKey("raw", uint8Array, {
            name: "AES-GCM",
        }, true, ["encrypt", "decrypt"]);
        return key;
    }
    static async generateRandomKey() {
        const key = await crypto.subtle.generateKey({
            name: "AES-GCM",
            length: 256,
        }, true, ["encrypt", "decrypt"]);
        return key;
    }
    static async generateKeyFromPassword(password) {
        const passwordData = new TextEncoder().encode(password);
        const hash = await crypto.subtle.digest("SHA-256", passwordData);
        const key = await crypto.subtle.importKey("raw", hash, {
            name: "AES-GCM",
        }, true, ["encrypt", "decrypt"]);
        return key;
    }
    async encrypt(data) {
        const encryptedData = await this.encryptCore(data);
        return JSON.stringify(encryptedData);
    }
    async decrypt(data) {
        const encryptedData = JSON.parse(data);
        return this.decryptCore(encryptedData);
    }
    async encryptCore(data) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: iv,
        }, this.key, Encryption.stringToUint16Array(data));
        return {
            data: btoa(Encryption.uint8ArrayToString(new Uint8Array(encryptedData))),
            iv: btoa(Encryption.uint8ArrayToString(iv)),
        };
    }
    async decryptCore(encryptedData) {
        const data = await crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: Encryption.stringToUint8Array(atob(encryptedData.iv)),
        }, this.key, Encryption.stringToUint8Array(atob(encryptedData.data)));
        return Encryption.uint16ArrayToString(new Uint16Array(data));
    }
    async encrypt16(data) {
        const encryptedData = await this.encryptCore16(data);
        return JSON.stringify(encryptedData);
    }
    async decrypt16(data) {
        const encryptedData = JSON.parse(data);
        return this.decryptCore16(encryptedData);
    }
    async encryptCore16(data) {
        const iv = crypto.getRandomValues(new Uint16Array(6));
        const encryptedData = await crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: iv,
        }, this.key, Encryption.stringToUint16Array(data));
        return {
            data: Encryption.uint16ArrayToString(new Uint16Array(encryptedData)),
            iv: Encryption.uint16ArrayToString(iv),
        };
    }
    async decryptCore16(encryptedData) {
        const data = await crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: Encryption.stringToUint16Array(encryptedData.iv),
        }, this.key, Encryption.stringToUint16Array(encryptedData.data));
        return Encryption.uint16ArrayToString(new Uint16Array(data));
    }
}
exports.Encryption = Encryption;


/***/ }),

/***/ "./src/GenericApi.ts":
/*!***************************!*\
  !*** ./src/GenericApi.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GenericApi = void 0;
const Deferred_1 = __webpack_require__(/*! ./utils/Deferred */ "./src/utils/Deferred.ts");
const ServerError_1 = __webpack_require__(/*! ./errors/ServerError */ "./src/errors/ServerError.ts");
const Encryption_1 = __webpack_require__(/*! ./Encryption */ "./src/Encryption.ts");
class GenericApi {
    constructor(baseUrl, options, parentGenericApi = null) {
        this.baseUrl = baseUrl;
        this.parentGenericApi = parentGenericApi;
        this.currentBatchedRequestsEx = [];
        this._encryption = null;
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
    get encryption() {
        return this.parentGenericApi ? this.parentGenericApi.encryption : this._encryption;
    }
    set encryption(encryption) {
        if (this.parentGenericApi) {
            this.parentGenericApi.encryption = encryption;
        }
        else {
            this._encryption = encryption;
        }
    }
    isE2EEncrypted() {
        return this.options.e2ee;
    }
    maybeInitEncryption(encryptionKey) {
        if (!this.options.e2ee || this.encryption) {
            return;
        }
        this.encryption = new Encryption_1.Encryption(encryptionKey);
    }
    disposeEncryption() {
        this.encryption = null;
    }
    async maybeEncrypt(data, entryAccess) {
        if (!this.shouldUseEncryption(entryAccess)) {
            return data;
        }
        const encrypted = await this.encryption.encrypt(data);
        return encrypted;
    }
    async maybeDecrypt(data, entryAccess) {
        if (!this.shouldUseEncryption(entryAccess)) {
            return data;
        }
        const decrypted = await this.encryption.decrypt(data);
        return decrypted;
    }
    shouldUseEncryption(entryAccess) {
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
    get(url, canBeBatched = true) {
        return this.request("get", url, undefined, canBeBatched);
    }
    post(url, data, canBeBatched = true) {
        return this.request("post", url, data, canBeBatched);
    }
    patch(url, data, canBeBatched = true) {
        return this.request("patch", url, data, canBeBatched);
    }
    put(url, data, canBeBatched = true) {
        return this.request("put", url, data, canBeBatched);
    }
    delete(url, data, canBeBatched = true) {
        return this.request("delete", url, data, canBeBatched);
    }
    request(method, url, data, canBeBatched = true) {
        if (this.options.batchMode && canBeBatched) {
            const deferred = new Deferred_1.Deferred();
            this.currentBatchedRequestsEx.push({ method, url, data, deferred });
            return deferred.getPromise();
        }
        else {
            return this.requestCore(method, url, data);
        }
    }
    async requestCore(method, url, data) {
        const headers = {
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
            let details;
            try {
                details = await response.json();
            }
            catch { }
            throw new ServerError_1.ServerError(response.status, response.statusText, details);
        }
    }
    getFullUrl(url) {
        if (url.startsWith("/")) {
            url = url.substring(1);
        }
        return this.baseUrl + url;
    }
    async executeBatch() {
        if (this.currentBatchedRequestsEx.length === 0) {
            return;
        }
        const batchedRequestsEx = this.currentBatchedRequestsEx;
        this.currentBatchedRequestsEx = [];
        const batchedRequestsExResolved = [];
        for (const batchedRequestEx of batchedRequestsEx) {
            if (batchedRequestEx instanceof Deferred_1.Deferred) {
                const req = await batchedRequestEx.getPromise();
                if (req !== null) {
                    batchedRequestsExResolved.push(req);
                }
            }
            else {
                batchedRequestsExResolved.push(batchedRequestEx);
            }
        }
        const batchedRequests = batchedRequestsExResolved.map(request => ({
            method: request.method,
            url: request.url,
            data: request.data,
        }));
        const data = {
            batchedRequests,
        };
        const result = await this.requestCore("post", "batch", data);
        for (let i = 0; i < batchedRequests.length; ++i) {
            try {
                const request = batchedRequestsExResolved[i];
                const response = result.batchedResponses[i];
                if (response.statusCode === 200) {
                    request.deferred.resolve(JSON.parse(response.response));
                }
                else {
                    let details;
                    try {
                        details = JSON.parse(response.response);
                    }
                    catch { }
                    request.deferred.reject(new ServerError_1.ServerError(response.statusCode, response.statusText, details));
                }
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    async buildRequestAsynchronously(builder) {
        if (!this.options.batchMode) {
            return (await builder())();
        }
        const deferred = new Deferred_1.Deferred();
        this.currentBatchedRequestsEx.push(deferred);
        try {
            const requestScheduler = await builder();
            const requestPromise = requestScheduler();
            const idx = this.currentBatchedRequestsEx.findIndex(req => req && !(req instanceof Deferred_1.Deferred) && req.deferred.getPromise() === requestPromise);
            if (idx < 0) {
                throw new Error("buildRequestAsynchronously: no batched request");
            }
            const batchedRequest = this.currentBatchedRequestsEx[idx];
            if (!batchedRequest || batchedRequest instanceof Deferred_1.Deferred) {
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
    getCurrentBatchSize() {
        return this.currentBatchedRequestsEx.length;
    }
}
exports.GenericApi = GenericApi;


/***/ }),

/***/ "./src/errors/InvalidParamError.ts":
/*!*****************************************!*\
  !*** ./src/errors/InvalidParamError.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InvalidParamError = void 0;
class InvalidParamError extends Error {
    constructor(paramName) {
        super(`Invalid param: ${paramName}`);
    }
}
exports.InvalidParamError = InvalidParamError;


/***/ }),

/***/ "./src/errors/ServerError.ts":
/*!***********************************!*\
  !*** ./src/errors/ServerError.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ServerError = void 0;
class ServerError extends Error {
    constructor(statusCode, statusText, details) {
        super(ServerError.getErrorMessage(statusCode, statusText, details));
        this.statusCode = statusCode;
        this.statusText = statusText;
        this.details = details;
    }
    static getErrorMessage(statusCode, statusText, details) {
        let msg = `Server error: ${statusCode} ${statusText}`;
        if (details) {
            msg += " (";
            if (typeof (details) === "object") {
                msg += JSON.stringify(details);
            }
            else {
                msg += details;
            }
            msg += ")";
        }
        return msg;
    }
    getStatusCode() {
        return this.statusCode;
    }
    getStatusMessage() {
        return this.statusText;
    }
    getDetails() {
        return this.details;
    }
}
exports.ServerError = ServerError;


/***/ }),

/***/ "./src/errors/index.ts":
/*!*****************************!*\
  !*** ./src/errors/index.ts ***!
  \*****************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(/*! ./InvalidParamError */ "./src/errors/InvalidParamError.ts"), exports);
__exportStar(__webpack_require__(/*! ./ServerError */ "./src/errors/ServerError.ts"), exports);


/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.utils = exports.specificApis = exports.errors = void 0;
exports.errors = __importStar(__webpack_require__(/*! ./errors */ "./src/errors/index.ts"));
exports.specificApis = __importStar(__webpack_require__(/*! ./specificApis */ "./src/specificApis/index.ts"));
exports.utils = __importStar(__webpack_require__(/*! ./utils */ "./src/utils/index.ts"));
__exportStar(__webpack_require__(/*! ./Api */ "./src/Api.ts"), exports);
__exportStar(__webpack_require__(/*! ./Encryption */ "./src/Encryption.ts"), exports);
__exportStar(__webpack_require__(/*! ./GenericApi */ "./src/GenericApi.ts"), exports);


/***/ }),

/***/ "./src/specificApis/AppInfoApi.ts":
/*!****************************************!*\
  !*** ./src/specificApis/AppInfoApi.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppInfoApi = void 0;
class AppInfoApi {
    constructor(genericApi) {
        this.genericApi = genericApi;
    }
    async get() {
        const response = await this.genericApi.get("app-info");
        return response;
    }
}
exports.AppInfoApi = AppInfoApi;


/***/ }),

/***/ "./src/specificApis/EntriesApi.ts":
/*!****************************************!*\
  !*** ./src/specificApis/EntriesApi.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EntriesApi = void 0;
const errors_1 = __webpack_require__(/*! ../errors */ "./src/errors/index.ts");
class EntriesApi {
    constructor(genericApi, entryAccess) {
        this.genericApi = genericApi;
        this.entryAccess = entryAccess;
    }
    async getAll() {
        const response = await this.genericApi.get(`${this.entryAccess}-entries`);
        const entries = {};
        for (const key in response.entries) {
            let value = response.entries[key];
            value = await this.genericApi.maybeDecrypt(value, this.entryAccess);
            entries[key] = value;
        }
        return entries;
    }
    async get(key) {
        key = key.trim();
        if (!key) {
            throw new errors_1.InvalidParamError("key");
        }
        const response = await this.genericApi.get(`${this.entryAccess}-entries/${key}`);
        return this.genericApi.maybeDecrypt(response.value, this.entryAccess);
    }
    async set(key, value) {
        key = key.trim();
        if (!key) {
            throw new errors_1.InvalidParamError("key");
        }
        await this.genericApi.buildRequestAsynchronously(async () => {
            value = await this.genericApi.maybeEncrypt(value, this.entryAccess);
            const request = { value };
            return () => this.genericApi.put(`${this.entryAccess}-entries/${key}`, request);
        });
    }
    async delete(key) {
        key = key.trim();
        if (!key) {
            throw new errors_1.InvalidParamError("key");
        }
        await this.genericApi.delete(`${this.entryAccess}-entries/${key}`, {});
    }
}
exports.EntriesApi = EntriesApi;


/***/ }),

/***/ "./src/specificApis/SessionsApi.ts":
/*!*****************************************!*\
  !*** ./src/specificApis/SessionsApi.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SessionsApi = void 0;
const Encryption_1 = __webpack_require__(/*! ../Encryption */ "./src/Encryption.ts");
class SessionsApi {
    constructor(genericApi, options) {
        this.genericApi = genericApi;
        this.options = options;
    }
    async create(userLogin, userPassword) {
        userPassword = await Encryption_1.Encryption.sha512(userPassword);
        const request = { userLogin, userPassword };
        const response = await this.genericApi.post("sessions", request, false);
        if (response && response.id) {
            await this.options.onSessionStarted(response, userPassword);
        }
        return response;
    }
    async update() {
        await this.genericApi.patch("sessions", {}, false);
    }
    async delete() {
        await this.genericApi.delete("sessions", {}, false);
        await this.options.onSessionTerminated();
    }
}
exports.SessionsApi = SessionsApi;


/***/ }),

/***/ "./src/specificApis/UsersApi.ts":
/*!**************************************!*\
  !*** ./src/specificApis/UsersApi.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersApi = void 0;
const Encryption_1 = __webpack_require__(/*! ../Encryption */ "./src/Encryption.ts");
const errors_1 = __webpack_require__(/*! ../errors */ "./src/errors/index.ts");
class UsersApi {
    constructor(genericApi, options) {
        this.genericApi = genericApi;
        this.options = options;
    }
    async getAll() {
        const result = await this.genericApi.get("users");
        return result.users;
    }
    async get(userId) {
        userId = userId.trim();
        if (!userId) {
            throw new errors_1.InvalidParamError("userId");
        }
        const result = await this.genericApi.get(`users/${userId}`);
        return result.user;
    }
    async create(request) {
        request = {
            login: request.login,
            password: await Encryption_1.Encryption.sha512(request.password),
            role: request.role,
        };
        const result = await this.genericApi.post("users", request);
        return result.user;
    }
    async update(userId, request) {
        userId = userId.trim();
        if (!userId) {
            throw new errors_1.InvalidParamError("userId");
        }
        const result = await this.genericApi.buildRequestAsynchronously(async () => {
            request = { ...request };
            await this.options.onBeforeUserUpdated(userId, request);
            if (request.password) {
                request.password = await Encryption_1.Encryption.sha512(request.password);
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
    async delete(userId) {
        userId = userId.trim();
        if (!userId) {
            throw new errors_1.InvalidParamError("userId");
        }
        await this.genericApi.delete(`users/${userId}`, {});
    }
}
exports.UsersApi = UsersApi;


/***/ }),

/***/ "./src/specificApis/index.ts":
/*!***********************************!*\
  !*** ./src/specificApis/index.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(/*! ./AppInfoApi */ "./src/specificApis/AppInfoApi.ts"), exports);
__exportStar(__webpack_require__(/*! ./EntriesApi */ "./src/specificApis/EntriesApi.ts"), exports);
__exportStar(__webpack_require__(/*! ./SessionsApi */ "./src/specificApis/SessionsApi.ts"), exports);
__exportStar(__webpack_require__(/*! ./UsersApi */ "./src/specificApis/UsersApi.ts"), exports);


/***/ }),

/***/ "./src/utils/Deferred.ts":
/*!*******************************!*\
  !*** ./src/utils/Deferred.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Deferred = void 0;
class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
    getPromise() {
        return this.promise;
    }
}
exports.Deferred = Deferred;


/***/ }),

/***/ "./src/utils/index.ts":
/*!****************************!*\
  !*** ./src/utils/index.ts ***!
  \****************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(/*! ./Deferred */ "./src/utils/Deferred.ts"), exports);


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.ts");
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=kvapi-client.js.map