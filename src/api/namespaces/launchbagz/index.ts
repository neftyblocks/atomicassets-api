import * as express from 'express';

import { ApiNamespace } from '../interfaces';
import { HTTPServer } from '../../server';
import { tokensEndpoints } from './routes/tokens';
import { launchBagzComponents } from './openapi';
import { ActionHandlerContext } from '../../actionhandler';
import {launchesEndpoints} from './routes/launches';
import {farmsEndpoints} from './routes/farms';
import {vestingsEndpoints} from './routes/vestings';

export type LaunchesNamespaceArgs = {
    atomicassets_account: string,
    launch_account: string,
    registry_account: string,
    farms_account: string,
};

export type LaunchesContext = ActionHandlerContext<LaunchesNamespaceArgs>

export class LaunchesNamespace extends ApiNamespace {
    static namespaceName = 'launchbagz';

    declare args: LaunchesNamespaceArgs;

    async init(): Promise<void> {  }

    async router(server: HTTPServer): Promise<express.Router> {

        const router = express.Router();

        server.docs.addSchemas(launchBagzComponents);

        if (server.web.limiter) {
            server.web.express.use(this.path + '/v1', server.web.limiter);
        }

        const endpointsDocs = [];
        endpointsDocs.push(tokensEndpoints(this, server, router));
        endpointsDocs.push(launchesEndpoints(this, server, router));
        endpointsDocs.push(farmsEndpoints(this, server, router));
        endpointsDocs.push(vestingsEndpoints(this, server, router));

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
