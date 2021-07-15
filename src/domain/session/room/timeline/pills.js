const baseUrl = 'https://matrix.to';
const linkPrefix = `${baseUrl}/#/`;

export function parsePillLink(link) {
    if (!link.startsWith(linkPrefix)) {
        return null;
    }
    const contents = link.substring(linkPrefix.length);
    if (contents[0] === '@') {
        return { userId: contents }
    }
}
