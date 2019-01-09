class Request {
	constructor(promise, controller) {
		this._promise = promise;
		this._controller = controller;
	}

	abort() {
		this._controller.abort();
	}

	get response() {
		return this._promise;
	}
}

export class Network {
	constructor(homeserver, accessToken) {
		this._homeserver = homeserver;
		this._accessToken = accessToken;
	}

	_url(csPath) {
		return `${this._homeserver}/_matrix/client/r0/${csPath}`;
	}

	_request(method, csPath, queryParams = {}) {
		const queryString = Object.entries(queryParams)
			.filter(([name, value]) => value !== undefined)
			.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
			.join("&");
		const url = this._url(`${csPath}?${queryString}`);
		const request = new Request(url);
		const headers = request.headers;
		headers.append("Authorization", `Bearer ${this._accessToken}`);
		headers.append("Accept", "application/json");
		if (false/* body */) {
			headers.append("Content-Type", "application/json");
		}
		const controller = new AbortController();
		// TODO: set authenticated headers with second arguments, cache them
		let promise = fetch(request, {signal: controller.signal});
		promise = promise.then(response => {
			if (response.ok) {
				return response.json();
			} else {
				switch (response.status) {
					default:
						throw new HomeServerError(response.json())
				}
			}
		});
		return new Request(promise, controller);
	}

	sync(timeout = 0, since = undefined) {
		return this._request("GET", "/sync", {since, timeout});
	}
}