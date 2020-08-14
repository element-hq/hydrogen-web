export function renderMessage(t, vm, children) {
    const classes = {
        "TextMessageView": true,
        own: vm.isOwn,
        pending: vm.isPending,
        continuation: vm.isContinuation,
    };
    const sender = t.div({className: `sender usercolor${vm.senderColorNumber}`}, vm => vm.isContinuation ? "" : vm.sender);
    children = [sender].concat(children);
    return t.li(
        {className: classes},
        t.div({className: "message-container"}, children)
    );
}
