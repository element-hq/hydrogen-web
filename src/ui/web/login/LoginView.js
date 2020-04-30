import {TemplateView} from "../general/TemplateView.js";
import {brawlGithubLink} from "./common.js";

export class LoginView extends TemplateView {
    render(t, vm) {
        const username = t.input({type: "text", placeholder: vm.usernamePlaceholder, disabled});
        const password = t.input({type: "password", placeholder: vm.passwordPlaceholder, disabled});
        const homeserver = t.input({type: "text", placeholder: vm.hsPlaceholder, value: vm.defaultHomeServer, disabled});
        const disabled = vm => !!vm.loadViewModel;
        return t.div({className: "LoginView form"}, [
            t.h1(["Log in to your homeserver"]),
            t.if(vm => vm.error, t.createTemplate(t => t.div({className: "error"}, vm => vm.error))),
            t.div(username),
            t.div(password),
            t.div(homeserver),
            t.div(t.button({
                onClick: () => vm.login(username.value, password.value, homeserver.value),
                disabled
            }, "Log In")),
            t.div(t.button({onClick: () => vm.goBack(), disabled}, ["Pick an existing session"])),
            t.if(vm => vm.loadViewModel, vm => new SessionLoadView(vm.loadViewModel)),
            t.p(brawlGithubLink(t))
        ]);
    }
}

function spinner(t, extraClasses = undefined) {
    return t.svg({className: Object.assign({"spinner": true}, extraClasses), viewBox:"0 0 100% 100%"}, 
        t.circle({cx:"50%", cy:"50%", r:"45%", pathLength:"100"})
    );
}

class SessionLoadView extends TemplateView {
    render(t) {
        return t.div([
            spinner(t, {hidden: vm => !vm.loading}),
            t.p(vm => vm.loadLabel)
        ]);
    }
}
