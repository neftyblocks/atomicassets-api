CREATE OR REPLACE VIEW neftyupgrades_upgrade_details_master AS
SELECT upgrade.upgrade_id,
       upgrade.contract,
       upgrade.collection_name,
       upgrade.start_time,
       upgrade.end_time,
       upgrade.max,
       upgrade.use_count,
       upgrade.display_data,
       upgrade.created_at_time,
       upgrade.ingredients_count,
       upgrade.security_id,
       upgrade.is_hidden,
       jsonb_agg(DISTINCT jsonb_build_object(
               'type', ingredient.ingredient_type,
               'effect', ingredient.effect,
               'amount', ingredient.amount,
               'index', ingredient.ingredient_index,
               'display_data', ingredient.display_data,
               CASE
                   WHEN ingredient.ingredient_type = 'TEMPLATE_INGREDIENT' THEN 'template'
                   WHEN ingredient.ingredient_type = 'SCHEMA_INGREDIENT' THEN 'schema'
                   WHEN ingredient.ingredient_type = 'COLLECTION_INGREDIENT' THEN 'collection'
                   WHEN ingredient.ingredient_type = 'ATTRIBUTE_INGREDIENT' THEN 'attributes'
                   WHEN ingredient.ingredient_type = 'BALANCE_INGREDIENT' THEN 'template'
                   WHEN ingredient.ingredient_type = 'TYPED_ATTRIBUTE_INGREDIENT' THEN 'typed_attributes'
                   WHEN ingredient.ingredient_type = 'FT_INGREDIENT' THEN 'ft_amount'
                   END,
               CASE
                   WHEN ingredient.ingredient_type = 'TEMPLATE_INGREDIENT' THEN
                       jsonb_build_object(
                               'template_id', ingredient.template_id
                       )
                   WHEN ingredient.ingredient_type = 'SCHEMA_INGREDIENT' THEN
                       jsonb_build_object(
                               'schema_name', ingredient.schema_name,
                               'collection_name', ingredient.ingredient_collection_name
                       )
                   WHEN ingredient.ingredient_type = 'COLLECTION_INGREDIENT' THEN
                       jsonb_build_object(
                               'collection_name', ingredient.ingredient_collection_name
                       )
                   WHEN ingredient.ingredient_type = 'ATTRIBUTE_INGREDIENT' THEN
                       jsonb_build_object(
                               'attributes', attribute_ing_sub.attributes,
                               'schema_name', ingredient.schema_name,
                               'collection_name', ingredient.ingredient_collection_name
                       )
                   WHEN ingredient.ingredient_type = 'BALANCE_INGREDIENT' THEN
                       jsonb_build_object(
                               'template_id', ingredient.template_id,
                               'schema_name', ingredient.schema_name,
                               'attribute_name', ingredient.balance_ingredient_attribute_name,
                               'cost', ingredient.balance_ingredient_cost
                       )
                   WHEN ingredient.ingredient_type = 'TYPED_ATTRIBUTE_INGREDIENT' THEN
                       jsonb_build_object(
                               'typed_attributes', typed_attribute_ing_sub.typed_attributes,
                               'schema_name', ingredient.schema_name,
                               'collection_name', ingredient.ingredient_collection_name
                       )
                   WHEN ingredient.ingredient_type = 'FT_INGREDIENT' THEN
                       jsonb_build_object(
                               'token_contract', "token".token_contract,
                               'token_symbol', "token".token_symbol,
                               'token_precision', "token".token_precision,
                               'amount', ft_ingredient_quantity_price
                       )
                   END
                          )) FILTER (where ingredient.ingredient_index is not null) as ingredients,
       jsonb_agg(jsonb_build_object(
               'index', upg_spec_sub.spec_index,
               'schema_name', upg_spec_sub.schema_name,
               'upgrade_requirements', upg_spec_sub.upgrade_requirements,
               'upgrade_results', upg_spec_sub.upgrade_results
                 )) FILTER (where upg_spec_sub.spec_index is not null)      as upgrade_specs,
       upgrade.category
FROM neftyupgrades_upgrades upgrade
         LEFT JOIN neftyupgrades_upgrade_ingredients "ingredient" ON
    ingredient.contract = upgrade.contract AND
    ingredient.upgrade_id = upgrade.upgrade_id
         LEFT JOIN neftyupgrades_tokens "token" ON "token".contract = ingredient.contract AND
                                                   "token".token_symbol =
                                                   ingredient.ft_ingredient_quantity_symbol
         LEFT JOIN(SELECT ing_attribute.contract,
                          ing_attribute.upgrade_id,
                          ing_attribute.ingredient_index,
                          jsonb_agg(jsonb_build_object(
                                  'name', ing_attribute.attribute_name,
                                  'allowed_values', ing_attribute.allowed_values
                                    )) as "attributes"
                   FROM neftyupgrades_upgrade_ingredient_attributes ing_attribute
                   GROUP BY ing_attribute.contract, ing_attribute.upgrade_id,
                            ing_attribute.ingredient_index) as attribute_ing_sub ON
    ingredient.ingredient_type = 'ATTRIBUTE_INGREDIENT' AND
    attribute_ing_sub.contract = ingredient.contract AND
    attribute_ing_sub.upgrade_id = ingredient.upgrade_id AND
    attribute_ing_sub.ingredient_index = ingredient.ingredient_index
         LEFT JOIN(SELECT ing_typed_attribute.contract,
                          ing_typed_attribute.upgrade_id,
                          ing_typed_attribute.ingredient_index,
                          jsonb_agg(jsonb_build_object(
                                  'name', ing_typed_attribute.attribute_name,
                                  'type', ing_typed_attribute.attribute_type,
                                  'allowed_values', ing_typed_attribute.allowed_values
                                    )) as "typed_attributes"
                   FROM neftyupgrades_upgrade_ingredient_typed_attributes ing_typed_attribute
                   GROUP BY ing_typed_attribute.contract, ing_typed_attribute.upgrade_id,
                            ing_typed_attribute.ingredient_index) AS typed_attribute_ing_sub ON
    ingredient.ingredient_type = 'TYPED_ATTRIBUTE_INGREDIENT' AND
    typed_attribute_ing_sub.contract = ingredient.contract AND
    typed_attribute_ing_sub.upgrade_id = ingredient.upgrade_id AND
    typed_attribute_ing_sub.ingredient_index = ingredient.ingredient_index
         LEFT JOIN(SELECT upg_spec.contract,
                          upg_spec.upgrade_id,
                          upg_spec.spec_index,
                          upg_spec.schema_name,
                          jsonb_agg(jsonb_build_object(
                                  'type', upg_req_sub.requirement_type,
                                  'payload', upg_req_sub.requirement_payload
                                    )) FILTER (where upg_req_sub.requirement_index is not null) as upgrade_requirements,
                          jsonb_agg(jsonb_build_object(
                                  'attribute_name', upg_res_sub.attribute_name,
                                  'attribute_type', upg_res_sub.attribute_type,
                                  'operator_type', upg_res_sub.operator_type,
                                  'value_type', upg_res_sub.value_type,
                                  'value', upg_res_sub.value
                                    )) FILTER (where upg_res_sub.result_index is not null)      as upgrade_results
                   FROM neftyupgrades_upgrade_specs upg_spec
                            LEFT JOIN (SELECT upg_req.contract,
                                              upg_req.upgrade_id,
                                              upg_req.spec_index,
                                              upg_req.requirement_index,
                                              upg_req.requirement_type,
                                              upg_req.requirement_payload
                                       FROM neftyupgrades_upgrade_specs_requirements upg_req) AS upg_req_sub ON
                       upg_req_sub.contract = upg_spec.contract AND
                       upg_req_sub.upgrade_id = upg_spec.upgrade_id AND
                       upg_req_sub.spec_index = upg_spec.spec_index
                            LEFT JOIN (SELECT upg_res.contract,
                                              upg_res.upgrade_id,
                                              upg_res.spec_index,
                                              upg_res.result_index,
                                              upg_res.attribute_name,
                                              upg_res.attribute_type,
                                              upg_res.operator_type,
                                              upg_res.value_type,
                                              upg_res.value
                                       FROM neftyupgrades_upgrade_specs_results upg_res) AS upg_res_sub ON
                       upg_res_sub.contract = upg_spec.contract AND
                       upg_res_sub.upgrade_id = upg_spec.upgrade_id AND
                       upg_res_sub.spec_index = upg_spec.spec_index
                   GROUP BY upg_spec.contract, upg_spec.upgrade_id, upg_spec.spec_index,
                            upg_spec.schema_name) as upg_spec_sub ON
    upg_spec_sub.contract = upgrade.contract AND
    upg_spec_sub.upgrade_id = upgrade.upgrade_id
GROUP BY upgrade.upgrade_id,
         upgrade.contract,
         upgrade.collection_name,
         upgrade.start_time,
         upgrade.end_time,
         upgrade.max,
         upgrade.use_count,
         upgrade.display_data,
         upgrade.created_at_time,
         upgrade.ingredients_count;
