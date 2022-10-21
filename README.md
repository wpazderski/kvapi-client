# kvapi-client
Client library for [kvapi-server](https://github.com/wpazderski/kvapi-server): CRUD API for key-value storage with authentication, authorization and optional end-to-end encryption

## Requirements
* Modern web browser
* HTTPS
* [kvapi-server](https://github.com/wpazderski/kvapi-server)
* Node.js 14+ (for development)

## Installation via npm; usage
```
npm install @wpazderski/kvapi-client
```
```ts
import { Api } from "@wpazderski/kvapi-client";

const api = new Api("/api");
api.appInfo.get().then(console.log).catch(console.error);
```

## Usage without npm
```html
<script type="text/javascript" src="kvapi-client.min.js"></script>
<script type="text/javascript">
    const api = new Api("/api");
    api.appInfo.get().then(console.log).catch(console.error);
</script>
```

## Development

### Installation 
```
git clone https://github.com/wpazderski/kvapi-client
npm install
```

### Building
```
// Development:
npm run build-dev
// Production:
npm run build-prod
```
### Building with watch mode
```
// Development:
npm run watch-dev
// Production:
npm run watch-prod
```

## End-to-end encryption
To use e2ee, enable it by setting `options.e2ee` to true in `App` constructor.
* Client-side: private entry values are encrypted and decrypted with user's private key.
* Server-side: server or anyone with access to the server can't read the data.

## Creating users
1. Admin creates a new user with a temporary password.
1. Admin sends the temporary password to the user.
1. User logs in and changes the password (see `api.users.update`).
1. App can prompt user to change the password based on user's `lastPasswordUpdateTimestamp` (see `api.sessions.create`).

## Api
### constructor()
The constructor takes two arguments:
* path where server listens to api requests (string),
* an optional options object:
```ts
{
    batchMode?: boolean; // Whether to enable batchMode
    e2ee?: boolean; // Whether to enable end-to-end encryption
}
```

### api.createBatchedApi(): void
Creates a new child instance of `Api` with option `batchMode` set to `true`. This is the preferred way of creating batched APIs.

Requests in this `Api` instance won't be executed until `Api.executeBatch()` is called.

Session requests can't be batched (will be executed immediately).

### api.executeBatch(): Promise<void>
Executes all requests in current batch. All requests will be performed using only one HTTP request.

### api.appInfo.get()
Returns public information about the server app.

Returned value:
```ts
Promise<{
    // Whether dev mode is enabled (see server configuration - .env file)
    devMode: boolean;
    
    // Whether at least one user is in the database
    hasAnyUsers: boolean;
    
    // Session will be terminated after this time since last activity.
    // Unit: milliseconds.
    sessionMaxInactivityTime: number;
    
    // Max size of entry values in bytes.
    valueMaxSize: number;
    
    // Max number of private entries per user.
    privateDbMaxNumEntries: number;
    
    // Max size of all private entries (key+value) in bytes (per user).
    privateDbMaxSize: number;
    
    // Whether /public-entries API is disabled
    disablePublicEntries: boolean;
}>
```
If `hasAnyUsers` is false, `api.users.create()` can be used to create the first user (admin).

### api.publicEntries.getAll()
Returns all entries.
```ts
Promise<{
    [key: string]: string;
}>
```

### api.publicEntries.get(key: string): Promise<string>
Returns value of the entry with specified key.

### api.publicEntries.set(key: string, value: string): Promise<void>
Creates a new entry or updates an existing entry.

### api.publicEntries.delete(key: string): Promise<void>
Deletes the entry.

### api.privateEntries.*
`api.privateEntries.*` is almost identical to `api.publicEntries.*`. The only differences are:
* Private entries are private (scope: current user), whereas entries in `api.publicEntries.*` are shared.
* Only authenticated user can access this api, whereas `api.publicEntries.*` can be accessed by everyone.

### api.sessions.create(login: string, password: string)
Starts a session ("login").

Returned value:
```ts
Promise<{
    // Session ID; will be automatically used in future requests to authenticate the user
    id: data.session.Id;
    
    // Current user
    user: {
        // User ID (random string)
        id: data.user.Id;
        
        // User's login
        login: string;
        
        // "authorized" or "admin" (regular user or admin)
        role: data.user.Role;
        
        // String with user's private data;
        // encrypted JSON string with user's private key;
        // used internally by the client API
        privateData: data.user.PrivateData | null;
        
        // Value returned by Date.now() when the user updated their password;
        // 0 if user has never changed their password (still uses temporary password)
        lastPasswordUpdateTimestamp: number;
    },
}>
```

### api.sessions.update(): Promise<void>
Updates session last activity time (prevents automatic logout). Every request has the same effect, so `api.sessions.update()` ("heartbeat") has to be used only if automatic logout due to inactivity is not desired (as long as user has the webpage open).

### api.sessions.delete(): Promise<void>
Terminates current session ("logout").

### api.sessions notes
* Session ID is automatically managed by the API:
    * Session ID will be present in all requests after successful `api.sessions.create()` (user auth).
    * Session ID will not be present in requests after successful `api.sessions.delete()` call.
* `privateData`:
    * Is a string encrypted with key generated based on user's password. Decryption/encryption is performed on client's device.
    * It contains a JSON string with user's key used for decrypting/encrypting other values of private entries.
    * You can use this property, but don't change `encryptionKey`. It's recommended to see source code (kvapi-client) for correct encryption/decryption method.
    * Value of this property can be changed via `api.users.update()`.
    * The recommended way of storing custom private data is via `entries` API, not `privateData` field.

### api.users.getAll()
Returns list of all users. Only admins have access to this method.

Returned value:
```ts
Promise<Array<{
    id: string;
    login: string;
    role: "authorized" | "admin"; // Regular user or admin
}>>;
```

### api.users.get(userId: string)
Returns information about specified user.
* Admins have full access to this method.
* Regular users can use this method with their user ID.

Returned value if `userId` is someone else's user ID:
```ts
Promise<{
    // User ID (random string)
    id: data.user.Id;
    
    // User's login
    login: string;
    
    // "authorized" or "admin" (regular user or admin)
    role: data.user.Role;
}>
```
Returned value if `userId` is own user ID:
```ts
Promise<{
    id: data.user.Id;
    login: string;
    role: data.user.Role;
    
    // String with user's private data;
    // encrypted JSON string with user's private key;
    // used internally by the client API
    privateData: data.user.PrivateData | null;
    
    // Value returned by Date.now() when the user updated their password;
    // 0 if user has never changed their password (still uses temporary password)
    lastPasswordUpdateTimestamp: number;
}>
```

### api.users.create(createUserRequest: CreateUserRequest)
Creates a user.
* If there is at least one user in the database, only admins have access to this method.
* If there are no users in the database, there are no access restriction (creating the first user). The first user must have `role="admin"`.

CreateUserRequest:
```ts
{
    login: string; // 1-128 characters, unique
    password: string; // 1-128 characters (server doesn't check password strength)
    role: "authorized" | "admin"; // Regular user or admin
}
```

Returned value:
```ts
Promise<{
    id: string;
    login: string;
    role: "authorized" | "admin"; // Regular user or admin
}>
```

### api.users.update(userId: string, updateUserRequest: UpdateUserRequest)
Updates specified user.
* Only admins can update other users.
* Only admins can update logins.
* Updating own role is not permitted.
* Updating someone else's password is not permitted.
* Updating someone else's privateData is not permitted.
* All properties are optional. Properties that are missing won't be updated.
* If e2ee is enabled and password is being changed, privateData will be updated too.

UpdateUserRequest:
```ts
{
    login?: string; // 1-128 characters, unique
    password?: string; // 1-128 characters (server doesn't check password strength)
    role?: "authorized" | "admin"; // Regular user or admin
    privateData?: string | null; // User's private data; only own privateData can be updated
}
```

Returned value if `userId` is someone else's user ID:
```ts
Promise<{
    // User ID (random string)
    id: data.user.Id;
    
    // User's login
    login: string;
    
    // "authorized" or "admin" (regular user or admin)
    role: data.user.Role;
}>
```
Returned value if `userId` is own user ID:
```ts
Promise<{
    id: data.user.Id;
    login: string;
    role: data.user.Role;
    
    // String with user's private data;
    // encrypted JSON string with user's private key;
    // used internally by the client API
    privateData: data.user.PrivateData | null;
    
    // Value returned by Date.now() when the user updated their password;
    // 0 if user has never changed their password (still uses temporary password)
    lastPasswordUpdateTimestamp: number;
}>
```

### api.users.delete(userId: string): Promise<void>
Deletes specified user.
* Only admins can delete users.
* Deleting own account is not permitted.

## API method validation
Parameters that are used in URLs are validated before performing a request. If validation fails, an instance of `errors.InvalidParamError` will be thrown.

Examples: keys in entries API, user IDs in users API.

This prevents calling a different method if the parameter is empty. For example `/users/:userId` with empty `:userId` results in `/users/`, which is a different API method.

## API errors
If a request fails, an instance of `errors.ServerError` will be thrown. For complete list of error codes see [kvapi-server](https://github.com/wpazderski/kvapi-server) documentation.

## Other resources
* See [kvapi-server](https://github.com/wpazderski/kvapi-server) documentation for more information (e.g. size limit for entry values).
