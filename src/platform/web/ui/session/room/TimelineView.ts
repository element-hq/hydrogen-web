/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {ListView} from "../../general/ListView";
import {TemplateView, TemplateBuilder} from "../../general/TemplateView.js";
import {GapView} from "./timeline/GapView.js";
import {TextMessageView} from "./timeline/TextMessageView.js";
import {ImageView} from "./timeline/ImageView.js";
import {VideoView} from "./timeline/VideoView.js";
import {FileView} from "./timeline/FileView.js";
import {MissingAttachmentView} from "./timeline/MissingAttachmentView.js";
import {AnnouncementView} from "./timeline/AnnouncementView.js";
import {RedactedView} from "./timeline/RedactedView.js";
import {SimpleTile} from "../../../../../domain/session/room/timeline/tiles/SimpleTile.js";
import {TimelineViewModel} from "../../../../../domain/session/room/timeline/TimelineViewModel.js";
import {BaseObservableList as ObservableList} from "../../../../../observable/list/BaseObservableList.js";

type TileView = GapView | AnnouncementView | TextMessageView |
    ImageView | VideoView | FileView | MissingAttachmentView | RedactedView;
type TileViewConstructor = (this: TileView, SimpleTile) => void;

export function viewClassForEntry(entry: SimpleTile): TileViewConstructor | undefined {
    switch (entry.shape) {
        case "gap": return GapView;
        case "announcement": return AnnouncementView;
        case "message":
        case "message-status":
            return TextMessageView;
        case "image": return ImageView;
        case "video": return VideoView;
        case "file": return FileView;
        case "missing-attachment": return MissingAttachmentView;
        case "redacted":
            return RedactedView;
    }
}

function bottom(node: HTMLElement): number {
    return node.offsetTop + node.clientHeight;
}

function findFirstNodeIndexAtOrBelow(tiles: HTMLElement, top: number, startIndex: number = (tiles.children.length - 1)): number {
    for (var i = startIndex; i >= 0; i--) {
        const node = tiles.children[i] as HTMLElement;
        if (node.offsetTop < top) {
            return i;
        }
    }
    // return first item if nothing matched before
    return 0;
}

export class TimelineView extends TemplateView<TimelineViewModel> {

    private anchoredNode?: HTMLElement;
    private anchoredBottom: number = 0;
    private stickToBottom: boolean = true;
    private tilesView?: TilesListView;

    render(t: TemplateBuilder, vm: TimelineViewModel) {
        this.tilesView = new TilesListView(vm.tiles, () => this.restoreScrollPosition());
        return t.div({className: "Timeline bottom-aligned-scroll", onScroll: () => this.onScroll()}, [
            t.view(this.tilesView)
        ]);
    }

    private restoreScrollPosition() {
        const timeline = this.root() as HTMLElement;
        const tiles = this.tilesView!.root() as HTMLElement;

        const missingTilesHeight = timeline.clientHeight - tiles.clientHeight;
        if (missingTilesHeight > 0) {
            tiles.style.setProperty("margin-top", `${missingTilesHeight}px`);
            // we don't have enough tiles to fill the viewport, so set all as visible
            const len = this.value.tiles.length;
            this.updateVisibleRange(0, len - 1, false);
        } else {
            tiles.style.removeProperty("margin-top");
            if (this.stickToBottom) {
                timeline.scrollTop = timeline.scrollHeight;
            } else if (this.anchoredNode) {
                const newAnchoredBottom = bottom(this.anchoredNode!);
                if (newAnchoredBottom !== this.anchoredBottom) {
                    const bottomDiff = newAnchoredBottom - this.anchoredBottom;
                    console.log(`restore: scroll by ${bottomDiff} as height changed`);
                    timeline.scrollBy(0, bottomDiff);
                    this.anchoredBottom = newAnchoredBottom;
                } else {
                    console.log("restore: bottom didn't change, must be below viewport");
                }
            }
        }
    }

    private onScroll(): void {
        const timeline = this.root() as HTMLElement;
        const {scrollHeight, scrollTop, clientHeight} = timeline;
        const tiles = this.tilesView!.root() as HTMLElement;

        let bottomNodeIndex;
        this.stickToBottom = Math.abs(scrollHeight - (scrollTop + clientHeight)) < 5;
        if (this.stickToBottom) {
            const len = this.value.tiles.length;
            bottomNodeIndex = len - 1;
        } else {
            const viewportBottom = scrollTop + clientHeight;
            const anchoredNodeIndex = findFirstNodeIndexAtOrBelow(tiles, viewportBottom);
            this.anchoredNode = tiles.childNodes[anchoredNodeIndex] as HTMLElement;
            this.anchoredBottom = bottom(this.anchoredNode!);
            bottomNodeIndex = anchoredNodeIndex;
        }
        let topNodeIndex = findFirstNodeIndexAtOrBelow(tiles, scrollTop, bottomNodeIndex);
        this.updateVisibleRange(topNodeIndex, bottomNodeIndex, true);
    }

    private updateVisibleRange(startIndex: number, endIndex: number, isViewportFilled: boolean) {
        const firstVisibleChild = this.tilesView!.getChildInstanceByIndex(startIndex);
        const lastVisibleChild = this.tilesView!.getChildInstanceByIndex(endIndex);
        if (firstVisibleChild && lastVisibleChild) {
            this.value.setVisibleTileRange(firstVisibleChild.value, lastVisibleChild.value, isViewportFilled);
        }
    }
}

class TilesListView extends ListView<SimpleTile, TileView> {

    private onChanged: () => void;

    constructor(tiles: ObservableList<SimpleTile>, onChanged: () => void) {
        const options = {
            list: tiles,
            onItemClick: (tileView, evt) => tileView.onClick(evt),
        };
        super(options, entry => {
            const View = viewClassForEntry(entry);
            if (View) {
                return new View(entry);
            }
        });
        this.onChanged = onChanged;
    }

    protected onUpdate(index: number, value: SimpleTile, param: any) {
        if (param === "shape") {
            const ExpectedClass = viewClassForEntry(value);
            const child = this.getChildInstanceByIndex(index);
            if (!ExpectedClass || !(child instanceof ExpectedClass)) {
                // shape was updated, so we need to recreate the tile view,
                // the shape parameter is set in EncryptedEventTile.updateEntry
                // (and perhaps elsewhere by the time you read this)
                super.recreateItem(index, value);
                return;
            }
        }
        super.onUpdate(index, value, param);
        this.onChanged();
    }

    protected onAdd(idx: number, value: SimpleTile) {
        super.onAdd(idx, value);
        this.onChanged();
    }

    protected onRemove(idx: number, value: SimpleTile) {
        super.onRemove(idx, value);
        this.onChanged();
    }

    protected onMove(fromIdx: number, toIdx: number, value: SimpleTile) {
        super.onMove(fromIdx, toIdx, value);
        this.onChanged();
    }
}
