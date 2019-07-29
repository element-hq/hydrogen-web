import HomeServerApi from "./matrix/hs-api.js";
import Session from "./matrix/session.js";
import createIdbStorage from "./matrix/storage/idb/create.js";
import Sync from "./matrix/sync.js";
import SessionView from "./ui/web/session/SessionView.js";
import SessionViewModel from "./domain/session/SessionViewModel.js";

const HOST = "127.0.0.1";
const HOMESERVER = `http://${HOST}:8008`;
const USERNAME = "bruno1";
const USER_ID = `@${USERNAME}:localhost`;
const PASSWORD = "testtest";

function getSessionInfo(userId) {
    const sessionsJson = localStorage.getItem("brawl_sessions_v1");
    if (sessionsJson) {
        const sessions = JSON.parse(sessionsJson);
        const session = sessions.find(session => session.userId === userId);
        if (session) {
            return session;
        }
    }
}

function storeSessionInfo(loginData) {
    const sessionsJson = localStorage.getItem("brawl_sessions_v1");
    const sessions = sessionsJson ? JSON.parse(sessionsJson) : [];
    const sessionId = (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString();
    const sessionInfo = {
        id: sessionId,
        deviceId: loginData.device_id,
        userId: loginData.user_id,
        homeServer: loginData.home_server,
        accessToken: loginData.access_token,
    };
    sessions.push(sessionInfo);
    localStorage.setItem("brawl_sessions_v1", JSON.stringify(sessions));
    return sessionInfo;
}

async function login(username, password, homeserver) {
    const hsApi = new HomeServerApi(homeserver);
    const loginData = await hsApi.passwordLogin(username, password).response();
    return storeSessionInfo(loginData);
}

function showSession(container, session, sync) {
    const vm = new SessionViewModel(session, sync);
    const view = new SessionView(vm);
    container.appendChild(view.mount());
}

export default async function main(container) {
    try {
        let sessionInfo = getSessionInfo(USER_ID);
        if (!sessionInfo) {
            sessionInfo = await login(USERNAME, PASSWORD, HOMESERVER);
        }
        const storage = await createIdbStorage(`brawl_session_${sessionInfo.id}`);
        const hsApi = new HomeServerApi(HOMESERVER, sessionInfo.accessToken);
        const session = new Session({storage, hsApi, sessionInfo: {
            deviceId: sessionInfo.deviceId,
            userId: sessionInfo.userId,
            homeServer: sessionInfo.homeServer, //only pass relevant fields to Session
        }});
        await session.load();
        console.log("session loaded");
        const sync = new Sync(hsApi, session, storage);
        const needsInitialSync = !session.syncToken;
        if (needsInitialSync) {
            console.log("session needs initial sync");
        } else {
            showSession(container, session, sync);
        }
        await sync.start();
        if (needsInitialSync) {
            showSession(container, session, sync);
        }
        // this will start sending unsent messages
        session.notifyNetworkAvailable();
    } catch(err) {
        console.error(`${err.message}:\n${err.stack}`);
    }
}
