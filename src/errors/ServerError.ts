export class ServerError extends Error {
    
    static getErrorMessage(statusCode: number, statusText: string, details: any): string {
        let msg = `Server error: ${statusCode} ${statusText}`;
        if (details) {
            msg += " (";
            if (typeof(details) === "object") {
                msg += JSON.stringify(details);
            }
            else {
                msg += details;
            }
            msg += ")";
        }
        return msg;
    }
    
    constructor(protected statusCode: number, protected statusText: string, protected details: any) {
        super(ServerError.getErrorMessage(statusCode, statusText, details));
    }
    
    getStatusCode(): number {
        return this.statusCode;
    }
    
    getStatusMessage(): string {
        return this.statusText;
    }
    
    getDetails(): any {
        return this.details;
    }
    
}
