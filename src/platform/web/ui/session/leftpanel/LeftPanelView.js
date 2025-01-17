/*
Copyright 2025 New Vector Ltd.
Copyright 2020 Bruno Windels <bruno@windels.cloud>

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {ListView} from "../../general/ListView";
import {TemplateView} from "../../general/TemplateView";
import {RoomTileView} from "./RoomTileView.js";
import {Menu} from "../../general/Menu.js";
import {Popup} from "../../general/Popup.js";

class FilterField extends TemplateView {
    render(t, options) {
        const clear = () => {
            filterInput.value = "";
            filterInput.blur();
            clearButton.blur();
            options.clear();
        };
        const filterInput = t.input({
            type: "text",
            placeholder: options?.label,
            "aria-label": options?.label,
            autocomplete: options?.autocomplete,
            enterkeyhint: 'search',
            name: options?.name,
            onInput: event => options.set(event.target.value),
            onKeydown: event => {
                if (event.key === "Escape" || event.key === "Esc") {
                    clear();
                }
            },
            onFocus: () => filterInput.select()
        });
        const clearButton = t.button({
            onClick: clear,
            title: options.i18n`Clear`,
            "aria-label": options.i18n`Clear`
        });
        return t.div({className: "FilterField"}, [filterInput, clearButton]);
    }
}

export class LeftPanelView extends TemplateView {
    constructor(vm) {
        super(vm);
        this._createMenuPopup = null;
    }

    render(t, vm) {
        const gridButtonLabel = vm => {
            return vm.gridEnabled ?
                vm.i18n`Show single room` :
                vm.i18n`Enable grid layout`;
        };
        const roomList = t.view(new ListView(
            {
                className: "RoomList",
                list: vm.tileViewModels,
            },
            tileVM => new RoomTileView(tileVM)
        ));
        const utilitiesRow = t.div({className: "utilities"}, [
            t.a({className: "button-utility close-session", href: vm.closeUrl, "aria-label": vm.i18n`Back to account list`, title: vm.i18n`Back to account list`}),
            t.view(new FilterField({
                i18n: vm.i18n,
                label: vm.i18n`Filter rooms…`,
                name: "room-filter",
                autocomplete: true,
                set: query => {
                    // scroll up if we just started filtering
                    if (vm.setFilter(query)) {
                        roomList.scrollTop = 0;
                    }
                },
                clear: () => vm.clearFilter()
            })),
            t.button({
                onClick: () => vm.toggleGrid(),
                className: {
                    "button-utility": true,
                    grid: true,
                    on: vm => vm.gridEnabled
                },
                title: gridButtonLabel,
                "aria-label": gridButtonLabel
            }),
            t.a({className: "button-utility settings", href: vm.settingsUrl, "aria-label": vm.i18n`Settings`, title: vm.i18n`Settings`}),
            t.button({
                className: "button-utility create",
                "aria-label": vm.i18n`Create room`,
                onClick: evt => this._toggleCreateMenu(evt)
            }),
        ]);

        return t.div({className: "LeftPanel"}, [
            utilitiesRow,
            roomList
        ]);
    }

    _toggleCreateMenu(evt) {
        if (this._createMenuPopup && this._createMenuPopup.isOpen) {
            this._createMenuPopup.close();
        } else {
            const vm = this.value;
            const options = [];
            options.push(Menu.option(vm.i18n`Create Room`, () => vm.showCreateRoomView()));
            options.push(Menu.option(vm.i18n`Join Room`, () => vm.showJoinRoomView()));
            this._createMenuPopup = new Popup(new Menu(options));
            this._createMenuPopup.trackInTemplateView(this);
            this._createMenuPopup.showRelativeTo(evt.target, 10);
        }
    }
}
