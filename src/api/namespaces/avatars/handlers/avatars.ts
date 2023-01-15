import {RequestValues} from '../../utils';
import {AvatarsContext} from '../index';
import {filterQueryArgs} from '../../validation';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';

export async function getAvatarAction(params: RequestValues, ctx: AvatarsContext): Promise<any> {
    const args = filterQueryArgs(params, {
        only_background: {type: 'bool', default: false},
        only_body: {type: 'bool', default: false},
    });

    const avatarQuery = await ctx.db.query(
        'SELECT a.asset_id, a.template_id, a.collection_name, a.schema_name, a.owner, a.mutable_data, a.immutable_data, ' +
        'b.blend_id, b.accessory_specs, b.base_spec ' +
        'FROM neftyavatars_pfps p ' +
        'INNER JOIN atomicassets_assets a ON a.asset_id = p.asset_id ' +
        'INNER JOIN neftyavatars_blends b ON a.template_id = b.base_template_id ' +
        'WHERE p.owner = $1 ',
        [ctx.pathParams.account_name]
    );

    if (avatarQuery.rowCount === 0) {
        return null;
    }

    const result = avatarQuery.rows[0];

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
    if (!args.only_background) {
        data = {
            [backgroundLayerName]: data[backgroundLayerName],
        };
    } else if (args.only_body) {
        delete data[backgroundLayerName];
    }

    const layerImages: string[] = [];
    const ignoreDefault = args.only_background;
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

    if (layerImages.length === 1) {
        return {
            cid: layerImages[0],
        };
    }

    const hashContent = layerImages.join('-');
    const layersHash = crypto.createHash('sha256').update(hashContent).digest('hex');
    const avatarLocation = path.join(ctx.coreArgs.avatars_location, ctx.pathParams.account_name, layersHash);
    if (fs.existsSync(avatarLocation)) {
        return fs.createReadStream(avatarLocation);
    } else {
        const combineBody: any = {
            collection_name: result.collection_name,
            schema_name: result.schema_name,
            layers: layerImages,
        };
        if (result.template_id > -1) {
            combineBody.template_id = result.template_id;
        }
        const results = await fetch(`${ctx.coreArgs.avatar_api_url}/combine-layers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(combineBody),
        });

        const resultJson = await results.json();
        const file = await fetch(`https://ipfs.io/ipfs/${resultJson.cid}`);
        const writeStream = fs.createWriteStream(avatarLocation);
        await file.body.pipe(writeStream);
        return fs.createReadStream(avatarLocation);
    }
}
