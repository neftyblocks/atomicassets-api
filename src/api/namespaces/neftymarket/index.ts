import * as express from 'express';

import { ApiNamespace } from '../interfaces';
import { HTTPServer } from '../../server';
import { AssetApi } from '../atomicassets/routes/assets';
import { filtersEndpoints } from './routes/filters';
import { auctionsEndpoints } from './routes/auctions';
import { neftyMarketComponents } from './openapi';
import {ActionHandlerContext} from '../../actionhandler';
import {ILimits} from '../../../types/config';
import {statsEndpoints} from './routes/stats';
import {assetsEndpoints} from './routes/assets';
import {pricesEndpoints} from './routes/prices';
import {buildAssetFillerHook, formatListingAsset} from '../atomicmarket/format';

export type NeftyMarketNamespaceArgs = {
    atomicassets_account: string,
    connected_reader: string;
    neftymarket_account: string;
    default_symbol?: string,
    limits?: ILimits;
};

export enum AuctionApiState {
    WAITING = 0, // Auction created but assets were not transferred yet
    LISTED = 1, // Auction pending and open to bids
    CANCELED = 2, // Auction was canceled
    SOLD = 3, // Auction has been sold
    INVALID = 4 // Auction ended but no bid was made
}

export enum AuctionType {
    ENGLISH = 0, // English auction where price goes up
    DUTCH = 1, // Dutch auction where price goes down
}

export type NeftyMarketContext = ActionHandlerContext<NeftyMarketNamespaceArgs>;

export class NeftyMarketNamespace extends ApiNamespace {
    static namespaceName = 'neftymarket';

    declare args: NeftyMarketNamespaceArgs;

    async init(): Promise<void> {
        if (typeof this.args.atomicassets_account !== 'string') {
            throw new Error('Argument missing in neftymarket api namespace: atomicassets_account');
        }
    }

    async router(server: HTTPServer): Promise<express.Router> {

        const router = express.Router();

        server.docs.addSchemas(neftyMarketComponents);

        if (server.web.limiter) {
            server.web.express.use(this.path + '/v1', server.web.limiter);
        }

        const assetApi = new AssetApi(
            this, server, 'ListingAsset',
            'atomicassets_assets_master',
            formatListingAsset, buildAssetFillerHook({fetchSales: true, fetchAuctions: true, fetchPrices: true, fetchNeftyAuctions: true})
        );

        const endpointsDocs = [];
        endpointsDocs.push(filtersEndpoints(this, server, router));
        endpointsDocs.push(auctionsEndpoints(this, server, router));
        endpointsDocs.push(statsEndpoints(this, server, router));
        endpointsDocs.push(assetsEndpoints(this, server, router));
        endpointsDocs.push(assetApi.singleAssetEndpoints(router));
        endpointsDocs.push(pricesEndpoints(this, server, router));

        for (const doc of endpointsDocs) {
            if (doc.tag) {
                server.docs.addTags([doc.tag]);
            }

            if (doc.paths) {
                const paths: any = {};

                for (const path of Object.keys(doc.paths)) {
                    paths[this.path + path] = doc.paths[path];
                }

                server.docs.addPaths(paths);
            }
        }

        router.all(['/docs', '/docs/swagger'], (req, res) => res.redirect('/docs'));
        return router;
    }

    async socket(): Promise<void> { }
}
