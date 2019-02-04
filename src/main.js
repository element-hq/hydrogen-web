import Network from "./network.js";
import Session from "./session.js";
import createIdbStorage from "./storage/idb/factory.js";
const HOMESERVER = "http://localhost:8008";

async function getLoginData(username, password) {
	const storedCredentials = localStorage.getItem("morpheus_login");
	if (!storedCredentials) {
		const api = new Network(HOMESERVER);
		loginData = await api.passwordLogin(username, password).response();
		localStorage.setItem("morpheus_login", JSON.stringify(loginData));
		return loginData;
	} else {
		return JSON.parse(storedCredentials);
	}
}

async function main() {
	const loginData = await getLoginData("bruno1", "testtest");
	const network = new Network(HOMESERVER, loginData.access_token);
	const storage = await createIdbStorage("morpheus_session");
	const session = new Session(loginData, storage);
	await session.load();
	const sync = new Sync(network, session, storage);
	await sync.start();

	sync.on("error", err => {
		console.error("sync error", err);
	});
}

main().catch(err => console.error(err));