import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';
export const notifyNewMessage = onDocumentCreated({
    document: 'conversations/{conversationId}/messages/{messageId}',
    region: 'europe-west1',
}, async (event) => {
    const message = event.data?.data();
    if (!message)
        return;
    const senderId = message.senderId;
    if (!senderId)
        return;
    const conversationId = event.params.conversationId;
    const convDoc = await db.collection('conversations').doc(conversationId).get();
    if (!convDoc.exists)
        return;
    const conv = convDoc.data();
    if (conv.system)
        return;
    const participantIds = conv.participantIds ?? [];
    const recipientId = participantIds.find((id) => id !== senderId);
    if (!recipientId)
        return;
    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderName = senderDoc.data()?.displayName || senderDoc.data()?.username || 'Someone';
    const messageText = message.text ?? '';
    const body = messageText.length > 60 ? `${messageText.slice(0, 60)}\u2026` : messageText;
    await db.collection('users').doc(recipientId).collection('notifications').add({
        type: 'message_received',
        title: `${senderName} sent you a message`,
        body,
        senderId,
        senderName,
        conversationId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
    });
});
