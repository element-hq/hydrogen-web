import {createEvent, withTextBody, withSender} from "./event.js";
import {TimelineEvent} from "../matrix/storage/types";

export const TIMELINE_START_TOKEN = "timeline_start";

export function eventId(i: number): string {
    return `$event${i}`;
}

/** `from` is included, `to` is excluded */
export function eventIds(from: number, to: number): string[] {
    return [...Array(to-from).keys()].map(i => eventId(i + from));
}

export class TimelineMock {
    private _counter: number;
    private _dagOrder: TimelineEvent[];
    private _syncOrder: TimelineEvent[];
    private _defaultSender: string;

    constructor(defaultSender: string) {
        this._counter = 0;
        this._dagOrder = [];
        this._syncOrder = [];
        this._defaultSender = defaultSender;
    }

    _defaultEvent(id: string): TimelineEvent {
        return withTextBody(`This is event ${id}`, withSender(this._defaultSender, createEvent("m.room.message", id)));
    }

    _createEvent(func?: (eventId: string) => TimelineEvent): TimelineEvent {
        const id = eventId(this._counter++);
        return func ? func(id) : this._defaultEvent(id);
    }

    _createEvents(n: number, func?: (eventId: string) => TimelineEvent) {
        const events: TimelineEvent[] = [];
        for (let i = 0; i < n; i++) {
            events.push(this._createEvent(func));
        }
        return events;
    }

    insertAfter(token: string, n: number, func?: (eventId: string) => TimelineEvent) {
        const events = this._createEvents(n, func);
        const index = this._findIndex(token, "f", this._dagOrder);
        this._dagOrder.splice(index, 0, ...events);
        this._syncOrder.push(...events);
        return events[events.length - 1]?.event_id;
    }

    append(n: number, func?: (eventId: string) => TimelineEvent) {
        const events = this._createEvents(n, func);
        this._dagOrder.push(...events);
        this._syncOrder.push(...events);
        return events[events.length - 1]?.event_id;
    }

    _getStep(direction: "f" | "b") : 1 | -1 { 
        return direction === "f" ? 1 : -1;
    }

    _findIndex(token: string, direction: "f" | "b", eventOrdering: TimelineEvent[]): number {
        const step = this._getStep(direction);
        if (token === TIMELINE_START_TOKEN) {
            const firstSyncEvent = this._syncOrder[0];
            if (!firstSyncEvent) {
                // We have no events at all. Wherever you start looking,
                // you'll stop looking right away. Zero works as well as anything else.
                return 0;
            }
            const orderIndex = eventOrdering.findIndex(e => e.event_id === firstSyncEvent.event_id);
            return orderIndex;
        } 
        // All other tokens are (non-inclusive) event indices
        const index = eventOrdering.findIndex(e => e.event_id === token);
        if (index === -1) {
            // We didn't find this event token at all. What are we
            // even looking at?
            throw new Error("Invalid token passed to TimelineMock");
        }
        return index + step;
    }

    messages(begin: string, end: string | undefined, direction: "f" | "b", limit: number = 10) {
        const step = this._getStep(direction);
        let index = this._findIndex(begin, direction, this._dagOrder);
        const chunk: TimelineEvent[] = [];
        for (; limit > 0 && index >= 0 && index < this._dagOrder.length; index += step, limit--) {
            if (this._dagOrder[index].event_id === end) {
                break;
            }
            chunk.push(this._dagOrder[index]);
        }
        return {
            start: begin,
            end: chunk[chunk.length - 1]?.event_id || begin,
            chunk,
            state: []
        };
    }

    context(eventId: string, limit: number = 10) {
        if (limit <= 0) {
            throw new Error("Cannot fetch zero or less events!");
        }
        let eventIndex = this._dagOrder.findIndex(e => e.event_id === eventId);
        if (eventIndex === -1) {
            throw new Error("Fetching context for unknown event");
        }
        const event = this._dagOrder[eventIndex];
        let offset = 1;
        const eventsBefore: TimelineEvent[] = [];
        const eventsAfter: TimelineEvent[] = [];
        while (limit !== 0 && (eventIndex - offset >= 0 || eventIndex + offset < this._dagOrder.length)) {
            if (eventIndex - offset >= 0) {
                eventsBefore.push(this._dagOrder[eventIndex - offset]);
                limit--;
            }
            if (limit !== 0 && eventIndex + offset < this._dagOrder.length) {
                eventsAfter.push(this._dagOrder[eventIndex + offset]);
                limit--;
            }
            offset++;
        }
        return {
            start: eventsBefore[eventsBefore.length - 1]?.event_id || eventId,
            end: eventsAfter[eventsAfter.length - 1]?.event_id || eventId,
            event,
            events_before: eventsBefore,
            events_after: eventsAfter,
            state: []
        };
    }

    sync(since?: string, limit: number = 10) {
        const startAt = since ? this._findIndex(since, "f", this._syncOrder) : 0;
        const index = Math.max(this._syncOrder.length - limit, startAt);
        const limited = this._syncOrder.length - startAt > limit;
        const events: TimelineEvent[] = [];
        for(let i = index; i < this._syncOrder.length; i++) {
            events.push(this._syncOrder[i]);
        }
        return {
            next_batch: events[events.length - 1]?.event_id || since || TIMELINE_START_TOKEN,
            timeline: {
                prev_batch: events[0]?.event_id || since || TIMELINE_START_TOKEN,
                events,
                limited
            }
        }
    }
}

export function tests() {
    const SENDER = "@alice:hs.tdl";

    return {
        "Append events are returned via sync": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(10);
            const syncResponse = timeline.sync();
            const events = syncResponse.timeline.events.map(e => e.event_id);
            assert.deepEqual(events, eventIds(0, 10));
            assert.equal(syncResponse.timeline.limited, false);
        },
        "Limiting a sync properly limits the returned events": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(20);
            const syncResponse = timeline.sync(undefined, 10);
            const events = syncResponse.timeline.events.map(e => e.event_id);
            assert.deepEqual(events, eventIds(10, 20));
            assert.equal(syncResponse.timeline.limited, true);
        },
        "The context endpoint returns messages in DAG order around an event": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(30);
            const context = timeline.context(eventId(15));
            assert.equal(context.event.event_id, eventId(15));
            assert.deepEqual(context.events_before.map(e => e.event_id).reverse(), eventIds(10, 15));
            assert.deepEqual(context.events_after.map(e => e.event_id), eventIds(16, 21));
        },
        "The context endpoint returns the proper number of messages": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(30);
            for (const i of new Array(29).keys()) {
                const middleFetch = timeline.context(eventId(15), i + 1);
                assert.equal(middleFetch.events_before.length + middleFetch.events_after.length, i + 1);
                const startFetch = timeline.context(eventId(1), i + 1);
                assert.equal(startFetch.events_before.length + startFetch.events_after.length, i + 1);
                const endFetch = timeline.context(eventId(28), i + 1);
                assert.equal(endFetch.events_before.length + endFetch.events_after.length, i + 1);
            }
        },
        "The previous batch from a sync returns the previous events": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(20);
            const sync = timeline.sync(undefined, 10);
            const messages = timeline.messages(sync.timeline.prev_batch, undefined, "b");
            const events = messages.chunk.map(e => e.event_id).reverse();
            assert.deepEqual(events, eventIds(0, 10));
        },
        "Two consecutive message fetches are continuous if no new events are inserted": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(30);

            const sync = timeline.sync(undefined, 10);
            const messages1 = timeline.messages(sync.timeline.prev_batch, undefined, "b");
            const events1 = messages1.chunk.map(e => e.event_id).reverse();
            assert.deepEqual(events1, eventIds(10, 20));

            const messages2 = timeline.messages(messages1.end, undefined, "b");
            const events2 = messages2.chunk.map(e => e.event_id).reverse();
            assert.deepEqual(events2, eventIds(0, 10));
        },
        "Two consecutive message fetches detect newly inserted event": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(30);

            const messages1 = timeline.messages(eventId(20), undefined, "b", 10);
            const events1 = messages1.chunk.map(e => e.event_id).reverse();
            assert.deepEqual(events1, eventIds(10, 20));
            timeline.insertAfter(eventId(9), 1);

            const messages2 = timeline.messages(eventId(10), undefined, "b", 10);
            const events2 = messages2.chunk.map(e => e.event_id).reverse();
            const expectedEvents2 = eventIds(1, 10);
            expectedEvents2.push(eventId(30));
            assert.deepEqual(events2, expectedEvents2);
        },
        "A sync that receives no events has the same next batch as it started with": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(10);
            const sync1 = timeline.sync();
            const sync2 = timeline.sync(sync1.next_batch);
            assert.equal(sync1.next_batch, sync2.next_batch);
        }, 
        "An event inserted at the staart still shows up in a sync": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(30);
            const sync1 = timeline.sync(undefined, 10);
            const sync2 = timeline.sync(sync1.next_batch, 10)
            assert.deepEqual(sync2.timeline.events, []);
            assert.equal(sync2.timeline.limited, false);

            timeline.insertAfter(TIMELINE_START_TOKEN, 1);
            const sync3 = timeline.sync(sync2.next_batch, 10)
            const events = sync3.timeline.events.map(e => e.event_id);
            assert.deepEqual(events, [eventId(30)]);
        },
        "An event inserted at the start does not show up in a non-overlapping message fetch": assert => {
            const timeline = new TimelineMock(SENDER);
            timeline.append(30);
            const sync1 = timeline.sync(undefined, 10);
            const messages1 = timeline.messages(sync1.timeline.prev_batch, undefined, "f", 10);

            timeline.insertAfter(TIMELINE_START_TOKEN, 1);
            const messages2 = timeline.messages(sync1.timeline.prev_batch, undefined, "f", 10);
            assert.deepEqual(messages1.chunk, messages2.chunk);
        },
    }
}
