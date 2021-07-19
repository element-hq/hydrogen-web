import {AvatarView} from "../../AvatarView.js";
import {TemplateView} from "../../general/TemplateView.js";

export class MemberDetailsView extends TemplateView {
    render(t, vm) {
        return t.div({ className: "MemberDetailsView" },
            [   t.view(new AvatarView(vm, 128)),
                t.div({ className: "MemberDetailsView_name" }, vm.name),
                t.div({ className: "MemberDetailsView_userId" }, vm.userId)
            ]);
    }
}
