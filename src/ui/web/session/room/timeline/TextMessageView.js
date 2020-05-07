import {TemplateView} from "../../../general/TemplateView.js";

export class TextMessageView extends TemplateView {
    render(t, vm) {
        // no bindings ... should this be a template view?
        return t.li(
            {className: {"TextMessageView": true, own: vm.isOwn, pending: vm.isPending}},
            t.div({className: "message-container"}, [
                t.div({className: "sender"}, vm => vm.isContinuation ? "" : vm.sender),
                t.p([vm.text, t.time(vm.date + " " + vm.time)]),
            ])
        );
    }
}
