import {TemplateView} from "../../../general/TemplateView.js";

export class ImageView extends TemplateView {
    render(t, vm) {
        return t.li(
            {className: {"TextMessageView": true, own: vm.isOwn, pending: vm.isPending}},
            t.div({className: "message-container"}, [
                t.div({className: "sender"}, vm => vm.isContinuation ? "" : vm.sender),
                t.div(t.a({href: vm.url, target: "_blank"},
                    t.img({src: vm.thumbnailUrl, width: vm.thumbnailWidth, heigth: vm.thumbnailHeigth, loading: "lazy", alt: vm.label}))),
                t.p(t.time(vm.date + " " + vm.time)),
            ])
        );
    }
}
