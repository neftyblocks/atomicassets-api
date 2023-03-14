import {formatCollection} from '../atomicassets/format';
import {renderMarkdownToHtml} from '../utils';

export function formatDrop(row: any, hideDescription = false, renderMarkdown = false): any {
    if (!row) {
        return row;
    }
    const data = {...row};

    data.price.amount = row.raw_price;
    try {
        data.display_data = JSON.parse(row.display_data);
        if (hideDescription) {
            delete data.display_data.description;
        }
        if (renderMarkdown && data.display_data.description) {
            data.display_data.description = renderMarkdownToHtml(data.display_data.description);
        }
    } catch (e) {
        data.display_data = {};
    }

    delete data.raw_price;
    delete data.raw_token_symbol;
    delete data.raw_token_precision;
    delete data.drop_state;
    return data;
}

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
