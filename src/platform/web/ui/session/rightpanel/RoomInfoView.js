import { TemplateView } from "../../general/TemplateView.js";
import { text, classNames, tag } from "../../general/html.js";
import { AvatarView } from "../../avatar.js";

export class RoomInfoView extends TemplateView {

    render(t, vm) {
        const encryptionString = () => vm.isEncrypted ? vm.i18n`On` : vm.i18n`Off`;
        return t.div({ className: "RoomInfo" }, [
            this._createButton(t, vm),
            t.div({ className: "RoomAvatar" },
                [
                    t.view(new AvatarView(vm, 52)),
                    t.mapView(vm => vm.isEncrypted, isEncrypted => new EncryptionAvatarView(isEncrypted))
                ]),
            t.div({ className: "RoomName" }, [t.h2(vm => vm.name)]),
            this._createRoomAliasDisplay(vm),
            t.div({ className: "SidebarRow_collection" },
                [
                    this._createSideBarRow(t, vm.i18n`People`, vm => vm.memberCount, { MemberCount: true }),
                    this._createSideBarRow(t, vm.i18n`Encryption`, encryptionString, { EncryptionStatus: true })
                ])
        ]);
    }

    _createRoomAliasDisplay(vm) {
        return vm.canonicalAlias ? tag.div({ className: "RoomId" }, [text(vm.canonicalAlias)]) :
            "";
    }

    _createSideBarRow(t, label, value, labelClass, valueClass) {
        const labelClassString = classNames({ SidebarLabel: true, ...labelClass });
        const valueClassString = classNames({ SidebarValue: true, ...valueClass });
        return t.div({ className: "SidebarRow" }, [
            t.div({ className: labelClassString }, [text(label)]),
            t.div({ className: valueClassString }, value)
        ]);
    }

    _createButton(t, vm) {
        return t.div({ className: "buttons" },
            [
                t.button({ className: "close button-utility", onClick: () => vm.closePanel() })
            ]);
    }
}

class EncryptionAvatarView extends TemplateView{
    render(t, isEncrypted) {
       return t.div({ className: "RoomEncryption" },
            [t.div({ className: isEncrypted ? "encrypted" : "unencrypted" })]);
    }
}
