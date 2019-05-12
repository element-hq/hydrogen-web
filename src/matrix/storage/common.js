export const STORE_NAMES = Object.freeze(["session", "roomState", "roomSummary", "timelineEvents", "timelineFragments"]);

export const STORE_MAP = Object.freeze(STORE_NAMES.reduce((nameMap, name) => {
    nameMap[name] = name;
    return nameMap;
}, {}));
