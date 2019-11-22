import TemplateView from "../general/TemplateView.js";

export default class LoginView extends TemplateView {
    constructor(vm) {
        super(vm, true);
    }

    render(t, vm) {
        const username = t.input({type: "text", placeholder: vm.usernamePlaceholder});
        const password = t.input({type: "password", placeholder: vm.passwordPlaceholder});
        const homeserver = t.input({type: "text", placeholder: vm.hsPlaceholder, value: vm.defaultHomeServer});
        return t.div({className: "LoginView form"}, [
            t.h1(["Log in to your homeserver"]),
            t.if(vm => vm.error, t => t.div({className: "error"}, vm => vm.error)),
            t.div(username),
            t.div(password),
            t.div(homeserver),
            t.div(t.button({
                onClick: () => vm.login(username.value, password.value, homeserver.value),
                disabled: vm => vm.loading
            }, "Log In")),
            t.div(t.button({onClick: () => vm.cancel()}, ["Pick an existing session"])),
            t.p(t.a({href: "https://github.com/bwindels/brawl-chat"}, ["Brawl on Github"]))
        ]);
    }
}
