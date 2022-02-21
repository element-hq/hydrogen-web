/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {BaseObservableValue, ObservableValue} from "../../observable/ObservableValue";

type SegmentType = {
    "login": true;
    "session": string;
    "sso": string;
    "logout": true;
    "room": string;
    "rooms": string[];
    "settings": true;
    "create-room": true;
    "empty-grid-tile": number;
    "lightbox": string;
    "right-panel": boolean;
    "details": true;
    "members": true;
    "member": string;
};

type AllowsChild<T> = (parent: Segment<T> | undefined, child: Segment<T>) => boolean;

export class Navigation<T> {
    private readonly _allowsChild: AllowsChild<T>;
    private _path: Path<T>;
    private readonly _observables: Map<keyof T, SegmentObservable<T>> = new Map();
    private readonly _pathObservable: ObservableValue<Path<T>>;

    constructor(allowsChild: AllowsChild<T>) {
        this._allowsChild = allowsChild;
        this._path = new Path([], allowsChild);
        this._pathObservable = new ObservableValue(this._path);
    }

    get pathObservable(): ObservableValue<Path<T>> {
        return this._pathObservable;
    }

    get path(): Path<T> {
        return this._path;
    }

    push<K extends keyof T>(type: K, ...value: T[K] extends true? [undefined?]: [T[K]]): void {
        const newPath = this.path.with(new Segment(type, ...value));
        if (newPath) {
            this.applyPath(newPath);
        }
    }

    applyPath(path: Path<T>): void {
        // Path is not exported, so you can only create a Path through Navigation,
        // so we assume it respects the allowsChild rules
        const oldPath = this._path;
        this._path = path;
        // clear values not in the new path in reverse order of path
        for (let i = oldPath.segments.length - 1; i >= 0; i -= 1) {
            const segment = oldPath.segments[i];
            if (!this._path.get(segment.type)) {
                const observable = this._observables.get(segment.type);
                observable?.emitIfChanged();
            }
        }
        // change values in order of path
        for (const segment of this._path.segments) {
            const observable = this._observables.get(segment.type);
            observable?.emitIfChanged();
        }
        // to observe the whole path having changed
        // Since paths are immutable,
        // we can just use set here which will compare the references
        this._pathObservable.set(this._path);
    }

    observe(type: keyof T): SegmentObservable<T> {
        let observable = this._observables.get(type);
        if (!observable) {
            observable = new SegmentObservable(this, type);
            this._observables.set(type, observable);
        }
        return observable;
    }

    pathFrom(segments: Segment<any>[]): Path<T> {
        let parent: Segment<any> | undefined;
        let i: number;
        for (i = 0; i < segments.length; i += 1) {
            if (!this._allowsChild(parent, segments[i])) {
                return new Path(segments.slice(0, i), this._allowsChild);
            }
            parent = segments[i];
        }
        return new Path(segments, this._allowsChild);
    }

    segment<K extends keyof T>(type: K, ...value: T[K] extends true? [undefined?]: [T[K]]): Segment<T> {
        return new Segment(type, ...value);
    }
}

function segmentValueEqual<T>(a?: T[keyof T], b?: T[keyof T]): boolean {
    if (a === b) {
        return true;
    }
    // allow (sparse) arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i += 1) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
    return false;
}


export class Segment<T, K extends keyof T = any> {
    public value: T[K];

    constructor(public type: K, ...value: T[K] extends true? [undefined?]: [T[K]]) {
        this.value = (value[0] === undefined ? true : value[0]) as unknown as T[K];
    }
}

class Path<T> {
    private readonly _segments: Segment<T, any>[];
    private readonly _allowsChild: AllowsChild<T>;

    constructor(segments: Segment<T>[] = [], allowsChild: AllowsChild<T>) {
        this._segments = segments;
        this._allowsChild = allowsChild;
    }

    clone(): Path<T> {
        return new Path(this._segments.slice(), this._allowsChild);
    }

    with(segment: Segment<T>): Path<T> | null {
        let index = this._segments.length - 1;
        do {
            if (this._allowsChild(this._segments[index], segment)) {
                // pop the elements that didn't allow the new segment as a child
                const newSegments = this._segments.slice(0, index + 1);
                newSegments.push(segment);
                return new Path(newSegments, this._allowsChild);
            }
            index -= 1;
        } while(index >= -1);
        // allow -1 as well so we check if the segment is allowed as root
        return null;
    }

    until(type: keyof T): Path<T> {
        const index = this._segments.findIndex(s => s.type === type);
        if (index !== -1) {
            return new Path(this._segments.slice(0, index + 1), this._allowsChild)
        }
        return new Path([], this._allowsChild);
    }

    get(type: keyof T): Segment<T> | undefined {
        return this._segments.find(s => s.type === type);
    }

    replace(segment: Segment<T>): Path<T> | null {
        const index = this._segments.findIndex(s => s.type === segment.type);
        if (index !== -1) {
            const parent = this._segments[index - 1];
            if (this._allowsChild(parent, segment)) {
                const child = this._segments[index + 1];
                if (!child || this._allowsChild(segment, child)) {
                    const newSegments = this._segments.slice();
                    newSegments[index] = segment;
                    return new Path(newSegments, this._allowsChild);
                }
            }
        }
        return null;
    }

    get segments(): Segment<T>[] {
        return this._segments;
    }
}

/**
 * custom observable so it always returns what is in navigation.path, even if we haven't emitted the change yet.
 * This ensures that observers of a segment can also read the most recent value of other segments.
 */
class SegmentObservable<T> extends BaseObservableValue<T[keyof T] | undefined> {
    private readonly _navigation: Navigation<T>;
    private _type: keyof T;
    private _lastSetValue?: T[keyof T];
        
    constructor(navigation: Navigation<T>, type: keyof T) {
        super();
        this._navigation = navigation;
        this._type = type;
        this._lastSetValue = navigation.path.get(type)?.value;
    }

    get(): T[keyof T] | undefined {
        const path = this._navigation.path;
        const segment = path.get(this._type);
        const value = segment?.value;
        return value;
    }

    emitIfChanged(): void {
        const newValue = this.get();
        if (!segmentValueEqual<T>(newValue, this._lastSetValue)) {
            this._lastSetValue = newValue;
            this.emit(newValue);
        }
    }
}

export function tests() {

    function createMockNavigation() {
        return new Navigation((parent, {type}) => {
            switch (parent?.type) {
                case undefined:
                    return type === "1" || type === "2";
                case "1":
                    return type === "1.1";
                case "1.1":
                    return type === "1.1.1";
                case "2":
                    return type === "2.1" || type === "2.2";
                default:
                    return false;
            }
        });
    }

    function observeTypes(nav, types) {
        const changes: {type:string, value:any}[] = [];
        for (const type of types) {
            nav.observe(type).subscribe(value => {
                changes.push({type, value});
            });
        }
        return changes;
    }

    type SegmentType = {
        "foo": number;
        "bar": number;
        "baz": number;
    }

    return {
        "applying a path emits an event on the observable": assert => {
            const nav = createMockNavigation();
            const path = nav.pathFrom([
                new Segment("2", 7),
                new Segment("2.2", 8),
            ]);
            assert.equal(path.segments.length, 2);
            let changes = observeTypes(nav, ["2", "2.2"]);
            nav.applyPath(path);
            assert.equal(changes.length, 2);
            assert.equal(changes[0].type, "2");
            assert.equal(changes[0].value, 7);
            assert.equal(changes[1].type, "2.2");
            assert.equal(changes[1].value, 8);
        },
        "path.get": assert => {
            const path = new Path<SegmentType>([new Segment("foo", 5), new Segment("bar", 6)], () => true);
            assert.equal(path.get("foo")!.value, 5);
            assert.equal(path.get("bar")!.value, 6);
        },
        "path.replace success": assert => {
            const path = new Path<SegmentType>([new Segment("foo", 5), new Segment("bar", 6)], () => true);
            const newPath = path.replace(new Segment("foo", 1));
            assert.equal(newPath!.get("foo")!.value, 1);
            assert.equal(newPath!.get("bar")!.value, 6);
        },
        "path.replace not found": assert => {
            const path = new Path<SegmentType>([new Segment("foo", 5), new Segment("bar", 6)], () => true);
            const newPath = path.replace(new Segment("baz", 1));
            assert.equal(newPath, null);
        }
    };
}
