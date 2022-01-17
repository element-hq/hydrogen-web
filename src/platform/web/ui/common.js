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

let container;

export function spinner(t, extraClasses = undefined) {
    if (container === undefined) {
        container = document.querySelector(".hydrogen");
    }
    const classes = Object.assign({"spinner": true}, extraClasses);
    if (container?.classList.contains("legacy")) {
        return t.div({className: classes}, [
            t.div(),
            t.div(),
            t.div(),
            t.div(),
        ]);
    } else {
        return t.svg({className: classes, viewBox:"0 0 100 100"}, 
            t.circle({cx:"50%", cy:"50%", r:"45%", pathLength:"100"})
        );
    }
}

