import * as express from 'express';

import { ApiNamespace } from '../interfaces';
import { HTTPServer } from '../../server';
import { neftyPacksComponents } from './openapi';
import { ActionHandlerContext } from '../../actionhandler';
import { ILimits } from '../../../types/config';
import { packsEndpoints } from './routes/packs';

export type NeftyPacksNamespaceArgs = {
    atomicassets_account: string,
    limits?: ILimits;
};

export type NeftyPacksContext = ActionHandlerContext<NeftyPacksNamespaceArgs>;

export class NeftyPacksNamespace extends ApiNamespace {
    static namespaceName = 'neftypacks';

    declare args: NeftyPacksNamespaceArgs;

    async init(): Promise<void> {
        if (typeof this.args.atomicassets_account !== 'string') {
            throw new Error('Argument missing in neftypacks api namespace: atomicassets_account');
        }
    }

    async router(server: HTTPServer): Promise<express.Router> {

        const router = express.Router();

        server.docs.addSchemas(neftyPacksComponents);

        if (server.web.limiter) {
            server.web.express.use(this.path + '/v1', server.web.limiter);
        }

        const endpointsDocs = [];
        endpointsDocs.push(packsEndpoints(this, server, router));

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
