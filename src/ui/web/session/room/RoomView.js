import {TemplateView} from "../../general/TemplateView.js";
import {TimelineList} from "./TimelineList.js";
import {MessageComposer} from "./MessageComposer.js";

export class RoomView extends TemplateView {
    constructor(viewModel) {
        super(viewModel);
        this._timelineList = null;
    }

    render(t, vm) {
        this._timelineList = new TimelineList();
        return t.div({className: "RoomView"}, [
            t.div({className: "TimelinePanel"}, [
                t.div({className: "RoomHeader"}, [
                    t.button({className: "back", onClick: () => vm.close()}),
                    t.div({className: "avatar large"}, vm => vm.avatarInitials),
                    t.div({className: "room-description"}, [
                        t.h2(vm => vm.name),
                    ]),
                ]),
                t.div({className: "RoomView_error"}, vm => vm.error),
                t.view(this._timelineList),
                t.view(new MessageComposer(this.value.composerViewModel)),
            ])
        ]);
    }

    update(value, prop) {
        super.update(value, prop);
        if (prop === "timelineViewModel") {
            this._timelineList.update({viewModel: this.value.timelineViewModel});
        }
    }
}
