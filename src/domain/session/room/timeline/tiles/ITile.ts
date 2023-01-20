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
    DateHeader = "date-header",
    Call = "call",
}

// TODO: should we imply inheriting from view model here?
export interface ITile<E extends BaseEntry = BaseEntry> extends IDisposable {
    setUpdateEmit(emitUpdate: EmitUpdateFn): void;
    get upperEntry(): E;
    get lowerEntry(): E;
    /** compare two tiles, returning:
     *  - 0 if both tiles are considered equal
     *  - a negative value if this tiles is sorted before the given tile
     *  - a positive value if this tiles is sorted after the given tile
     **/
    compare(tile: ITile<BaseEntry>): number;
    /** Some tiles might need comparison mechanisms that are not commutative,
     * (e.g. `tileA.compare(tileB)` not being the same as `tileB.compare(tileA)`),
     * a property needed for reliably sorting the tiles in TilesCollection.
     * To counteract this, tiles can indicate this is not the case for them and
     * when any other tile is being compared to a tile where this flag is true,
     * it should delegate the comparison to the given tile.
     * E.g. one example where this flag is used is DateTile. */
    get comparisonIsNotCommutative(): boolean;
    compareEntry(entry: BaseEntry): number;
    // update received for already included (falls within sort keys) entry
    updateEntry(entry: BaseEntry, param: any): UpdateAction;
    // return whether the tile should be removed
    // as SimpleTile only has one entry, the tile should be removed
    removeEntry(entry: BaseEntry): boolean
    // SimpleTile can only contain 1 entry
    tryIncludeEntry(entry: BaseEntry): boolean;
    // let item know it has a new sibling
    updatePreviousSibling(prev: ITile<BaseEntry> | undefined): void;
    // let item know it has a new sibling
    updateNextSibling(next: ITile<BaseEntry> | undefined): void;
    notifyVisible(): void;
    get needsDateSeparator(): boolean;
    createDateSeparator(): ITile<BaseEntry> | undefined;
    get shape(): TileShape;
}
