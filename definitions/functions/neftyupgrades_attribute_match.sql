CREATE OR REPLACE FUNCTION is_upgrade_ingredient_attribute_match(
    IN _template_id bigint,
    IN _upgrade_id bigint,
    IN _ingredient_index bigint,
    IN _ingredient_total_attributes integer
)
    RETURNS bool
    LANGUAGE plpgsql
AS
$$
DECLARE
    _matched_attributes integer;
BEGIN
    SELECT count(1) INTO _matched_attributes
    FROM neftyupgrades_upgrade_ingredient_attributes attribute
             JOIN atomicassets_templates template
                  ON template.template_id = _template_id
                      AND template.transferable IS DISTINCT FROM FALSE
                      AND template.burnable IS DISTINCT FROM FALSE
    WHERE attribute.upgrade_id = _upgrade_id
      AND attribute.ingredient_index = _ingredient_index
      AND template.immutable_data->>attribute.attribute_name IS NOT NULL
      AND template.immutable_data->>attribute.attribute_name = ANY(attribute.allowed_values);

    RETURN COALESCE(_matched_attributes, 0) >= _ingredient_total_attributes;
END;
$$;
