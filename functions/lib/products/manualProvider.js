export class ManualProductProvider {
    id = 'manual';
    canHandle(_query) {
        return false;
    }
    async search(_query) {
        return [];
    }
    async getProduct(_externalId) {
        return null;
    }
}
