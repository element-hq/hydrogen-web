import TemplateView from "../general/TemplateView.js";

export default class SyncStatusBar extends TemplateView {
    constructor(vm) {
        super(vm, true);
    }

    render(t, vm) {
        return t.div({className: {
            "SyncStatusBar": true,
            "SyncStatusBar_shown": true,
        }}, [
            vm => vm.status,
            t.if(vm => !vm.isSyncing, t => t.button({onClick: () => vm.trySync()}, "Try syncing"))
        ]);
    }
}
