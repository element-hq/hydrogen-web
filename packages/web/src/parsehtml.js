/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import DOMPurify from "dompurify"

class HTMLParseResult {
    constructor(bodyNode) {
        this._bodyNode = bodyNode;
    }

    get rootNodes() {
        return Array.from(this._bodyNode.childNodes);
    }
    
    getChildNodes(node) {
        return Array.from(node.childNodes);
    }

    getAttributeNames(node) {
        return Array.from(node.getAttributeNames());
    }

    getAttributeValue(node, attr) {
        return node.getAttribute(attr);
    }

    isTextNode(node) { 
        return node.nodeType === Node.TEXT_NODE;
    }

    getNodeText(node) {
        return node.textContent;
    }

    isElementNode(node) {
        return node.nodeType === Node.ELEMENT_NODE;
    }

    getNodeElementName(node) {
        return node.tagName;
    }
}

const sanitizeConfig = {
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx|mxc):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ADD_TAGS: ['mx-reply']
}

export function parseHTML(html) {
    // If DOMPurify uses DOMParser, can't we just get the built tree from it
    // instead of re-parsing?
    const sanitized = DOMPurify.sanitize(html, sanitizeConfig);
    const bodyNode = new DOMParser().parseFromString(sanitized, "text/html").body;
    return new HTMLParseResult(bodyNode);
}
