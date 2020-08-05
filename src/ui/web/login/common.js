/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

export function brawlGithubLink(t) {
    if (window.BRAWL_VERSION) {
        return t.a({target: "_blank", href: `https://github.com/bwindels/brawl-chat/releases/tag/v${window.BRAWL_VERSION}`}, `Brawl v${window.BRAWL_VERSION} on Github`);
    } else {
        return t.a({target: "_blank", href: "https://github.com/bwindels/brawl-chat"}, "Brawl on Github");
    }
}
