import { TemplateView } from "../../general/TemplateView.js";
import { text, classNames, tag } from "../../general/html.js";
import { AvatarView } from "../../avatar.js";

export class RoomInfoView extends TemplateView {

    render(t, vm) {
        const encryptionString = vm.isEncrypted ? "On" : "Off";
        return t.div({ className: "RoomInfo" }, [
            t.div({ className: "RoomAvatar" }, [t.view(new AvatarView(vm, 128))]),
            t.div({ className: "RoomName" }, [t.h2(vm.name)]),

            t.div({ className: "RoomId" }, [text(vm.roomId)]),

            this._createSideBarRow("People", vm.memberCount, { MemberCount: true }),

            this._createSideBarRow("Encryption", encryptionString, { EncryptionStatus: true })
        ]);
    }

    _createSideBarRow(label, value, labelClass, valueClass) {
        const labelClassString = classNames({ SidebarLabel: true, ...labelClass });
        const valueClassString = classNames({ SidebarValue: true, ...valueClass });
        return tag.div({ className: "SidebarRow" }, [
            tag.div({ className: labelClassString }, [text(label)]),
            tag.div({ className: valueClassString }, [text(value)])
        ]);
    }
}
