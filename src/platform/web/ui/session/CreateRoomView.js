/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {TemplateView} from "../general/TemplateView";
import {AvatarView} from "../AvatarView";
import {StaticView} from "../general/StaticView";

export class CreateRoomView extends TemplateView {
    render(t, vm) {
        return t.main({className: "CreateRoomView middle"}, [
            t.div({className: "CreateRoomView_header middle-header"}, [
                t.a({className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Cancel room creation`}),
                t.h2("Create room"),
            ]),
            t.div({className: "CreateRoomView_body centered-column"}, [
                //t.div({className: "RoomView_error"}, vm => vm.error),
                t.form({className: "CreateRoomView_detailsForm form", onChange: evt => this.onFormChange(evt), onSubmit: evt => this.onSubmit(evt)}, [
                    t.div({className: "vertical-layout"}, [
                        t.button({type: "button", className: "CreateRoomView_selectAvatar", onClick: () => vm.selectAvatar()},
                            t.mapView(vm => vm.hasAvatar, hasAvatar => {
                                if (hasAvatar) {
                                    return new AvatarView(vm, 64);
                                } else {
                                    return new StaticView(undefined, t => {
                                        return t.div({className: "CreateRoomView_selectAvatarPlaceholder"})
                                    });
                                }
                            })
                        ),
                        t.div({className: "stretch form-row text"}, [
                            t.label({for: "name"}, vm.i18n`Room name`),
                            t.input({
                                onInput: evt => vm.setName(evt.target.value),
                                type: "text", name: "name", id: "name",
                                placeholder: vm.i18n`Enter a room name`
                            }),
                        ]),
                    ]),
                    t.div({className: "form-row text"}, [
                        t.label({for: "topic"}, vm.i18n`Topic (optional)`),
                        t.textarea({
                            onInput: evt => vm.setTopic(evt.target.value),
                            name: "topic", id: "topic",
                            placeholder: vm.i18n`Topic`
                        }),
                    ]),
                    t.div({className: "form-group"}, [
                        t.div({className: "form-row check"}, [
                            t.input({type: "radio", name: "isPublic", id: "isPrivate", value: "false", checked: !vm.isPublic}),
                            t.label({for: "isPrivate"}, vm.i18n`Private room, only upon invitation.`)
                        ]),
                        t.div({className: "form-row check"}, [
                            t.input({type: "radio", name: "isPublic", id: "isPublic", value: "true", checked: vm.isPublic}),
                            t.label({for: "isPublic"}, vm.i18n`Public room, anyone can join`)
                        ]),
                    ]),
                    t.div({className: {"form-row check": true, hidden: vm => vm.isPublic}}, [
                        t.input({type: "checkbox", name: "isEncrypted", id: "isEncrypted", checked: vm.isEncrypted}),
                        t.label({for: "isEncrypted"}, vm.i18n`Enable end-to-end encryption`)
                    ]),
                    t.div({className: {"form-row text": true, hidden: vm => !vm.isPublic}}, [
                        t.label({for: "roomAlias"}, vm.i18n`Room alias`),
                        t.input({
                            onInput: evt => vm.setRoomAlias(evt.target.value),
                            type: "text", name: "roomAlias", id: "roomAlias",
                            placeholder: vm.i18n`Room alias (<alias>, or #<alias> or #<alias>:hs.tld`}),
                    ]),
                    t.div({className: "form-group"}, [
                        t.div(t.button({className: "link", type: "button", onClick: () => vm.toggleAdvancedShown()},
                            vm => vm.isAdvancedShown ? vm.i18n`Hide advanced settings` : vm.i18n`Show advanced settings`)),
                        t.div({className: {"form-row check": true, hidden: vm => !vm.isAdvancedShown}}, [
                            t.input({type: "checkbox", name: "isFederationDisabled", id: "isFederationDisabled", checked: vm.isFederationDisabled}),
                            t.label({for: "isFederationDisabled"}, [
                                vm.i18n`Disable federation`,
                                t.p({className: "form-row-description"}, vm.i18n`Can't be changed later. This will prevent people on other homeservers from joining the room. This is typically used when only people from your own organisation (if applicable) should be allowed in the room, and is otherwise not needed.`)
                            ]),
                        ]),
                    ]),
                    t.div({className: "button-row"}, [
                        t.button({
                            className: "button-action primary",
                            type: "submit",
                            disabled: vm => !vm.canCreate
                        }, vm.i18n`Create room`),
                    ]),
                ])
            ])
        ]);
    }

    onFormChange(evt) {
        switch (evt.target.name) {
            case "isEncrypted":
                this.value.setEncrypted(evt.target.checked);
                break;
            case "isPublic":
                this.value.setPublic(evt.currentTarget.isPublic.value === "true");
                break;
            case "isFederationDisabled":
                this.value.setFederationDisabled(evt.target.checked);
                break;
        }
    }

    onSubmit(evt) {
        evt.preventDefault();
        this.value.create();
    }
}
