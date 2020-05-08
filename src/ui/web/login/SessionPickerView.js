import {ListView} from "../general/ListView.js";
import {TemplateView} from "../general/TemplateView.js";
import {brawlGithubLink} from "./common.js";
import {SessionLoadView} from "./SessionLoadView.js";

function selectFileAsText(mimeType) {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    if (mimeType) {
        input.setAttribute("accept", mimeType);
    }
    const promise = new Promise((resolve, reject) => {
        const checkFile = () => {
            input.removeEventListener("change", checkFile, true);
            const file = input.files[0];
            if (file) {
                resolve(file.text());
            } else {
                reject(new Error("No file selected"));
            }
        }
        input.addEventListener("change", checkFile, true);
    });
    input.click();
    return promise;
}



class SessionPickerItemView extends TemplateView {
    _onDeleteClick() {
        if (confirm("Are you sure?")) {
            this.value.delete();
        }
    }

    render(t, vm) {
        const deleteButton = t.button({
            disabled: vm => vm.isDeleting,
            onClick: this._onDeleteClick.bind(this),
        }, "Delete");
        const clearButton = t.button({
            disabled: vm => vm.isClearing,
            onClick: () => vm.clear(),
        }, "Clear");
        const exportButton = t.button({
            disabled: vm => vm.isClearing,
            onClick: () => vm.export(),
        }, "Export");
        const downloadExport = t.if(vm => vm.exportDataUrl, t.createTemplate((t, vm) => {
            return t.a({
                href: vm.exportDataUrl,
                download: `brawl-session-${vm.id}.json`,
                onClick: () => setTimeout(() => vm.clearExport(), 100),
            }, "Download");
        }));

        const userName = t.span({className: "userId"}, vm => vm.label);
        const errorMessage = t.if(vm => vm.error, t.createTemplate(t => t.span({className: "error"}, vm => vm.error)));
        return t.li([t.div({className: "sessionInfo"}, [
            userName,
            errorMessage,
            downloadExport,
            exportButton,
            clearButton,
            deleteButton,
        ])]);
    }
}

export class SessionPickerView extends TemplateView {
    render(t, vm) {
        const sessionList = new ListView({
            list: vm.sessions,
            onItemClick: (item, event) => {
                if (event.target.closest(".userId")) {
                    vm.pick(item.value.id);
                }
            },
            parentProvidesUpdates: false,
        }, sessionInfo => {
            return new SessionPickerItemView(sessionInfo);
        });

        return t.div({className: "SessionPickerView"}, [
            t.h1(["Pick a session"]),
            t.view(sessionList),
            t.p(t.button({onClick: () => vm.cancel()}, ["Log in to a new session instead"])),
            t.p(t.button({onClick: async () => vm.import(await selectFileAsText("application/json"))}, "Import")),
            t.if(vm => vm.loadViewModel, vm => new SessionLoadView(vm.loadViewModel)),
            t.p(brawlGithubLink(t))
        ]);
    }
}
