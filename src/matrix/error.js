export class HomeServerError extends Error {
    constructor(method, url, body, status) {
        super(`${body ? body.error : status} on ${method} ${url}`);
        this.errcode = body ? body.errcode : null;
        this.retry_after_ms = body ? body.retry_after_ms : 0;
        this.statusCode = status;
    }

    get isFatal() {
        switch (this.errcode) {
            
        }
    }
}

export {AbortError} from "../utils/error.js";

export class ConnectionError extends Error { 
}
