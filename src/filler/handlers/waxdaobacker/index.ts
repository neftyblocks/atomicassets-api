import * as fs from 'fs';
import { PoolClient } from 'pg';

import { ContractHandler } from '../interfaces';
import logger from '../../../utils/winston';
import DataProcessor from '../../processor';
import ApiNotificationSender from '../../notifier';
import { assetProcessor } from './processors/assets';
import Filler  from '../../filler';

export const WAXDAO_BACKER_BASE_PRIORITY = 0;

export enum WaxDaoBackerUpdatePriority {
    ACTION_BACK_TOKENS = WAXDAO_BACKER_BASE_PRIORITY + 10,
}

export type WaxDaoBackerReaderArgs = {
    atomicassets_account: string,
    waxdao_backer_account: string
};

export default class WaxDaoBackerHandler extends ContractHandler {
    static handlerName = 'waxdaobacker';
    declare readonly args: WaxDaoBackerReaderArgs;

    static async setup(): Promise<boolean> {
        return false;
    }

    static async upgrade(): Promise<void> {
    }

    constructor(filler: Filler, args: {[key: string]: any}) {
        super(filler, args);

        if (typeof args.atomicassets_account !== 'string') {
            throw new Error('WaxDaoBacker: Argument missing in waxdaobacker handler: atomicassets_account');
        }

        if (typeof args.waxdao_backer_account !== 'string') {
            throw new Error('WaxDaoBacker: Argument missing in waxdaobacker handler: waxdao_backer_account');
        }
    }

    async init(): Promise<void> {

    }

    async deleteDB(): Promise<void> {

    }

    async register(processor: DataProcessor, notifier: ApiNotificationSender): Promise<() => any> {
        const destructors: Array<() => any> = [];
        destructors.push(assetProcessor(this, processor, notifier));
        return (): any => destructors.map(fn => fn());
    }
}
