export class HomeServerError extends Error {
	constructor(method, url, body) {
		super(`${body.error} on ${method} ${url}`);
		this.errcode = body.errcode;
	}
}

export class StorageError extends Error {
}

export class RequestAbortError extends Error {

}