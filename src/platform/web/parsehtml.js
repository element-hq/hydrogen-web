/*
Copyright 2025 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
    FORBID_TAGS: ['mx-reply'],
    KEEP_CONTENT: false,
}

export function parseHTML(html) {
    // If DOMPurify uses DOMParser, can't we just get the built tree from it
    // instead of re-parsing?
    const sanitized = DOMPurify.sanitize(html, sanitizeConfig);
    const bodyNode = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${sanitized}</body></html>`, "text/html").body;
    return new HTMLParseResult(bodyNode);
}
