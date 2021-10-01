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

import {BaseMessageTile} from "./BaseMessageTile.js";

/*
map urls:
apple:   https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
android: https://developers.google.com/maps/documentation/urls/guide
wp:      maps:49.275267 -122.988617
https://www.habaneroconsulting.com/stories/insights/2011/opening-native-map-apps-from-the-mobile-browser
*/
export class LocationTile extends BaseMessageTile {
    get mapsLink() {
        const geoUri = this._getContent().geo_uri;
        const [lat, long] = geoUri.split(":")[1].split(",");
        return `maps:${lat} ${long}`;
    }

    get label() {
        return `${this.sender} sent their location, click to see it in maps.`;
    }
}
