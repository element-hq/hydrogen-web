import {LightboxViewModel} from "./LightboxViewModel.js";

let lightboxViewModelSymbol = Symbol('lightboxViewModel');

export function updateLightboxViewModel(vm, fieldName, eventId) {
    if (vm[lightboxViewModelSymbol]) {
        vm[lightboxViewModelSymbol] = vm.disposeTracked(vm[lightboxViewModelSymbol]);
        vm.emitChange(fieldName);
    }
    if (eventId) {
        const room = vm._roomFromNavigation();
        vm[lightboxViewModelSymbol] = vm.track(new LightboxViewModel(vm.childOptions({eventId, room})));
        vm.emitChange(fieldName);
    }
}

// Whenever the page navigates somewhere, keep the lightboxViewModel up to date
export function setupLightboxNavigation(vm, fieldName = 'lightboxViewModel') {
    Object.defineProperty(vm, fieldName, {
        get: function() {
            vm[lightboxViewModelSymbol];
        }
    });

    const lightbox = vm.navigation.observe("lightbox");
    vm.track(lightbox.subscribe(eventId => {
        updateLightboxViewModel(vm, fieldName, eventId);
    }));
    const initialLightBoxEventId = lightbox.get();
    updateLightboxViewModel(vm, fieldName, initialLightBoxEventId);
}
