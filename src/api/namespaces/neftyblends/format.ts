import {formatCollection} from '../atomicassets/format';

export function formatClaim(row: any): any {
    const data = {...row};
    data.txid = row.txid.toString('hex');
    return data;
}

export function formatAsset(row: any): any {
    const data = {...row};

    data.collection = formatCollection(data.collection);

    data.immutable_data = data.immutable_data || {};
    data.name = data.immutable_data?.name;

    delete data['schema_name'];
    delete data['collection_name'];
    delete data['authorized_accounts'];

    return data;
}
