import {tag} from "./html.js";

export function errorToDOM(error) {
    const stack = new Error().stack;
    const callee = stack.split("\n")[1];
    return tag.div([
        tag.h2("Something went wrong…"),
        tag.h3(error.message),
        tag.p(`This occurred while running ${callee}.`),
        tag.pre(error.stack),
    ]);
}
