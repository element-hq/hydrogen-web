export const STORE_NAMES = Object.freeze([
    "session",
    "roomState",
    "roomSummary",
    "roomMembers",
    "timelineEvents",
    "timelineFragments",
    "pendingEvents",
]);

export const STORE_MAP = Object.freeze(STORE_NAMES.reduce((nameMap, name) => {
    nameMap[name] = name;
    return nameMap;
}, {}));

export class StorageError extends Error {
    constructor(message, cause, value) {
        let fullMessage = message;
        if (cause) {
            fullMessage += ": ";
            if (typeof cause.name === "string") {
                fullMessage += `(name: ${cause.name}) `;
            }
            if (typeof cause.code === "number") {
                fullMessage += `(code: ${cause.name}) `;
            }
            fullMessage += cause.message;
        }
        super(fullMessage);
        if (cause) {
            this.errcode = cause.name;
        }
        this.cause = cause;
        this.value = value;
    }
}
