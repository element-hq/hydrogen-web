import {TemplateView} from "../general/TemplateView.js";
import {spinner} from "../common.js";

export class SessionLoadView extends TemplateView {
    render(t) {
        return t.div({className: "SessionLoadView"}, [
            spinner(t, {hiddenWithLayout: vm => !vm.loading}),
            t.p(vm => vm.loadLabel)
        ]);
    }
}
