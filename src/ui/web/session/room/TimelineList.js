import ListView from "../../general/ListView.js";
import GapView from "./timeline/GapView.js";
import TextMessageView from "./timeline/TextMessageView.js";
import AnnouncementView from "./timeline/AnnouncementView.js";

export default class TimelineList extends ListView {
    constructor(options = {}) {
        options.className = "Timeline";
        super(options, entry => {
            switch (entry.shape) {
                case "gap": return new GapView(entry);
                case "announcement": return new AnnouncementView(entry);
                case "message":return new TextMessageView(entry);
            }
        });
        this._atBottom = false;
    }

    loadList() {
        super.loadList();
        const root = this.root();
        root.scrollTop = root.scrollHeight;
    }

    onBeforeListChanged() {
        const root = this.root();
        const fromBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
        this._atBottom = fromBottom < 1;
    }

    onListChanged() {
        if (this._atBottom) {
            const root = this.root();
            root.scrollTop = root.scrollHeight;
        }
    }
}
