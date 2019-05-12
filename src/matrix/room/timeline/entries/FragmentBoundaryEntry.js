import BaseEntry from "./BaseEntry.js";
import Direction from "../Direction.js";

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
    
    get started() {
        return this._isFragmentStart;
    }

    get hasEnded() {
        return !this.started;
    }

    get fragment() {
        return this._fragment;
    }

    get fragmentId() {
        return this._fragment.id;
    }

    get entryIndex() {
        if (this.started) {
            return Number.MIN_SAFE_INTEGER;
        } else {
            return Number.MAX_SAFE_INTEGER;
        }
    }

    get isGap() {
        return !!this.token;
    }

    get token() {
        if (this.started) {
            return this.fragment.nextToken;
        } else {
            return this.fragment.previousToken;
        }
    }

    set token(token) {
        if (this.started) {
            this.fragment.nextToken = token;
        } else {
            this.fragment.previousToken = token;
        }
    }

    get linkedFragmentId() {
        if (this.started) {
            return this.fragment.nextId;
        } else {
            return this.fragment.previousId;
        }
    }

    set linkedFragmentId(id) {
        if (this.started) {
            this.fragment.nextId = id;
        } else {
            this.fragment.previousId = id;
        }
    }

    get direction() {
        if (this.started) {
            return Direction.Backward;
        } else {
            return Direction.Forward;
        }
    }

    withUpdatedFragment(fragment) {
        return new FragmentBoundaryEntry(fragment, this._isFragmentStart, this._fragmentIdComparator);
    }

    createNeighbourEntry(neighbour) {
        return new FragmentBoundaryEntry(neighbour, !this._isFragmentStart, this._fragmentIdComparator);
    }
}
