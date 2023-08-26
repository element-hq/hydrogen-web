import {TemplateView} from "../../general/TemplateView";
import {TimelineView} from "./TimelineView";
import {viewClassForTile} from "./common";
import {TimelineLoadingView} from "./TimelineLoadingView";
import {AvatarView} from "../../AvatarView";

export class WorldReadableRoomView extends TemplateView {

    constructor(vm) {
        super(vm);
    }

    render(t, vm) {
        return t.div({className: "RoomView WorldReadableRoomView middle"}, [
            t.div({className: "RoomHeader middle-header"}, [
                t.view(new AvatarView(vm, 32)),
                t.div({className: "room-description"}, [
                    t.h2(vm => vm.room.name),
                ]),
            ]),
            t.div({className: "RoomView_body"}, [
                t.div({className: "RoomView_error"}, [
                    t.if(vm => vm.error, t => t.div([
                        t.p({}, vm => vm.error),
                        t.button({className: "RoomView_error_closerButton", onClick: evt => vm.dismissError(evt)})
                    ]))
                ]),
                t.mapView(vm => vm.timelineViewModel, timelineViewModel => {
                    return timelineViewModel ?
                        new TimelineView(timelineViewModel, viewClassForTile) :
                        new TimelineLoadingView(vm);    // vm is just needed for i18n
                }),
                t.div({className: "WorldReadableRoomComposerView"}, [
                    t.h3(vm => vm.i18n`Join the room to participate`),
                    t.button({
                        className: "joinRoomButton",
                        onClick: () => vm.join(),
                        disabled: vm => vm.busy,
                    }, vm.i18n`Join Room`)
                ])
            ])
        ]);
    }
}
