export function assertStatus(current, allowed, action) {
    if (!allowed.includes(current)) {
        return `${action} is not allowed while stream is ${current}`;
    }
    return null;
}
