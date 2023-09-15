import { ContractHandler } from './interfaces';

import AtomicAssetsHandler from './atomicassets';
import AtomicMarketHandler from './atomicmarket';
import AtomicToolsHandler from './atomictools';
import DelphiOracleHandler from './delphioracle';
import SimpleAssetsHandler from './simpleassets';
import NeftyDropsHandler from './neftydrops';
import CollectionsListHandler from './helpers';
import BlendsHandler from './blends';
import NeftyQuestHandler from './neftyquest';
import NeftyMarketHandler from './neftymarket';
import NeftyAvatarsHandler from './avatars';
import NeftyPacksHandler from './packs';

export const handlers: (typeof ContractHandler)[] = [
    AtomicAssetsHandler,
    AtomicMarketHandler,
    AtomicToolsHandler,
    DelphiOracleHandler,
    SimpleAssetsHandler,
    NeftyDropsHandler,
    CollectionsListHandler,
    BlendsHandler,
    NeftyQuestHandler,
    NeftyMarketHandler,
    NeftyAvatarsHandler,
    NeftyPacksHandler,
];
