import {
  ProofOfOwnership,
  ProofOfOwnershipFiltersRow,
} from '../../../filler/handlers/security/types/tables';
import {
  encodeDatabaseJson,
} from '../../../filler/utils';

export function getProofOfOwnershipFiltersRows(proofOfOwnership: ProofOfOwnership): ProofOfOwnershipFiltersRow[] {
  const rows:ProofOfOwnershipFiltersRow[] = [];

  const {drop_id, group: {logical_operator, filters}} = proofOfOwnership;

  for (let i = 0; i < filters.length; i++) {
    const [type, details] = filters[i];

    const newRow: ProofOfOwnershipFiltersRow = {
      drop_id,
      filter_index: i,
      logical_operator,
      filter_kind: type,
      total_filter_count: filters.length,
      comparison_operator: details.comparison_operator,
      nft_amount: null,
      collection_holdings: null,
      template_holdings: null,
      schema_holdings: null,
      token_holding: null,
    };

    switch(type) {
      case 'COLLECTION_HOLDINGS':
      {
        newRow.nft_amount = details.amount;
        newRow.collection_holdings = encodeDatabaseJson(details);
        break;
      }
      case 'TEMPLATE_HOLDINGS':
      {
        newRow.nft_amount = details.amount;
        newRow.template_holdings = encodeDatabaseJson(details);
        break;
      }
      case 'SCHEMA_HOLDINGS':
      {
        newRow.nft_amount = details.amount;
        newRow.schema_holdings = encodeDatabaseJson(details);
        break;
      }
      case 'TOKEN_HOLDING':
      {
        newRow.nft_amount = null;
        newRow.token_holding = encodeDatabaseJson(details);
        break;
      }
      default:
        throw Error(`Unsupported filter type ${type}, add support for this variant`);
    }

    rows.push(newRow);
  }

  return rows;
}
