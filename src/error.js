export class HomeServerError extends Error {
	constructor(body) {
		super(body.error);
		this.errcode = body.errcode;
	}
}