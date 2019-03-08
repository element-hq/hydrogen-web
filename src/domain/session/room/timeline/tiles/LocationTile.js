import MessageTile from "./MessageTile.js";

/*
map urls:
apple:   https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
android: https://developers.google.com/maps/documentation/urls/guide
wp:      maps:49.275267 -122.988617
https://www.habaneroconsulting.com/stories/insights/2011/opening-native-map-apps-from-the-mobile-browser
*/
export default class LocationTile extends MessageTile {
    get mapsLink() {
        const geoUri = this._getContent().geo_uri;
        const [lat, long] = geoUri.split(":")[1].split(",");
        return `maps:${lat} ${long}`;
    }

    get label() {
        return `${this.sender} sent their location, click to see it in maps.`;
    }
}
