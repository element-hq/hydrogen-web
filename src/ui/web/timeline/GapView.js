import TemplateView from "../TemplateView.js";

export default class GapView extends TemplateView {
    render(t, vm) {
        const className = {
            gap: true,
            isLoading: vm => vm.isLoading
        };
        const label = (vm.isUp ? "🠝" : "🠟") + " fill gap"; //no binding
        return t.li({className}, [
            t.button({onClick: () => this.viewModel.fill(), disabled: vm => vm.isLoading}, label),
            t.if(vm => vm.error, t => t.strong(vm => vm.error))
        ]);
    }
}
