const offColor = require("off-color").offColor;

module.exports.derive = function (value, operation, argument) {
    switch (operation) {
        case "darker": {
            const newColorString = offColor(value).darken(argument / 100).hex();
            return newColorString;
        }
        case "lighter": {
            const newColorString = offColor(value).lighten(argument / 100).hex();
            return newColorString;
        }
    }
}
