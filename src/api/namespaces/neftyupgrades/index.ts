import * as express from 'express';

import { ApiNamespace } from '../interfaces';
import { HTTPServer } from '../../server';
import { upgradesEndpoints } from './routes/upgrades';
import { neftyUpgradesComponents } from './openapi';
import { ActionHandlerContext } from '../../actionhandler';

export type NeftyUpgradesNamespaceArgs = {
    atomicassets_account: string,
    upgrades_account: string,
};

export type NeftyUpgradesContext = ActionHandlerContext<NeftyUpgradesNamespaceArgs>

export class NeftyUpgradesNamespace extends ApiNamespace {
    static namespaceName = 'neftyupgrades';

    declare args: NeftyUpgradesNamespaceArgs;

    async init(): Promise<void> {  }

    async router(server: HTTPServer): Promise<express.Router> {

        const router = express.Router();

        server.docs.addSchemas(neftyUpgradesComponents);

        if (server.web.limiter) {
            server.web.express.use(this.path + '/v1', server.web.limiter);
        }

        const endpointsDocs = [];
        endpointsDocs.push(upgradesEndpoints(this, server, router));

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
