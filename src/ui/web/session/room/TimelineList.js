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
import {AnnouncementView} from "./timeline/AnnouncementView.js";

export class TimelineList extends ListView {
    constructor(viewModel) {
        const options = {
            className: "Timeline",
            list: viewModel.tiles,
        }
        super(options, entry => {
            switch (entry.shape) {
                case "gap": return new GapView(entry);
                case "announcement": return new AnnouncementView(entry);
                case "message": return new TextMessageView(entry);
                case "image": return new ImageView(entry);
            }
        });
        this._atBottom = false;
        this._onScroll = this._onScroll.bind(this);
        this._topLoadingPromise = null;
        this._viewModel = viewModel;
    }

    async _loadAtTopWhile(predicate) {
        try {
            while (predicate()) {
                // fill, not enough content to fill timeline
                this._topLoadingPromise = this._viewModel.loadAtTop();
                const startReached = await this._topLoadingPromise;
                if (startReached) {
                    break;
                }
            }
        }
        catch (err) {
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

    loadList() {
        super.loadList();
        const root = this.root();
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
}
