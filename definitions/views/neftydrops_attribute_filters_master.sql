CREATE
OR REPLACE VIEW neftydrops_attribute_filters_master AS
SELECT DISTINCT t.contract, t.collection_name, t.schema_name, d.key, d.value
FROM
    atomicassets_templates as t,
    jsonb_each(t.immutable_data) as d
WHERE length(d.value::TEXT) <= 50 AND length(d.key) <= 50;
