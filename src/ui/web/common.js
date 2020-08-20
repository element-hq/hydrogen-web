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

export function spinner(t, extraClasses = undefined) {
    return t.svg({className: Object.assign({"spinner": true}, extraClasses), viewBox:"0 0 100 100"}, 
        t.circle({cx:"50%", cy:"50%", r:"45%", pathLength:"100"})
    );
}

/**
 * @param  {TemplateBuilder} t
 * @param  {Object} vm   view model with {avatarUrl, avatarColorNumber, avatarTitle, avatarLetter}
 * @param  {Number} size
 * @return {Element}
 */
export function renderAvatar(t, vm, size) {
    const hasAvatar = !!vm.avatarUrl;
    const avatarClasses = {
        avatar: true,
        [`usercolor${vm.avatarColorNumber}`]: !hasAvatar,
    };
    // TODO: handle updates from default to img or reverse
    const sizeStr = size.toString();
    const avatarContent = hasAvatar ?
        t.img({src: vm => vm.avatarUrl, width: sizeStr, height: sizeStr, title: vm => vm.avatarTitle}) :
        vm => vm.avatarLetter;
    return t.div({className: avatarClasses}, [avatarContent]);
}
