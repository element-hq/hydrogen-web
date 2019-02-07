import Network from "./network.js";
import Session from "./session.js";
import createIdbStorage from "./storage/idb/create.js";
const HOMESERVER = "http://localhost:8008";

function getSessionId(userId) {
	const sessionsJson = localStorage.getItem("morpheus_sessions_v1");
	if (sessionsJson) {
		const sessions = JSON.parse(sessionsJson);
		const session = sessions.find(session => session.userId === userId);
		if (session) {
			return session.id;
		}
	}
}

async function login(username, password, homeserver) {
	const api = new Network(homeserver);
	const loginData = await api.passwordLogin(username, password).response();
	const sessionsJson = localStorage.getItem("morpheus_sessions_v1");
	const sessions = sessionsJson ? JSON.parse(sessionsJson) : [];
	const sessionId = (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString();
	console.log(loginData);
	sessions.push({userId: loginData.user_id, id: sessionId});
	localStorage.setItem("morpheus_sessions_v1", JSON.stringify(sessions));
	return {sessionId, loginData};
}

async function main() {
	let sessionId = getSessionId("@bruno1:localhost");
	let loginData;
	if (!sessionId) {
		({sessionId, loginData} = await login("bruno1", "testtest", HOMESERVER));
	}
	const storage = await createIdbStorage(`morpheus_session_${sessionId}`);
	console.log("database created", storage);
	const session = new Session(storage);
	if (loginData) {
		await session.setLoginData(loginData);
	}
	await session.load();
	console.log("session loaded", session);
	return;
	const network = new Network(HOMESERVER, session.accessToken);
	const sync = new Sync(network, session, storage);
	await sync.start();

	sync.on("error", err => {
		console.error("sync error", err);
	});
}

main().catch(err => console.error(err));