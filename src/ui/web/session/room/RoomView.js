import TemplateView from "../../general/TemplateView.js";
import TimelineList from "./TimelineList.js";
import MessageComposer from "./MessageComposer.js";

export default class RoomView extends TemplateView {
    constructor(viewModel) {
        super(viewModel, true);
        this._timelineList = null;
    }

    render(t, vm) {
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
                this._timelineList.mount(),
                this._composer.mount(),
            ])
        ]);
    }

    mount() {
        this._composer = new MessageComposer(this.viewModel);
        this._timelineList = new TimelineList();
        return super.mount();
    }

    unmount() {
        this._composer.unmount();
        this._timelineList.unmount();
        super.unmount();
    }

    update(value, prop) {
        super.update(value, prop);
        if (prop === "timelineViewModel") {
            this._timelineList.update({viewModel: this.viewModel.timelineViewModel});
        }
    }
}
