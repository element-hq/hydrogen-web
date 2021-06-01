import { TemplateView } from "../../general/TemplateView.js";
import { text, classNames, tag } from "../../general/html.js";
import { AvatarView } from "../../avatar.js";

export class RoomInfoView extends TemplateView {

    render(t, vm) {
        const encryptionString = vm.isEncrypted ? "On" : "Off";

        return t.div({ className: "RoomInfo" }, [
            this._createButton(vm),
            t.div({ className: "RoomAvatar" },
                [t.view(new AvatarView(vm, 52)), this._createEncryptionIcon(vm.isEncrypted)]),
            t.div({ className: "RoomName" }, [t.h2(vm.name)]),
            this._createRoomAliasDisplay(vm),
            t.div({ className: "SidebarRow_collection" },
                [
                    this._createSideBarRow("People", vm.memberCount, { MemberCount: true }),
                    this._createSideBarRow("Encryption", encryptionString, { EncryptionStatus: true })
                ])
        ]);
    }

    _createRoomAliasDisplay(vm) {
        return vm.canonicalAlias ? tag.div({ className: "RoomId" }, [text(vm.canonicalAlias)]) :
            "";
    }

    _createSideBarRow(label, value, labelClass, valueClass) {
        const labelClassString = classNames({ SidebarLabel: true, ...labelClass });
        const valueClassString = classNames({ SidebarValue: true, ...valueClass });
        return tag.div({ className: "SidebarRow" }, [
            tag.div({ className: labelClassString }, [text(label)]),
            tag.div({ className: valueClassString }, [text(value)])
        ]);
    }

    _createEncryptionIcon(isEncrypted) {
        return tag.div({ className: "RoomEncryption" },
            [tag.div({ className: isEncrypted ? "encrypted" : "unencrypted" })])
    }

    _createButton(vm) {
        return tag.div({ className: "buttons" },
            [tag.a({ className: "close button-utility", href: vm.closeLink })]);
    }
}
