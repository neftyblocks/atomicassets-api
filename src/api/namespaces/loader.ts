import { ApiNamespace } from './interfaces';
import { AtomicAssetsNamespace } from './atomicassets';
import { AtomicMarketNamespace } from './atomicmarket';
import { AtomicToolsNamespace } from './atomictools';
import { NeftyDropsNamespace } from './neftydrops';
import { NeftyMarketNamespace } from './neftymarket';
import { NeftyBlendsNamespace } from './neftyblends';
import { HelpersNamespace } from './helpers';
import { NeftyQuestNamespace } from './neftyquest';
import { AvatarsNamespace } from './avatars';
import { NeftyPacksNamespace } from './neftypacks';
import { NeftyUpgradesNamespace} from './neftyupgrades';
import { LaunchesNamespace } from './launchbagz';

export const namespaces: (typeof ApiNamespace)[] = [
    AtomicAssetsNamespace,
    AtomicMarketNamespace,
    AtomicToolsNamespace,
    NeftyDropsNamespace,
    NeftyMarketNamespace,
    NeftyBlendsNamespace,
    HelpersNamespace,
    NeftyQuestNamespace,
    AvatarsNamespace,
    NeftyPacksNamespace,
    NeftyUpgradesNamespace,
    LaunchesNamespace,
];
