import {parseRooms} from "./common";

// TODO make abortable
export async function initialSync(network, session) {
	const response = await network.sync().response();
	const rooms = await createRooms(response.rooms, session);
	const sessionData = {syncToken: response.next_batch};
	const accountData = response.account_data;
	await session.applySync(rooms, response.next_batch, response.account_data);
}

function createRooms(responseSections, session) {
	const roomPromises = parseRooms(responseSections, (roomId, roomResponse, membership) => {
		const room = await session.createRoom(roomId);
		await room.initialSync(roomResponse, membership);
		return room;
	});
	return Promise.all(roomPromises);
}
