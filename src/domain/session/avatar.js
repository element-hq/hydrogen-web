export function avatarInitials(name) {
    const words = name.split(" ").slice(0, 2);
    return words.reduce((i, w) => i + w.charAt(0).toUpperCase(), "");
}