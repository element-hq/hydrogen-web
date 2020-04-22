import {TemplateView} from "../general/TemplateView.js";
import {brawlGithubLink} from "./common.js";

export class LoginView extends TemplateView {
    constructor(vm) {
        super(vm, true);
    }

    render(t, vm) {
        const disabled = vm => vm.loading;
        const username = t.input({type: "text", placeholder: vm.usernamePlaceholder, disabled});
        const password = t.input({type: "password", placeholder: vm.passwordPlaceholder, disabled});
        const homeserver = t.input({type: "text", placeholder: vm.hsPlaceholder, value: vm.defaultHomeServer, disabled});
        return t.div({className: "LoginView form"}, [
            t.h1(["Log in to your homeserver"]),
            t.if(vm => vm.error, t => t.div({className: "error"}, vm => vm.error)),
            t.div(username),
            t.div(password),
            t.div(homeserver),
            t.div(t.button({
                onClick: () => vm.login(username.value, password.value, homeserver.value),
                disabled
            }, "Log In")),
            t.div(t.button({onClick: () => vm.goBack(), disabled}, ["Pick an existing session"])),
            t.if(vm => vm.showLoadLabel, renderLoadProgress),
            t.p(brawlGithubLink(t))
        ]);
    }
}

function renderLoadProgress(t) {
    return t.div({className: "loadProgress"}, [
        t.div({className: "spinner"}),
        t.p(vm => vm.loadLabel),
        t.if(vm => vm.loading, t => t.button({onClick: vm => vm.cancel()}, "Cancel login"))
    ]);
}
