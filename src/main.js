import HomeServerApi from "./matrix/hs-api.js";
import Session from "./matrix/session.js";
import createIdbStorage from "./matrix/storage/idb/create.js";
import Sync from "./matrix/sync.js";
import ListView from "./ui/web/ListView.js";
import RoomTile from "./ui/web/RoomTile.js";

const HOST = "localhost";
const HOMESERVER = `http://${HOST}:8008`;
const USERNAME = "bruno1";
const USER_ID = `@${USERNAME}:${HOST}`;
const PASSWORD = "testtest";

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
	const hsApi = new HomeServerApi(homeserver);
	const loginData = await hsApi.passwordLogin(username, password).response();
	const sessionsJson = localStorage.getItem("morpheus_sessions_v1");
	const sessions = sessionsJson ? JSON.parse(sessionsJson) : [];
	const sessionId = (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString();
	console.log(loginData);
	sessions.push({userId: loginData.user_id, id: sessionId});
	localStorage.setItem("morpheus_sessions_v1", JSON.stringify(sessions));
	return {sessionId, loginData};
}

function showRooms(container, rooms) {
    const sortedRooms = rooms.sortValues((a, b) => a.name.localeCompare(b.name));
    const listView = new ListView(sortedRooms, (room) => new RoomTile(room));
    container.appendChild(listView.mount());
}

// eslint-disable-next-line no-unused-vars
export default async function main(label, button, container) {
	try {
		let sessionId = getSessionId(USER_ID);
		let loginData;
		if (!sessionId) {
			({sessionId, loginData} = await login(USERNAME, PASSWORD, HOMESERVER));
		}
		const storage = await createIdbStorage(`morpheus_session_${sessionId}`);
		const session = new Session(storage);
		if (loginData) {
			await session.setLoginData(loginData);
		}
		await session.load();
        showRooms(container, session.rooms);
		const hsApi = new HomeServerApi(HOMESERVER, session.accessToken);
		console.log("session loaded");
		if (!session.syncToken) {
			console.log("session needs initial sync");
		}
		const sync = new Sync(hsApi, session, storage);
		await sync.start();
		label.innerText = "sync running";
		button.addEventListener("click", () => sync.stop());
		sync.on("error", err => {
			label.innerText = "sync error";
			console.error("sync error", err);
		});
		sync.on("stopped", () => {
			label.innerText = "sync stopped";
		});
	} catch(err) {
		console.error(err);
	}
}
