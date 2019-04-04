export const STORE_NAMES = Object.freeze(["session", "roomState", "roomSummary", "roomTimeline"]);

export const STORE_MAP = Object.freeze(STORE_NAMES.reduce((nameMap, name) => {
    nameMap[name] = name;
    return nameMap;
}, {}));
