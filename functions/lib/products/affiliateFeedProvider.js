import { logger } from 'firebase-functions';
export class AffiliateFeedProvider {
    config;
    id;
    constructor(config) {
        this.config = config;
        this.id = `affiliate:${config.providerId}`;
    }
    canHandle(_query) {
        return false;
    }
    async search(_query) {
        logger.info(`[AffiliateFeedProvider] Feed "${this.config.name}" (${this.config.providerId}) is not yet imported`);
        return [];
    }
    async getProduct(_externalId) {
        return null;
    }
}
