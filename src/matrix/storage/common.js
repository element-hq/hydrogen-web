export const STORE_NAMES = Object.freeze(["session", "roomState", "roomSummary", "timelineEvents", "timelineFragments"]);

export const STORE_MAP = Object.freeze(STORE_NAMES.reduce((nameMap, name) => {
    nameMap[name] = name;
    return nameMap;
}, {}));

export class StorageError extends Error {
    constructor(message, cause) {
        let fullMessage = message;
        if (cause) {
            fullMessage += ": ";
            if (cause.name) {
                fullMessage += `(${cause.name}) `;
            }
            fullMessage += cause.message;
        }
        super(fullMessage);
    }
}
