import BaseEntry from "./BaseEntry.js";

export default class FragmentBoundaryEntry extends BaseEntry {
    constructor(fragment, isFragmentStart, fragmentIdComparator) {
        super(fragmentIdComparator);
        this._fragment = fragment;
        this._isFragmentStart = isFragmentStart;
    }

    static start(fragment, fragmentIdComparator) {
        return new FragmentBoundaryEntry(fragment, true, fragmentIdComparator);
    }

    static end(fragment, fragmentIdComparator) {
        return new FragmentBoundaryEntry(fragment, false, fragmentIdComparator);
    }
    
    get hasStarted() {
        return this._isFragmentStart;
    }

    get hasEnded() {
        return !this.hasStarted;
    }

    get fragment() {
        return this._fragment;
    }

    get fragmentId() {
        return this._fragment.id;
    }

    get entryIndex() {
        if (this.hasStarted) {
            return Number.MIN_SAFE_INTEGER;
        } else {
            return Number.MAX_SAFE_INTEGER;
        }
    }

    get isGap() {
        if (this.hasStarted) {
            return !!this.fragment.nextToken;
        } else {
            return !!this.fragment.previousToken;
        }
    }
}
