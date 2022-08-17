import {
  ProofOfOwnership,
  ProofOfOwnershipFiltersRow,
  CollectionFilter,
  TemplateFilter,
  SchemaFilter,
  TokenFilter,
} from '../../../filler/handlers/security/types/tables';
import {
  encodeDatabaseJson,
} from '../../../filler/utils';

export function getProofOfOwnershipFiltersRows(proofOfOwnership: ProofOfOwnership): ProofOfOwnershipFiltersRow[] {
  let rows:ProofOfOwnershipFiltersRow[] = [];
  
  const {drop_id, group: {logical_operator, filters}} = proofOfOwnership;

  for (let i = 0; i < filters.length; i++) {
    const [type, details] = filters[i];

    let newRow: ProofOfOwnershipFiltersRow = {
      drop_id,
      filter_index: i,
      logical_operator,
      filter_kind: type,
      collection_holdings: null,
      template_holdings: null,
      schema_holdings: null,
      token_holding: null,
    }

    switch(type) {
      case 'COLLECTION_HOLDINGS':
      {
        newRow.collection_holdings = encodeDatabaseJson(details);
        break;
      }
      case 'TEMPLATE_HOLDINGS':
      { 
        newRow.template_holdings = encodeDatabaseJson(details);
        break;
      }
      case 'SCHEMA_HOLDINGS':
      {
        newRow.schema_holdings = encodeDatabaseJson(details);
        break;
      }
      case 'TOKEN_HOLDING':
      {
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