import TemplateView from "./general/TemplateView.js";

export default class LoginView extends TemplateView {
    render(t, vm) {
        const username = t.input({type: "text", placeholder: vm.usernamePlaceholder});
        const password = t.input({type: "password", placeholder: vm.usernamePlaceholder});
        const homeserver = t.input({type: "text", placeholder: vm.hsPlaceholder, value: vm.defaultHomeServer});
        return t.div({className: "login form"}, [
            t.if(vm => vm.error, t => t.div({className: "error"}, vm => vm.error)),
            t.div(username),
            t.div(password),
            t.div(homeserver),
            t.div(t.button({
                onClick: () => vm.login(username.value, password.value, homeserver.value),
                disabled: vm => vm.loading
            }, "Log In")),
            t.div(t.button({onClick: () => vm.cancel()}), "Cancel")
        ]);
    }
}
