import { TemplateView } from "../../general/TemplateView.js";
import { text, classNames, tag } from "../../general/html.js";
import { AvatarView } from "../../avatar.js";

export class RoomDetailsView extends TemplateView {

    render(t, vm) {
        const encryptionString = () => vm.isEncrypted ? vm.i18n`On` : vm.i18n`Off`;
        return t.div({ className: "RoomDetailsView" }, [
            this._createButton(t, vm),
            t.div({ className: "RoomDetailsView_avatar" },
                [
                    t.view(new AvatarView(vm, 52)),
                    t.mapView(vm => vm.isEncrypted, isEncrypted => new EncryptionIconView(isEncrypted))
                ]),
            t.div({ className: "RoomDetailsView_name" }, [t.h2(vm => vm.name)]),
            this._createRoomAliasDisplay(vm),
            t.div({ className: "RoomDetailsView_rows" },
                [
                    this._createRightPanelRow(t, vm.i18n`People`, { MemberCount: true }, vm => vm.memberCount),
                    this._createRightPanelRow(t, vm.i18n`Encryption`, { EncryptionStatus: true }, encryptionString)
                ])
        ]);
    }

    _createRoomAliasDisplay(vm) {
        return vm.canonicalAlias ? tag.div({ className: "RoomDetailsView_id" }, [text(vm.canonicalAlias)]) :
            "";
    }

    _createRightPanelRow(t, label, labelClass, value) {
        const labelClassString = classNames({ RoomDetailsView_label: true, ...labelClass });
        return t.div({ className: "RoomDetailsView_row" }, [
            t.div({ className: labelClassString }, [text(label)]),
            t.div({ className: "RoomDetailsView_value" }, value)
        ]);
    }

    _createButton(t, vm) {
        return t.div({ className: "RoomDetailsView_buttons" },
            [
                t.button({ className: "close button-utility", onClick: () => vm.closePanel() })
            ]);
    }
}

class EncryptionIconView extends TemplateView{
    render(t, isEncrypted) {
       return t.div({ className: "EncryptionIconView" },
            [t.div({ className: isEncrypted ? "EncryptionIconView_encrypted" : "EncryptionIconView_unencrypted" })]);
    }
}
