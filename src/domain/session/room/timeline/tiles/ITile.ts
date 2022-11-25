import {UpdateAction} from "../UpdateAction.js";
import {BaseEntry} from "../../../../../matrix/room/timeline/entries/BaseEntry";
import {BaseEventEntry} from "../../../../../matrix/room/timeline/entries/BaseEventEntry";
import {IDisposable} from "../../../../../utils/Disposables";

export type EmitUpdateFn = (tile: ITile<BaseEntry>, props: any) => void

export enum TileShape {
    Message = "message",
    MessageStatus = "message-status",
    Announcement = "announcement",
    File = "file",
    Gap = "gap",
    Image = "image",
    Location = "location",
    MissingAttachment = "missing-attachment",
    Redacted = "redacted",
    Video = "video",
    DateHeader = "date-header"
}

// TODO: should we imply inheriting from view model here?
export interface ITile<E extends BaseEntry = BaseEntry> extends IDisposable {
    setUpdateEmit(emitUpdate: EmitUpdateFn): void;
    get upperEntry(): E;
    get lowerEntry(): E;
    compare(tile: ITile<BaseEntry>): number;
    compareEntry(entry: BaseEntry): number;
    // update received for already included (falls within sort keys) entry
    updateEntry(entry: BaseEntry, param: any): UpdateAction;
    // return whether the tile should be removed
    // as SimpleTile only has one entry, the tile should be removed
    removeEntry(entry: BaseEntry): boolean
    // SimpleTile can only contain 1 entry
    tryIncludeEntry(): boolean;
    // let item know it has a new sibling
    updatePreviousSibling(prev: ITile<BaseEntry> | undefined): void;
    // let item know it has a new sibling
    updateNextSibling(next: ITile<BaseEntry> | undefined): void;
    notifyVisible(): void;
    get needsDateSeparator(): boolean;
    createDateSeparator(): ITile<BaseEntry> | undefined;
    get shape(): TileShape;
}
