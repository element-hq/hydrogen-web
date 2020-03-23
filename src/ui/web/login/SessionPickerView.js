import ListView from "../general/ListView.js";
import TemplateView from "../general/TemplateView.js";
import {brawlGithubLink} from "./common.js";

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
    constructor(vm) {
        super(vm, true);
    }

    _onDeleteClick() {
        if (confirm("Are you sure?")) {
            this.viewModel.delete();
        }
    }

    render(t) {
        const deleteButton = t.button({
            disabled: vm => vm.isDeleting,
            onClick: this._onDeleteClick.bind(this),
        }, "Delete");
        const clearButton = t.button({
            disabled: vm => vm.isClearing,
            onClick: () => this.viewModel.clear(),
        }, "Clear");
        const exportButton = t.button({
            disabled: vm => vm.isClearing,
            onClick: () => this.viewModel.export(),
        }, "Export");
        const downloadExport = t.if(vm => vm.exportDataUrl, (t, vm) => {
            return t.a({
                href: vm.exportDataUrl,
                download: `brawl-session-${this.viewModel.id}.json`,
                onClick: () => setTimeout(() => this.viewModel.clearExport(), 100),
            }, "Download");
        });

        const userName = t.span({className: "userId"}, vm => vm.label);
        const errorMessage = t.if(vm => vm.error, t => t.span({className: "error"}, vm => vm.error));
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

export default class SessionPickerView extends TemplateView {
    mount() {
        this._sessionList = new ListView({
            list: this.viewModel.sessions,
            onItemClick: (item, event) => {
                if (event.target.closest(".userId")) {
                    this.viewModel.pick(item.viewModel.id);
                }
            },
        }, sessionInfo => {
            return new SessionPickerItemView(sessionInfo);
        });
        return super.mount();
    }

    render(t) {
        return t.div({className: "SessionPickerView"}, [
            t.h1(["Pick a session"]),
            this._sessionList.mount(),
            t.p(t.button({onClick: () => this.viewModel.cancel()}, ["Log in to a new session instead"])),
            t.p(t.button({onClick: async () => this.viewModel.import(await selectFileAsText("application/json"))}, "Import")),
            t.p(brawlGithubLink(t))
        ]);
    }

    unmount() {
        super.unmount();
        this._sessionList.unmount();
    }
}
