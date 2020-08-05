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
    constructor(options = {}) {
        options.className = "Timeline";
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
        this._viewModel = null;
    }

    async _onScroll() {
        const root = this.root();
        if (root.scrollTop === 0 && !this._topLoadingPromise && this._viewModel) {
            const beforeFromBottom = this._distanceFromBottom();
            this._topLoadingPromise = this._viewModel.loadAtTop();
            await this._topLoadingPromise;
            const fromBottom = this._distanceFromBottom();
            const amountGrown = fromBottom - beforeFromBottom;
            root.scrollTop = root.scrollTop + amountGrown;
            this._topLoadingPromise = null;
        }
    }

    update(attributes) {
        if(attributes.viewModel) {
            this._viewModel = attributes.viewModel;
            attributes.list = attributes.viewModel.tiles;
        }
        super.update(attributes);
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
        root.scrollTop = root.scrollHeight;
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
        if (this._atBottom) {
            const root = this.root();
            root.scrollTop = root.scrollHeight;
        }
    }
}
