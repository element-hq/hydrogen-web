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

import {ListView} from "../../general/ListView.js";
import {GapView} from "./timeline/GapView.js";
import {TextMessageView} from "./timeline/TextMessageView.js";
import {ImageView} from "./timeline/ImageView.js";
import {VideoView} from "./timeline/VideoView.js";
import {FileView} from "./timeline/FileView.js";
import {MissingAttachmentView} from "./timeline/MissingAttachmentView.js";
import {AnnouncementView} from "./timeline/AnnouncementView.js";
import {RedactedView} from "./timeline/RedactedView.js";

export function viewClassForEntry(entry) {
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

export class TimelineList extends ListView {
    constructor(viewModel) {
        const options = {
            className: "Timeline bottom-aligned-scroll",
            list: viewModel.tiles,
            onItemClick: (tileView, evt) => tileView.onClick(evt),
        }
        super(options, entry => {
            const View = viewClassForEntry(entry);
            if (View) {
                return new View(entry);
            }
        });
        this._atBottom = false;
        this._onScroll = this._onScroll.bind(this);
        this._topLoadingPromise = null;
        this._viewModel = viewModel;
    }

    async _loadAtTopWhile(predicate) {
        if (this._topLoadingPromise) {
            return;
        }
        try {
            while (predicate()) {
                // fill, not enough content to fill timeline
                this._topLoadingPromise = this._viewModel.loadAtTop();
                const shouldStop = await this._topLoadingPromise;
                if (shouldStop) {
                    break;
                }
            }
        }
        catch (err) {
            console.error(err);
            //ignore error, as it is handled in the VM
        }
        finally {
            this._topLoadingPromise = null;
        }
    }

    async _onScroll() {
        const PAGINATE_OFFSET = 100;
        const root = this.root();
        if (root.scrollTop < PAGINATE_OFFSET && !this._topLoadingPromise && this._viewModel) {
            // to calculate total amountGrown to check when we stop loading
            let beforeContentHeight = root.scrollHeight;
            // to adjust scrollTop every time
            let lastContentHeight = beforeContentHeight;
            // load until pagination offset is reached again
            this._loadAtTopWhile(() => {
                const contentHeight = root.scrollHeight;
                const amountGrown = contentHeight - beforeContentHeight;
                root.scrollTop = root.scrollTop + (contentHeight - lastContentHeight);
                lastContentHeight = contentHeight;
                return amountGrown < PAGINATE_OFFSET;
            });
        }
    }

    mount() {
        const root = super.mount();
        root.addEventListener("scroll", this._onScroll);
        return root;
    }

    unmount() {
        this.root().removeEventListener("scroll", this._onScroll);
        super.unmount();
    }

    async loadList() {
        super.loadList();
        const root = this.root();
        // yield so the browser can render the list
        // and we can measure the content below
        await Promise.resolve();
        const {scrollHeight, clientHeight} = root;
        if (scrollHeight > clientHeight) {
            root.scrollTop = root.scrollHeight;
        }
        // load while viewport is not filled
        this._loadAtTopWhile(() => {
            const {scrollHeight, clientHeight} = root;
            return scrollHeight <= clientHeight;
        });
    }

    onBeforeListChanged() {
        const fromBottom = this._distanceFromBottom();
        this._atBottom = fromBottom < 1;
    }

    _distanceFromBottom() {
        const root = this.root();
        return root.scrollHeight - root.scrollTop - root.clientHeight;
    }

    onListChanged() {
        const root = this.root();
        if (this._atBottom) {
            root.scrollTop = root.scrollHeight;
        }
    }

    onUpdate(index, value, param) {
        if (param === "shape") {
            if (this._childInstances) {
                const ExpectedClass = viewClassForEntry(value);
                const child = this._childInstances[index];
                if (!ExpectedClass || !(child instanceof ExpectedClass)) {
                    // shape was updated, so we need to recreate the tile view,
                    // the shape parameter is set in EncryptedEventTile.updateEntry
                    // (and perhaps elsewhere by the time you read this)
                    super.recreateItem(index, value);
                    return;
                }
            }
        }
        super.onUpdate(index, value, param);
    }
}
