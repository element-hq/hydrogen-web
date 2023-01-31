import {TemplateView} from "../../general/TemplateView";
import {spinner} from "../../common";
import {TimelineView} from "./TimelineView";
import {TimelineLoadingView} from "./TimelineLoadingView";
import {MessageComposer} from "./MessageComposer";
import {DisabledComposerView} from "./DisabledComposerView";
import {AvatarView} from "../../AvatarView";

export class PeekableRoomView extends TemplateView {

    constructor(vm, viewClassForTile) {
        super(vm);
        this._viewClassForTile = viewClassForTile;
    }

    render(t, vm) {
        return t.main({className: "RoomView middle"}, [
            // t.h2([
            //     vm.i18n`Peeking in room: ${vm.roomIdOrAlias}.`,
            // ]),
            t.div({className: "RoomHeader middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close room`}),
                // t.view(new AvatarView(vm, 32)),
                t.div({className: "room-description"}, [
                    t.h2(vm => vm.name),
                ]),
                // t.button({
                //     className: "button-utility room-options",
                //     "aria-label":vm.i18n`Room options`,
                //     onClick: evt => this._toggleOptionsMenu(evt)
                // })
            ]),
            t.div({className: "RoomView_body"}, [
                t.div({className: "RoomView_error"}, [
                    t.if(vm => vm.error, t => t.div(
                        [
                            t.p({}, vm => vm.error),
                            t.button({ className: "RoomView_error_closerButton", onClick: evt => vm.dismissError(evt) })
                        ])
                    )]),
                t.mapView(vm => vm.timelineViewModel, timelineViewModel => {
                    return timelineViewModel ?
                        new TimelineView(timelineViewModel, this._viewClassForTile) :
                        new TimelineLoadingView(vm);    // vm is just needed for i18n
                }),
                t.mapView(vm => vm.composerViewModel,
                    composerViewModel => {
                        switch (composerViewModel?.kind) {
                            case "composer":
                                return new MessageComposer(vm.composerViewModel, this._viewClassForTile);
                            case "disabled":
                                return new DisabledComposerView(vm.composerViewModel);
                        }
                    }),
            ])
        ]);
    }
}
