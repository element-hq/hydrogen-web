import {TemplateView} from "../../../general/TemplateView.js";

export class ImageView extends TemplateView {
    render(t, vm) {
        const image = t.img({
            src: vm.thumbnailUrl,
            width: vm.thumbnailWidth,
            height: vm.thumbnailHeight,
            loading: "lazy",
            style: `max-width: ${vm.thumbnailWidth}px`,
            alt: vm.label,
        });
        const linkContainer = t.a({
            href: vm.url,
            target: "_blank"
        }, image);

        return t.li(
            {className: {"TextMessageView": true, own: vm.isOwn, pending: vm.isPending}},
            t.div({className: "message-container"}, [
                t.div({className: "sender"}, vm => vm.isContinuation ? "" : vm.sender),
                t.div(linkContainer),
                t.p(t.time(vm.date + " " + vm.time)),
            ])
        );
    }
}
