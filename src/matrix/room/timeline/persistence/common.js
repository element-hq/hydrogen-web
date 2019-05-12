export function createEventEntry(key, event) {
    return {
        fragmentId: key.fragmentId,
        eventIndex: key.eventIndex,
        event: event,
    };
}