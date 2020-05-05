import {TemplateView} from "../general/TemplateView.js";
import {spinner} from "../common.js";

export class SessionStatusView extends TemplateView {
    render(t, vm) {
        return t.div({className: {
            "SessionStatusView": true,
            "hidden": vm => !vm.isShown,
        }}, [
            spinner(t, {hidden: vm => !vm.isWaiting}),
            t.p(vm => vm.statusLabel),
            t.if(vm => vm.isConnectNowShown, t.createTemplate(t => t.button({onClick: () => vm.connectNow()}, "Retry now"))),
            window.DEBUG ? t.button({id: "showlogs"}, "Show logs") : ""
        ]);
    }
}
