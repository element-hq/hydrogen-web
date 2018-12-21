export function parseRooms(responseSections, roomMapper) {
	return ["join", "invite", "leave"].map(membership => {
		const membershipSection = responseSections[membership];
		const results = Object.entries(membershipSection).map(([roomId, roomResponse]) => {
			const room = roomMapper(roomId, membership);
			return room.processInitialSync(roomResponse);
		});
		return results;
	}).reduce((allResults, sectionResults) => allResults.concat(sectionResults), []);
}