import {TemplateView} from "../../general/TemplateView";
import {spinner} from "../../common";

export class PeekableRoomView extends TemplateView {
    constructor(vm, viewClassForTile) {
        super(vm);
    }

    render(t, vm) {
        return t.main({className: "UnknownRoomView middle"}, t.div([
            t.h2([
                vm.i18n`Peeking in room: ${vm.roomIdOrAlias}.`,
                t.br(),
                spinner(t),
                vm.i18n`Loading messages..`
            ])
        ]));
    }
}
