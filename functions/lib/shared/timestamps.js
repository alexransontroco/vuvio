import { Timestamp } from 'firebase-admin/firestore';
export function nowTimestamp() {
    return Timestamp.now();
}
export function secondsBetween(start, end) {
    if (!start || !end)
        return 0;
    return Math.max(0, Math.floor((end.toMillis() - start.toMillis()) / 1000));
}
