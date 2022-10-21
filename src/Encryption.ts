export interface EncryptedData {
    data: string;
    iv: string;
}

export class Encryption {
    
    static async sha512<T extends string>(text: T): Promise<T> {
        const arrBuf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
        const arr = [...new Uint8Array(arrBuf)];
        return arr.map(x => x.toString(16).padStart(2, "0")).join("") as T;
    }
    
    private static uint8ArrayToString(arr: Uint8Array): string {
        return [...arr].map(x => String.fromCharCode(x)).join("");
    }
    
    private static stringToUint8Array(str: string): Uint8Array {
        return Uint8Array.from(str.split("").map(chr => chr.charCodeAt(0)));
    }
    
    private static uint16ArrayToString(arr: Uint16Array): string {
        return [...arr].map(x => String.fromCharCode(x)).join("");
    }
    
    private static stringToUint16Array(str: string): Uint16Array {
        return Uint16Array.from(str.split("").map(chr => chr.charCodeAt(0)));
    }
    
    static async exportKey(key: CryptoKey): Promise<string> {
        const arrBuff = await crypto.subtle.exportKey("raw", key);
        const str = this.uint8ArrayToString(new Uint8Array(arrBuff));
        const safeStr = btoa(str);
        return safeStr;
    }
    
    static async importKey(str: string): Promise<CryptoKey> {
        const uint8Array = new Uint8Array(atob(str).split("").map(x => x.charCodeAt(0)));
        const key = await crypto.subtle.importKey(
            "raw",
            uint8Array,
            {
                name: "AES-GCM",
            },
            true,
            [ "encrypt", "decrypt" ]);
        return key;
    }
    
    static async generateRandomKey(): Promise<CryptoKey> {
        const key = await crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
        return key;
    }
    
    static async generateKeyFromPassword(password: string): Promise<CryptoKey> {
        const passwordData = new TextEncoder().encode(password);
        const hash = await crypto.subtle.digest("SHA-256", passwordData);
        const key = await crypto.subtle.importKey(
            "raw",
            hash,
            {
                name: "AES-GCM",
            },
            true,
            [ "encrypt", "decrypt" ]);
        return key;
    }
    
    
    
    
    
    constructor(private key: CryptoKey) {
    }
    
    async encrypt(data: string): Promise<string> {
        const encryptedData = await this.encryptCore(data);
        return JSON.stringify(encryptedData);
    }
    
    async decrypt(data: string): Promise<string> {
        const encryptedData: EncryptedData = JSON.parse(data);
        return this.decryptCore(encryptedData);
    }
    
    private async encryptCore(data: string): Promise<EncryptedData> {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            this.key,
            Encryption.stringToUint16Array(data),
        );
        return {
            data: btoa(Encryption.uint8ArrayToString(new Uint8Array(encryptedData))),
            iv: btoa(Encryption.uint8ArrayToString(iv)),
        };
    }
    
    private async decryptCore(encryptedData: EncryptedData): Promise<string> {
        const data = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: Encryption.stringToUint8Array(atob(encryptedData.iv)),
            },
            this.key,
            Encryption.stringToUint8Array(atob(encryptedData.data)),
        );
        return Encryption.uint16ArrayToString(new Uint16Array(data));
    }
    
    
    
    
    
    
    async encrypt16(data: string): Promise<string> {
        const encryptedData = await this.encryptCore16(data);
        return JSON.stringify(encryptedData);
    }
    
    async decrypt16(data: string): Promise<string> {
        const encryptedData: EncryptedData = JSON.parse(data);
        return this.decryptCore16(encryptedData);
    }
    
    private async encryptCore16(data: string): Promise<EncryptedData> {
        const iv = crypto.getRandomValues(new Uint16Array(6));
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            this.key,
            Encryption.stringToUint16Array(data),
        );
        return {
            data: Encryption.uint16ArrayToString(new Uint16Array(encryptedData)),
            iv: Encryption.uint16ArrayToString(iv),
        };
    }
    
    private async decryptCore16(encryptedData: EncryptedData): Promise<string> {
        const data = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: Encryption.stringToUint16Array(encryptedData.iv),
            },
            this.key,
            Encryption.stringToUint16Array(encryptedData.data),
        );
        return Encryption.uint16ArrayToString(new Uint16Array(data));
    }
    
}
