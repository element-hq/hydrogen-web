import { TemplateView } from "../../general/TemplateView.js";
import { text } from "../../general/html.js";

export class RoomInfoView extends TemplateView {
    render(t, vm) {
        return t.div({ className: "RoomInfo" }, [
            t.div({ className: "RoomName" }, [text(vm.name)]),
            t.div({ className: "RoomId" }, [text(vm.roomId)]),
            t.div({ className: "RoomMemberCount" }, [text(vm.memberCount)]),
            t.div({ className: "RoomEncryption" }, [vm.isEncrypted ? "Encrypted" : "Not Encrypted"])
        ]);
    }
}
