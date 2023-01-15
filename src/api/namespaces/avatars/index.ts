import * as express from 'express';

import { ApiNamespace } from '../interfaces';
import { HTTPServer } from '../../server';
import { avatarsEndpoint } from './routes/avatars';
import {ActionHandlerContext} from '../../actionhandler';
import * as fs from 'fs';

export type AvatarsNamespaceArgs = {
    avatar_api_url: string,
    avatars_location: string,
};

export type AvatarsContext = ActionHandlerContext<AvatarsNamespaceArgs>;

export class AvatarsNamespace extends ApiNamespace {
    static namespaceName = 'avatars';

    declare args: AvatarsNamespaceArgs;

    async init(): Promise<void> {
        if (typeof this.args.avatar_api_url !== 'string') {
            throw new Error('Argument missing in avatars api namespace: avatar_api_url');
        }

        if (typeof this.args.avatars_location !== 'string') {
            throw new Error('Argument missing in avatars api namespace: avatars_location');
        }

        if (!fs.existsSync(this.args.avatars_location)) {
            throw new Error('Avatars location does not exist: ' + this.args.avatars_location);
        }
    }

    async router(server: HTTPServer): Promise<express.Router> {
        const router = express.Router();

        if (server.web.limiter) {
            server.web.express.use(this.path + '/v1', server.web.limiter);
        }

        const endpointsDocs = [];
        endpointsDocs.push(avatarsEndpoint(this, server, router));

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
