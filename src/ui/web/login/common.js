export function brawlGithubLink(t) {
    if (window.BRAWL_VERSION) {
        return t.a({target: "_blank", href: `https://github.com/bwindels/brawl-chat/releases/tag/v${window.BRAWL_VERSION}`}, `Brawl v${window.BRAWL_VERSION} on Github`);
    } else {
        return t.a({target: "_blank", href: "https://github.com/bwindels/brawl-chat"}, "Brawl on Github");
    }
}
