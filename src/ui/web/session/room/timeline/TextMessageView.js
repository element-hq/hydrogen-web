import TemplateView from "../../../general/TemplateView.js";

export default class TextMessageView extends TemplateView {
    render(t, vm) {
        return t.li(
            {className: {"TextMessageView": true, own: vm.isOwn}},
            t.div({className: "message-container"}, [
                t.div({className: "sender"}, vm.sender),
                t.p([vm.text, t.time(vm.time)]),
            ])
        );
    }
}
