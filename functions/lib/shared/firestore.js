import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) {
    initializeApp();
}
export const adminAuth = getAuth();
export const db = getFirestore();
export const collections = {
    streams: 'streams',
    gear: 'gear',
    streamStats: 'streamStats',
    webhookEvents: 'webhookEvents',
    users: 'users',
    notifications: 'notifications',
    analyticsEvents: db.collection('analyticsEvents'),
};
