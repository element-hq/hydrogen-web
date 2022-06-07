/*
Copyright 2022 Bruno Windels <bruno@windels.cloud>
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import {LightboxViewModel} from "./LightboxViewModel.js";

// Store the `LightboxViewModel` under a symbol so no one else can tamper with
// it. This acts like a private field on the class since no one else has the
// symbol to look it up.
let lightboxViewModelSymbol = Symbol('lightboxViewModel');

/**
 * Destroys and creates a new the `LightboxViewModel` depending if
 * `lightboxChildOptions.eventEntry` or `lightboxChildOptions.eventId` are
 * provided.
 */
function updateLightboxViewModel(vm, fieldName, lightboxChildOptions) {
    // Remove any existing `LightboxViewModel` before we assemble the new one below
    if (vm[lightboxViewModelSymbol]) {
        vm[lightboxViewModelSymbol] = vm.disposeTracked(vm[lightboxViewModelSymbol]);
        // Let the `LightboxView` know that the `LightboxViewModel` has changed
        vm.emitChange(fieldName);
    }
    // Create the new `LightboxViewModel` if the `eventEntry` exists directly or
    // `eventId` which we can load from the store 
    if (lightboxChildOptions.eventId || lightboxChildOptions.eventEntry) {
        vm[lightboxViewModelSymbol] = vm.track(new LightboxViewModel(vm.childOptions(lightboxChildOptions)));
        // Let the `LightboxView` know that the `LightboxViewModel` has changed
        vm.emitChange(fieldName);
    }
}

/**
 * Handles updating the `LightboxViewModel` whenever the page URL changes and
 * emits changes which the `LightboxView` will use to re-render. This is a
 * composable piece of logic to call in an existing `ViewModel`'s constructor.
 */
export function setupLightboxNavigation(vm, fieldName = 'lightboxViewModel', lightboxChildOptionsFunction) {
    // On the given `vm`, create a getter at `fieldName` that the
    // `LightboxViewModel` is exposed at for usage in the view.
    Object.defineProperty(vm, fieldName, {
        get: function() {
            return vm[lightboxViewModelSymbol];
        }
    });

    // Whenever the page navigates somewhere, keep the `lightboxViewModel` up to date
    const lightbox = vm.navigation.observe("lightbox");
    vm.track(lightbox.subscribe(eventId => {
        updateLightboxViewModel(vm, fieldName, lightboxChildOptionsFunction(eventId));
    }));
    // Also handle the case where the URL already includes `/lightbox/$eventId` (like
    // from page-load)
    const initialLightBoxEventId = lightbox.get();
    updateLightboxViewModel(vm, fieldName, lightboxChildOptionsFunction(initialLightBoxEventId));
}
