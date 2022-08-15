import {
  ProofOfOwnership,
  ProofOfOwnershipRow,
  CollectionFilter,
  TemplateFilter,
  SchemaFilter,
  TokenFilter,
} from '../../../filler/handlers/security/types/tables';
import {
  encodeDatabaseJson,
} from '../../../filler/utils';

export function parseEosioToDBRow(proofOfOwnership: ProofOfOwnership): ProofOfOwnershipRow {
  const {drop_id, group: {logical_operator, filters}} = proofOfOwnership;
  const parsedFilters: Array<
    CollectionFilter|TemplateFilter|SchemaFilter|TokenFilter
  > = [];
  filters.map(filter => {
    const [type, details] = filter;
    let typedFilter:CollectionFilter|TemplateFilter|SchemaFilter|TokenFilter;
    switch(type) {
      case 'COLLECTION_HOLDINGS':
      {
        const {collection_name, comparison_operator, amount} = details;
        typedFilter = {
          filter_kind: 'COLLECTION_HOLDINGS',
          collection_name,
          comparison_operator,
          amount
        } as CollectionFilter;
        break;
      }
      case 'TEMPLATE_HOLDINGS':
      { 
        const {collection_name, template_id, comparison_operator, amount} = details;
        typedFilter = {
          filter_kind: 'TEMPLATE_HOLDINGS',
          collection_name,
          template_id,
          comparison_operator,
          amount
        } as TemplateFilter;
        break;
      }
      case 'SCHEMA_HOLDINGS':
      {
        const {collection_name, schema_name, comparison_operator, amount} = details;
        typedFilter = {
          filter_kind: 'SCHEMA_HOLDINGS',
          collection_name,
          schema_name,
          comparison_operator,
          amount
        } as SchemaFilter;
        break;
      }
      case 'TOKEN_HOLDING':
        const {token_contract, token_symbol, comparison_operator, amount} = details;
        const [quantity, symbol] = amount.split(' ');
        typedFilter = {
          filter_kind: 'TOKEN_HOLDING',
          token_contract,
          token_symbol,
          comparison_operator,
          amount: {quantity, symbol}
        } as TokenFilter;
        break;
      default:
        throw Error(`Unsupported filter type ${type}, add support for this variant`);
    }
    parsedFilters.push(typedFilter);
  });
  return {drop_id, logical_operator, filters: encodeDatabaseJson(parsedFilters)};
}