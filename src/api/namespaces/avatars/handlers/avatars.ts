import {RequestValues} from '../../utils';
import {AvatarsContext} from '../index';
import {filterQueryArgs} from '../../validation';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as mime from 'mime-types';
import * as replaceStream from 'replacestream';

const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number): string => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const nameToColour = (str: string): string => {
    const stringUniqueHash = [...str]
        .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    let hue = stringUniqueHash % 360;
    if (hue < 0) {
        hue = 360 + hue;
    }
    return hslToHex(hue, 95, 35);
};

export async function getAvatarAction(params: RequestValues, ctx: AvatarsContext): Promise<{ filePath?: string; contentType: string | boolean; headers: Record<string, string>, stream?: ReadableStream }> {
    const args = await filterQueryArgs(params, {
        only_background: {type: 'bool', default: false},
        only_body: {type: 'bool', default: false},
        width: {type: 'int', default: 300},
    });

    const avatarQuery = await ctx.db.query(
        'SELECT a.asset_id, a.template_id, a.collection_name, a.schema_name, a.owner, a.mutable_data, a.immutable_data, t.immutable_data template_data, ' +
        'b.blend_id, b.accessory_specs, b.base_spec, b.lock_schema_name ' +
        'FROM neftyavatars_pfps p ' +
        'INNER JOIN atomicassets_assets a ON a.asset_id = p.asset_id ' +
        'LEFT JOIN atomicassets_templates t ON a.template_id = t.template_id ' +
        'LEFT JOIN neftyavatars_blends b ON (a.template_id = b.base_template_id OR (a.collection_name = b.collection_name AND a.schema_name = b.lock_schema_name))' +
        'WHERE p.owner = $1 ',
        [ctx.pathParams.account_name]
    );

    if (avatarQuery.rowCount === 0) {
        const photoQuery = await ctx.db.query(
            'SELECT p.owner, p.photo_hash ' +
            'FROM profile_photos p ' +
            'WHERE p.owner = $1 ',
            [ctx.pathParams.account_name]
        );

        if (photoQuery.rowCount === 0) {
            const color = nameToColour(ctx.pathParams.account_name);
            const defaultAvatarStream = fs.createReadStream(path.join(__dirname, '../../../../../resources/Checker.svg'))
                .pipe(replaceStream('#######', color, { limit: 1 }));
            return {
                headers: {},
                stream: defaultAvatarStream,
                contentType: 'image/svg+xml',
            };
        }
        const photoHash = photoQuery.rows[0].photo_hash;
        const owner = photoQuery.rows[0].owner;
        return getFallbackProfilePhoto({
            photoHash,
            owner,
            ctx,
            width: args.width,
            isStatic: false,
        });
    }

    const onlyBackground = args.only_background === true;
    const onlyBody = args.only_body === true;

    const result = avatarQuery.rows[0];

    if (!result.blend_id) {
        // Data with lowercase keys
        const data = {
            ...result.mutable_data || {},
            ...result.immutable_data || {},
            ...result.template_data || {},
        }.reduce((acc: any, [key, value]: [string, any]) => {
            acc[key.toLowerCase()] = value;
            return acc;
        });
        const photoHash = data.video || data.img || data.image;
        return getFallbackProfilePhoto({
            photoHash,
            owner: result.owner,
            ctx,
            width: args.width,
            isStatic: !!data.video,
            headers: {
                'x-nefty-pfp-asset-id': result.asset_id,
            }
        });
    }

    const baseAccessorySpec: any = {
        layer_name: 'Base',
        accessory_matches: [],
        z_index: result.base_spec.z_index,
        default_accessory: ['DEFAULT_RESULT', { result_image: result.base_spec.result_image }],
    };
    const accessorySpecs = [baseAccessorySpec, ...result.accessory_specs];
    const sortedAccessorySpecs = accessorySpecs.sort((a: any, b: any) => a.z_index - b.z_index);
    let data = {
        ...result.mutable_data || {},
        ...result.immutable_data || {},
    };

    const backgroundLayerName = 'Background';
    if (onlyBackground) {
        data = {
            [backgroundLayerName]: data[backgroundLayerName],
        };
    } else if (onlyBody) {
        delete data[backgroundLayerName];
    }

    const layerImages: string[] = [];
    const ignoreDefault = onlyBackground;
    sortedAccessorySpecs.forEach((accessory_spec: any) => {
        const layerValue = data[accessory_spec.layer_name]?.toLowerCase();
        let image = null;
        const valueImage = accessory_spec.accessory_matches.find((x: any) => x.result_value.toLowerCase() === layerValue)?.result_image;
        if (!valueImage && !ignoreDefault && accessory_spec.default_accessory[0] === 'DEFAULT_RESULT') {
            image = accessory_spec.default_accessory[1].result_image;
        } else if (valueImage) {
            image = valueImage;
        }
        if (image) {
            layerImages.push(image);
        }
    });


    if (layerImages.length === 0) {
        return null;
    }

    const hashContent = layerImages.join('-');
    const layersHash = crypto.createHash('sha256').update(hashContent).digest('hex');
    const subfolder = onlyBackground ? 'backgrounds' : onlyBody ? 'bodies' : 'avatars';
    const avatarDirectory = path.join(ctx.coreArgs.avatars_location, result.asset_id, subfolder);
    const headers = {
        'x-nefty-pfp-verified': 'true',
        'x-nefty-pfp-locked': result.lock_schema_name === result.schema_name ? 'true' : 'false',
        'x-nefty-pfp-asset-id': result.asset_id,
    };
    const fileName = fs.existsSync(avatarDirectory) ? fs.readdirSync(avatarDirectory).find((file) => file.startsWith(`${layersHash}_${args.width}.`)) : undefined;
    let avatarLocation = fileName && path.join(avatarDirectory, fileName);
    if (avatarLocation && fs.existsSync(avatarLocation)) {
        const contentType = mime.contentType(path.basename(avatarLocation));
        return {
            headers,
            contentType,
            filePath: avatarLocation,
        };
    } else {
        const exist = fs.existsSync(avatarDirectory);
        if (exist) {
            fs.rmSync(avatarDirectory, { recursive: true, force: true });
        }
        fs.mkdirSync(avatarDirectory, { recursive: true });

        const combineBody: any = {
            collection_name: result.collection_name,
            schema_name: result.schema_name,
            layers: data,
        };
        if (result.template_id > -1) {
            combineBody.template_id = result.template_id;
        }
        if (onlyBackground) {
            combineBody.ignore_default = true;
        }
        const results = await fetch(`${ctx.coreArgs.avatar_api_url}/combine-layers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(combineBody),
        });

        const resultJson = await results.json();
        const file = await fetch(`https://resizer.neftyblocks.com?ipfs=${resultJson.cid}&width=${args.width}&static=false`);
        if (file.status !== 200) {
            return null;
        }
        const contentType = file.headers.get('content-type');
        avatarLocation = path.join(avatarDirectory, `${layersHash}_${args.width}.${mime.extension(contentType)}`);
        const writeStream = fs.createWriteStream(avatarLocation);
        await new Promise((resolve, reject) => {
            file.body.pipe(writeStream);
            file.body.on('error', reject);
            writeStream.on('finish', resolve);
        });
        return {
            headers,
            contentType,
            filePath: avatarLocation,
        };
    }
}

async function getFallbackProfilePhoto({photoHash, owner, ctx, width, isStatic, headers = {}}: {photoHash: string; owner: string, width: number, ctx: AvatarsContext, isStatic: boolean, headers?: Record<string, string>}): Promise<{
    filePath?: string;
    contentType: string | boolean;
    headers: Record<string, string>;
    stream?: ReadableStream;
}> {
    const layersHash = crypto.createHash('sha256').update(photoHash).digest('hex');
    const photoDirectory = path.join(ctx.coreArgs.avatars_location, owner);
    const fileName = fs.existsSync(photoDirectory) ? fs.readdirSync(photoDirectory).find((file) => file.startsWith(`${layersHash}_${width}.`)): undefined;
    let photoLocation = fileName && path.join(photoDirectory, fileName);
    if (photoLocation && fs.existsSync(photoLocation)) {
        const contentType = mime.contentType(path.basename(photoLocation));
        return {
            headers: {},
            contentType,
            filePath: photoLocation,
        };
    } else {
        const exist = fs.existsSync(photoDirectory);
        if (exist) {
            fs.rmSync(photoDirectory, {recursive: true, force: true});
        }
        fs.mkdirSync(photoDirectory, { recursive: true });

        const file = await fetch(`https://resizer.neftyblocks.com?ipfs=${photoHash}&width=${width}&static=${isStatic}`);
        if (file.status !== 200) {
            return null;
        }
        const contentType = file.headers.get('content-type');
        photoLocation = path.join(photoDirectory, `${layersHash}_${width}.${mime.extension(contentType)}`);
        const writeStream = fs.createWriteStream(photoLocation);
        await new Promise((resolve, reject) => {
            file.body.pipe(writeStream);
            file.body.on('error', reject);
            writeStream.on('finish', resolve);
        });
        return {
            headers: headers || {},
            contentType,
            filePath: photoLocation,
        };
    }
}
