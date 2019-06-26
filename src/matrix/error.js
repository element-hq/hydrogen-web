export class HomeServerError extends Error {
    constructor(method, url, body) {
        super(`${body.error} on ${method} ${url}`);
        this.errcode = body.errcode;
    }
}

export class RequestAbortError extends Error {
}

export class NetworkError extends Error { 
}
