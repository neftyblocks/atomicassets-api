export const neftyDropsComponents = {
  Drop: {
    type: 'object',
    properties: {
      drops_contract: {type: 'string'},
      assets_contract: {type: 'string'},
      drop_id: {type: 'string'},
      price: {
        type: 'object',
        properties: {
          token_contract: {type: 'string'},
          token_symbol: {type: 'string'},
          token_precision: {type: 'number'},
          median_price: {type: 'number'},
          amount: {type: 'string'},
        }
      },
      listing_price: {type: 'string'},
      listing_symbol: {type: 'boolean'},
      assets: {
        type: 'object',
        properties: {
          template: {$ref: '#/components/schemas/Template'},
          backed_tokens: {type: 'array', items: {type: 'string'}},
        }
      },
      display_data: {
        type: 'object', properties: {
            name: {type: 'string'},
            description: {type: 'string'},
        }
      },
      is_deleted: {type: 'boolean'},
      is_hidden: {type: 'boolean'},
      updated_at_block: {type: 'string'},
      updated_at_time: {type: 'string'},
      created_at_block: {type: 'string'},
      created_at_time: {type: 'string'},
      preminted: {type: 'boolean'},
      start_time: {type: 'string'},
      end_time: {type: 'string'},
      auth_required: {type: 'boolean'},
      account_limits: {type: 'string'},
      account_limit_cooldown: {type: 'string'},
      max_claimable: {type: 'string'},
      current_claimed: {type: 'string'},
      price_recipient: {type: 'string'},
    }
  },
  DropClaim: {
    type: 'object',
    properties: {
      drops_contract: {type: 'string'},
      assets_contract: {type: 'string'},
      claim_id: {type: 'string'},
      claimer: {type: 'string'},
      amount: {type: 'string'},
      country: {type: 'string'},
      total_price: {
        type: 'object',
        properties: {
          token_contract: {type: 'string'},
          token_symbol: {type: 'string'},
          token_precision: {type: 'number'},
          amount: {type: 'string'},
        }
      },
      referrer: {type: 'string'},
      txid: {type: 'string'},
      created_at_block: {type: 'string'},
      created_at_time: {type: 'string'},
    }
  },
  CollectionsBalance: {

  },
  ClaimersBalance: {

  },
  GroupedDrop: {
    type: 'object',
    properties: {
      collection: {
        '$ref': '#/components/schemas/Collection'
      },
      drops: {
        type: 'array',
        items: {'$ref': '#/components/schemas/Drop'}
      }
    }
  },
  SellersBalance: {

  },
  BuyersBalance: {

  },
  'ClaimableDrop': {
    type: 'object',
    properties: {
      drop_id: {type: 'string'},
      claim_type: {type: 'string'},
      is_claimable: {type: 'boolean'},
      claims_left: {type: 'number'},
      next_claim: {type: 'string'},
    }
  }
};

export const dropDataFilter =
    'You can filter the result by specific template data fields.' +
    'You can add for example &template_data.rarity=common to only receive results which have an attribute "rarity" with the value "common". ' +
    'You can query specific asset data by using &immutable_data.rarity=common or &mutable_data.rarity=common .' +
    'If you want to query a non text type you need to specify it explicitly (defaults to text type) like data:bool.foil=true or data:number.id=4 or data:text.rarity=common. ' +
    'Integers which are defined greater than 32 bit (eg 64 bit) in the schema need to be queried as text.';

export const dropsFilterParameters = [
  {
    name: 'min_assets',
    in: 'query',
    description: 'Min assets per drop',
    required: false,
    schema: {type: 'integer'}
  },
  {
    name: 'max_assets',
    in: 'query',
    description: 'Max assets per drop',
    required: false,
    schema: {type: 'integer'}
  },
  {
    name: 'template_id',
    in: 'query',
    description: 'Template id in the drop',
    required: false,
    schema: {type: 'int'}
  },
  {
    name: 'symbol',
    in: 'query',
    description: 'Filter by symbol',
    required: false,
    schema: {type: 'string'}
  },
  {
    name: 'min_price',
    in: 'query',
    description: 'Lower price limit',
    required: false,
    schema: {type: 'number'}
  },
  {
    name: 'max_price',
    in: 'query',
    description: 'Upper price limit',
    required: false,
    schema: {type: 'number'}
  },
];
