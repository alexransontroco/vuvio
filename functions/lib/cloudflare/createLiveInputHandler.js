import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { createLiveInput } from './cloudflareClient.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringField } from '../shared/validation.js';
export async function createLiveInputHandler(req, res) {
    try {
        const user = await authenticateUser(req);
        const body = asRecord(req.body);
        const streamId = stringField(body, 'streamId', { required: true, max: 64 });
        const title = stringField(body, 'title', { required: true, max: 120 }) ?? 'Untitled';
        // Create Cloudflare live input
        const input = await createLiveInput({
            name: title,
            description: `Created by ${user.uid}`,
        });
        if (!input || !input.uid) {
            throw new ApiError('server_error', 'Failed to create Cloudflare live input');
        }
        // Update Firestore document with Cloudflare info
        const liveRef = db.collection('activeLives').doc(streamId);
        await liveRef.update({
            cloudflareLiveInputId: input.uid,
            cloudflareUid: input.uid,
            playbackUrl: input.playbackUrl,
            hlsManifestUrl: input.hlsManifestUrl,
            recordingStatus: 'processing',
        }).catch(async (err) => {
            // If document doesn't exist, create it
            if (err.code === 5) {
                await liveRef.set({
                    id: streamId,
                    title,
                    creatorId: user.uid,
                    creatorUid: user.uid,
                    cloudflareLiveInputId: input.uid,
                    cloudflareUid: input.uid,
                    playbackUrl: input.playbackUrl,
                    hlsManifestUrl: input.hlsManifestUrl,
                    recordingStatus: 'processing',
                    status: 'preparing',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }, { merge: true });
            }
            else {
                throw err;
            }
        });
        console.log(`[cloudflare] Created live input for stream ${streamId}: ${input.uid}`);
        res.json({
            liveInputId: input.uid,
            playbackUrl: input.playbackUrl,
            hlsManifestUrl: input.hlsManifestUrl,
            ingestUrl: input.ingestUrl,
            streamKey: input.streamKey,
        });
    }
    catch (error) {
        if (error instanceof ApiError) {
            res.status(error.status).json({ code: error.code, message: error.message });
        }
        else {
            console.error('[cloudflare] Error creating live input:', error);
            res.status(500).json({ code: 'server_error', message: 'Failed to create live input' });
        }
    }
}
