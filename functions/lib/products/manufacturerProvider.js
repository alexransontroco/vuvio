import { logger } from 'firebase-functions';
export class ManufacturerProductProvider {
    config;
    id;
    constructor(config) {
        this.config = config;
        this.id = `manufacturer:${config.providerId}`;
    }
    canHandle(query) {
        if (!query.brand)
            return false;
        return query.brand.toLowerCase() === this.config.brand.toLowerCase();
    }
    async search(_query) {
        logger.info(`[ManufacturerProvider] Feed for brand "${this.config.brand}" (${this.config.providerId}) is not yet connected`);
        return [];
    }
    async getProduct(_externalId) {
        return null;
    }
}
