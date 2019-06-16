import TemplateView from "../../../general/TemplateView.js";

export default class AnnouncementView extends TemplateView {
    render(t) {
        return t.li({className: "AnnouncementView"}, t.div(vm => vm.announcement));
    }
}
