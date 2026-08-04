import { FieldValue } from 'firebase-admin/firestore';
import { db, collections } from '../shared/firestore.js';
/**
 * Aggregate stream statistics
 * Run: Every 5 minutes
 * Purpose: Calculate per-stream metrics for leaderboards
 */
export async function aggregateStreamStats() {
    try {
        const streamsRef = collections.streams;
        const streamsSnap = await db.collection(collections.streams).get();
        let aggregatedCount = 0;
        for (const streamDoc of streamsSnap.docs) {
            const streamId = streamDoc.id;
            const stats = streamDoc.data();
            // Calculate derived metrics
            const viewStarts = stats.viewStarts ?? 0;
            const retention3s = stats.retention3s ?? 0;
            const retention10s = stats.retention10s ?? 0;
            const retention30s = stats.retention30s ?? 0;
            const skips = stats.skips ?? 0;
            const retention3sRate = viewStarts > 0 ? (retention3s / viewStarts) * 100 : 0;
            const retention10sRate = viewStarts > 0 ? (retention10s / viewStarts) * 100 : 0;
            const retention30sRate = viewStarts > 0 ? (retention30s / viewStarts) * 100 : 0;
            const skipRate = viewStarts > 0 ? (skips / viewStarts) * 100 : 0;
            // Calculate engagement score (weighted)
            const engagementScore = ((retention3s * 0.1) + // 3s watched
                (retention10s * 0.3) + // 10s watched (3x weight)
                (retention30s * 0.6) + // 30s watched (6x weight)
                ((stats.follows ?? 0) * 5) + // Follows (high value)
                ((stats.shares ?? 0) * 3) // Shares (medium value)
            );
            // Update aggregated stats in streamStats collection
            await db.collection('streamStats').doc(streamId).set({
                streamId,
                impressions: stats.impressions ?? 0,
                viewStarts,
                retention3s,
                retention10s,
                retention30s,
                retention3sRate: Math.round(retention3sRate * 100) / 100,
                retention10sRate: Math.round(retention10sRate * 100) / 100,
                retention30sRate: Math.round(retention30sRate * 100) / 100,
                skips,
                skipRate: Math.round(skipRate * 100) / 100,
                follows: stats.follows ?? 0,
                shares: stats.shares ?? 0,
                gear: stats.gear ?? 0,
                engagementScore: Math.round(engagementScore * 100) / 100,
                totalWatchTimeSeconds: stats.totalWatchTime ?? 0,
                averageWatchTimeSeconds: viewStarts > 0 ? Math.round((stats.totalWatchTime ?? 0) / viewStarts) : 0,
                aggregatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            aggregatedCount++;
        }
        console.log(`[Stats] Aggregated stats for ${aggregatedCount} streams`);
        return { success: true, aggregatedCount };
    }
    catch (error) {
        console.error('[Stats] Failed to aggregate stream stats:', error);
        throw error;
    }
}
/**
 * Aggregate creator statistics
 * Run: Every 5 minutes (after stream stats)
 * Purpose: Calculate per-creator metrics
 */
export async function aggregateCreatorStats() {
    try {
        const usersRef = db.collection('users');
        const usersSnap = await usersRef.get();
        let aggregatedCount = 0;
        for (const userDoc of usersSnap.docs) {
            const creatorId = userDoc.id;
            const creator = userDoc.data();
            // Get all streams by this creator
            const streamsSnap = await db.collection('streams').where('creatorId', '==', creatorId).get();
            if (streamsSnap.empty)
                continue;
            // Aggregate from all creator's streams
            let totalViews = 0;
            let uniqueViewers = new Set();
            let totalFollows = 0;
            let totalShares = 0;
            let totalRetention3s = 0;
            let totalRetention10s = 0;
            let totalRetention30s = 0;
            let totalSkips = 0;
            for (const streamDoc of streamsSnap.docs) {
                const stats = streamDoc.data().stats || {};
                const viewStarts = stats.viewStarts ?? 0;
                totalViews += viewStarts;
                totalFollows += stats.follows ?? 0;
                totalShares += stats.shares ?? 0;
                totalRetention3s += stats.retention3s ?? 0;
                totalRetention10s += stats.retention10s ?? 0;
                totalRetention30s += stats.retention30s ?? 0;
                totalSkips += stats.skips ?? 0;
            }
            // Get unique viewers from analytics events
            const eventsSnap = await db
                .collection('analyticsEvents')
                .where('creatorId', '==', creatorId)
                .where('eventName', '==', 'viewer_joined')
                .get();
            eventsSnap.forEach((doc) => {
                const event = doc.data();
                if (event.anonymousId) {
                    uniqueViewers.add(event.anonymousId);
                }
            });
            // Calculate rates
            const retention3sRate = totalViews > 0 ? (totalRetention3s / totalViews) * 100 : 0;
            const retention10sRate = totalViews > 0 ? (totalRetention10s / totalViews) * 100 : 0;
            const retention30sRate = totalViews > 0 ? (totalRetention30s / totalViews) * 100 : 0;
            const skipRate = totalViews > 0 ? (totalSkips / totalViews) * 100 : 0;
            // Calculate engagement score
            const engagementScore = ((totalRetention3s * 0.1) +
                (totalRetention10s * 0.3) +
                (totalRetention30s * 0.6) +
                (totalFollows * 5) +
                (totalShares * 3));
            // Save aggregated creator stats
            await db.collection('creatorStats').doc(creatorId).set({
                creatorId,
                creatorName: creator.displayName || 'Unknown',
                totalViews,
                uniqueViewers: uniqueViewers.size,
                totalFollows,
                totalShares,
                retention3sRate: Math.round(retention3sRate * 100) / 100,
                retention10sRate: Math.round(retention10sRate * 100) / 100,
                retention30sRate: Math.round(retention30sRate * 100) / 100,
                skipRate: Math.round(skipRate * 100) / 100,
                engagementScore: Math.round(engagementScore * 100) / 100,
                aggregatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            aggregatedCount++;
        }
        console.log(`[Stats] Aggregated stats for ${aggregatedCount} creators`);
        return { success: true, aggregatedCount };
    }
    catch (error) {
        console.error('[Stats] Failed to aggregate creator stats:', error);
        throw error;
    }
}
/**
 * Aggregate category statistics
 * Run: Every 5 minutes (after stream stats)
 * Purpose: Track category popularity trends
 */
export async function aggregateCategoryStats() {
    try {
        const streamsSnap = await db.collection('streams').get();
        const categoryMap = new Map();
        // Group streams by category
        for (const streamDoc of streamsSnap.docs) {
            const stream = streamDoc.data();
            const category = stream.category || 'uncategorized';
            if (!categoryMap.has(category)) {
                categoryMap.set(category, {
                    category,
                    totalViews: 0,
                    totalStreams: 0,
                    activeStreams: 0,
                    uniqueViewers: new Set(),
                    totalFollows: 0,
                    totalShares: 0,
                });
            }
            const stats = categoryMap.get(category);
            const streamStats = stream.stats || {};
            stats.totalViews += streamStats.viewStarts ?? 0;
            stats.totalStreams += 1;
            if (stream.status === 'live')
                stats.activeStreams += 1;
            stats.totalFollows += streamStats.follows ?? 0;
            stats.totalShares += streamStats.shares ?? 0;
        }
        // Get unique viewers per category
        for (const [category, data] of categoryMap) {
            const eventsSnap = await db
                .collection('analyticsEvents')
                .where('category', '==', category)
                .where('eventName', '==', 'viewer_joined')
                .get();
            const uniqueViewers = new Set();
            eventsSnap.forEach((doc) => {
                const event = doc.data();
                if (event.anonymousId) {
                    uniqueViewers.add(event.anonymousId);
                }
            });
            data.uniqueViewers = uniqueViewers.size;
        }
        // Save category stats and calculate ranking
        const sortedCategories = Array.from(categoryMap.values())
            .sort((a, b) => b.totalViews - a.totalViews);
        let rank = 1;
        for (const stats of sortedCategories) {
            await db.collection('categoryStats').doc(stats.category).set({
                category: stats.category,
                totalViews: stats.totalViews,
                uniqueViewers: stats.uniqueViewers,
                totalStreams: stats.totalStreams,
                activeStreams: stats.activeStreams,
                totalFollows: stats.totalFollows,
                totalShares: stats.totalShares,
                averageViewsPerStream: stats.totalStreams > 0 ? Math.round(stats.totalViews / stats.totalStreams) : 0,
                popularityRank: rank,
                aggregatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            rank++;
        }
        console.log(`[Stats] Aggregated stats for ${categoryMap.size} categories`);
        return { success: true, categoriesCount: categoryMap.size };
    }
    catch (error) {
        console.error('[Stats] Failed to aggregate category stats:', error);
        throw error;
    }
}
/**
 * Calculate user affinity scores
 * Run: Every hour
 * Purpose: Recommend streams based on watch history
 */
export async function aggregateUserAnalytics() {
    try {
        const usersSnap = await db.collection('users').get();
        let aggregatedCount = 0;
        for (const userDoc of usersSnap.docs) {
            const userId = userDoc.id;
            // Get all events for this user
            const eventsSnap = await db
                .collection('analyticsEvents')
                .where('userId', '==', userId)
                .get();
            if (eventsSnap.empty)
                continue;
            // Calculate affinities by category, creator, source
            const categoryAffinities = new Map();
            const creatorAffinities = new Map();
            const sourceBreakdown = new Map();
            const affinityWeights = {
                stream_impression: 0.1,
                viewer_joined: 0.5,
                view_10_seconds: 1,
                view_30_seconds: 2,
                follow_creator: 5,
                share: 3,
                gear_opened: 0.5,
                skip: -1,
            };
            for (const eventDoc of eventsSnap.docs) {
                const event = eventDoc.data();
                const weight = affinityWeights[event.eventName] ?? 0;
                if (event.category) {
                    categoryAffinities.set(event.category, (categoryAffinities.get(event.category) ?? 0) + weight);
                }
                if (event.creatorId) {
                    creatorAffinities.set(event.creatorId, (creatorAffinities.get(event.creatorId) ?? 0) + weight);
                }
                if (event.source) {
                    sourceBreakdown.set(event.source, (sourceBreakdown.get(event.source) ?? 0) + 1);
                }
            }
            // Normalize affinities (top 10)
            const topCategories = Array.from(categoryAffinities.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .reduce((acc, [cat, score]) => ({ ...acc, [cat]: Math.round(score * 100) / 100 }), {});
            const topCreators = Array.from(creatorAffinities.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .reduce((acc, [creator, score]) => ({ ...acc, [creator]: Math.round(score * 100) / 100 }), {});
            const sources = Array.from(sourceBreakdown.entries())
                .reduce((acc, [source, count]) => ({ ...acc, [source]: count }), {});
            // Save user analytics
            await db.collection('userAnalytics').doc(userId).set({
                userId,
                categoryAffinities: topCategories,
                creatorAffinities: topCreators,
                sourceBreakdown: sources,
                totalEventsRecorded: eventsSnap.size,
                aggregatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            aggregatedCount++;
        }
        console.log(`[Stats] Aggregated analytics for ${aggregatedCount} users`);
        return { success: true, aggregatedCount };
    }
    catch (error) {
        console.error('[Stats] Failed to aggregate user analytics:', error);
        throw error;
    }
}
