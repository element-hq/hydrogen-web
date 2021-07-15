import {TemplateView} from "./TemplateView.js";
import {spinner} from "../common.js";

export class LoadingView extends TemplateView {
    render(t) {
        return t.div({ className: "LoadingView" }, [spinner(t), "Loading"]);
    }
}
