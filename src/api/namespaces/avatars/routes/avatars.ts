import * as express from 'express';

import {AvatarsNamespace} from '../index';
import { HTTPServer } from '../../../server';
import {
    getOpenAPI3Responses,
} from '../../../docs';
import {getAvatarAction} from '../handlers/avatars';

export function avatarsEndpoint(core: AvatarsNamespace, server: HTTPServer, router: express.Router): any {
    const { caching, returnAsPng } = server.web;
    router.all('/v1/avatars/:account_name', caching(), returnAsPng(getAvatarAction, core));

    return {
        tag: {
            name: 'avatars',
            description: 'Avatars'
        },
        paths: {
            '/v1/avatars': {
                get: {
                    tags: ['avatars', 'pfps'],
                    summary: 'Get account avatar',
                    description:
                        'Get te avatar assigned to an account',
                    parameters: [
                        {
                            name: 'body',
                            in: 'query',
                            description: 'Body',
                            required: false,
                            schema: {
                                type: 'boolean',
                            }
                        },
                        {
                            name: 'background',
                            in: 'query',
                            description: 'Background',
                            required: false,
                            schema: {
                                type: 'boolean',
                            }
                        },
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'file',
                    })
                }
            },
        }
    };
}
