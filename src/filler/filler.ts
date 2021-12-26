import ConnectionManager from '../connections/manager';
import StateReceiver from './receiver';
import logger from '../utils/winston';
import { IReaderConfig } from '../types/config';
import { formatSecondsLeft } from '../utils/time';
import { getHandlers } from './handlers';
import { ContractHandler } from './handlers/interfaces';
import { ModuleLoader } from './modules';
import { JobQueue, JobQueuePriority } from './jobqueue';

function estimateSeconds(blocks: number, speed: number, depth: number = 0): number {
    if (blocks <= 2) {
        return 1;
    }

    if (speed < 2) {
        return -1;
    }

    if (depth > 20) {
        return 0;
    }

    const seconds = Math.floor(blocks / speed);

    return seconds + estimateSeconds(seconds * 2, speed, depth + 1);
}

export enum UpdateJobPriority {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

export default class Filler {
    readonly reader: StateReceiver;
    readonly modules: ModuleLoader;

    public readonly jobs: JobQueue;
    private running: boolean = false;

    private readonly handlers: ContractHandler[];

    constructor(private readonly config: IReaderConfig, readonly connection: ConnectionManager) {
        this.handlers = getHandlers(config.contracts, this);
        this.modules = new ModuleLoader(config.modules || []);
        this.reader = new StateReceiver(config, connection, this.handlers, this.modules);

        this.jobs = new JobQueue();

        logger.info(this.handlers.length + ' contract handlers registered');
        for (const handler of this.handlers) {
            logger.info('Contract handler ' + handler.getName() + ' registered', handler.args);
        }
    }

    async deleteDB(): Promise<void> {
        const transaction = await this.connection.database.begin();

        await transaction.query('DELETE FROM contract_readers WHERE name = $1', [this.config.name]);
        await transaction.query('DELETE FROM reversible_queries WHERE reader = $1', [this.config.name]);

        try {
            for (const handler of this.handlers) {
                await handler.deleteDB(transaction);
            }
        } catch (e) {
            logger.error(e);
            await transaction.query('ROLLBACK');

            return;
        }

        await transaction.query('COMMIT');
        transaction.release();
    }

    async startFiller(logInterval: number): Promise<void> {
        const initTransaction = await this.connection.database.begin();

        for (let i = 0; i < this.handlers.length; i++) {
            logger.info('Init handler ' + this.config.contracts[i].handler + ' for reader ' + this.config.name);

            await this.handlers[i].init(initTransaction);
        }

        await initTransaction.query('COMMIT');
        initTransaction.release();

        if (this.config.delete_data) {
            logger.info('Deleting data from handler of reader ' + this.config.name);

            await this.deleteDB();
        }

        const query = await this.connection.database.query('SELECT block_num FROM contract_readers WHERE name = $1', [this.config.name]);

        if (query.rowCount === 0) {
            logger.info('First run of reader. Initializing tables...');

            await this.connection.database.query(
                'INSERT INTO contract_readers(name, block_num, block_time, live, updated) VALUES ($1, $2, $3, $4, $5)',
                [this.config.name, 0, 0, false, 0]
            );
        }

        logger.info('Starting reader: ' + this.config.name);

        await this.reader.startProcessing();

        const lastBlockSpeeds: number[] = [];

        let blockRange = 0;
        let lastBlockTime = Date.now();

        let lastBlockNum = 0;
        let lastOperations = 0;

        let timeout = 3600 * 1000;

        const interval = setInterval(async () => {
            if (!this.running) {
                clearInterval(interval);
            }

            if (lastBlockNum === 0) {
                if (this.reader.currentBlock) {
                    blockRange = this.reader.blocksUntilHead;
                    lastBlockNum = this.reader.currentBlock;
                } else {
                    logger.warn('Not receiving any blocks');
                }

                return;
            }

            const blockSpeed = (this.reader.currentBlock - lastBlockNum) / logInterval;
            const dbSpeed = (this.reader.database.stats.operations - lastOperations) / logInterval;
            lastBlockSpeeds.push(blockSpeed);

            if (lastBlockSpeeds.length > 60) {
                lastBlockSpeeds.shift();
            }

            const queueState = `[DS:${this.reader.dsQueue.size}|SH:${this.reader.ship.blocksQueue.size}|JQ:${this.jobs.active}]`;

            if (lastBlockNum === this.reader.currentBlock && lastBlockNum > 0) {
                const staleTime = Date.now() - lastBlockTime;

                if (staleTime > timeout) {
                    process.send({msg: 'failure'});

                    await new Promise(resolve => setTimeout(resolve, logInterval / 2 * 1000));

                    process.exit(1);
                }

                logger.warn(
                    'Reader ' + this.config.name + ' - No blocks processed ' + queueState + ' - ' +
                    'Stopping in ' + Math.round((timeout - staleTime) / 1000) + ' seconds'
                );
            } else if (this.reader.blocksUntilHead > 60) {
                lastBlockTime = Date.now();
                timeout = 4 * 60 * 1000;

                if (blockRange === 0) {
                    blockRange = this.reader.blocksUntilHead;
                }

                const averageSpeed = lastBlockSpeeds.reduce((prev, curr) => prev + curr, 0) / lastBlockSpeeds.length;
                const currentBlock = Math.max(blockRange - this.reader.blocksUntilHead, 0);

                logger.info(
                    'Reader ' + this.config.name + ' - ' +
                    'Progress: ' + this.reader.currentBlock + ' / ' + (this.reader.currentBlock + this.reader.blocksUntilHead) + ' ' +
                    '(' + (100 * currentBlock / blockRange).toFixed(2) + '%) ' +
                    'Speed: ' + blockSpeed.toFixed(1) + ' B/s ' + dbSpeed.toFixed(0) + ' W/s ' +
                    queueState + ' ' +
                    '(Syncs ' + formatSecondsLeft(estimateSeconds(this.reader.blocksUntilHead, averageSpeed)) + ')'
                );
            } else {
                lastBlockTime = Date.now();
                blockRange = 0;
                timeout = 4 * 60 * 1000;

                logger.info(
                    'Reader ' + this.config.name + ' - ' +
                    'Current Block: ' + this.reader.currentBlock + ' ' +
                    'Speed: ' + blockSpeed.toFixed(1) + ' B/s ' + dbSpeed.toFixed(0) + ' W/s ' +
                    queueState + ' '
                );
            }

            lastBlockNum = this.reader.currentBlock;
            lastOperations = this.reader.database.stats.operations;
        }, logInterval * 1000);

        this.jobs.on('error', (error: Error, job: any) => {
            logger.error(`Error running job ${job.name}`, error);
        });

        setTimeout(() => this.jobs.start(), 5000);

        this.running = true;
    }

    async stopFiller(): Promise<void> {
        this.running = false;

        this.jobs.stop();

        await this.reader.stopProcessing();
    }

}
