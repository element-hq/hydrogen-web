export class HomeServerError extends Error {
    constructor(method, url, body) {
        super(`${body.error} on ${method} ${url}`);
        this.errcode = body.errcode;
        this.retry_after_ms = body.retry_after_ms;
    }

    get isFatal() {
        switch (this.errcode) {
            
        }
    }
}

export class RequestAbortError extends Error {
}

export class NetworkError extends Error { 
}
