CREATE OR REPLACE VIEW atomicassets_collections_master AS
SELECT collection.contract,
       collection.collection_name,
       collection.data ->> 'name' "name",
       collection.data ->> 'img'  img,
       collection.author,
       collection.allow_notify,
       collection.authorized_accounts,
       collection.notify_accounts,
       collection.market_fee,
       collection.data,
       collection.created_at_time,
       collection.created_at_block,
       COALESCE(lists.lists, '[]'::json) lists,
       COALESCE(tags.tags, ARRAY[]::text[]) tags
FROM atomicassets_collections collection
LEFT JOIN LATERAL (
    SELECT JSON_AGG(
                   JSON_BUILD_OBJECT(
                           'contract', contract,
                           'list', list
                   )
           ) lists
    from helpers_collection_list
    WHERE collection_name = collection.collection_name
    ) as lists ON true
LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(tag) tags
    from helpers_collection_tags
    WHERE collection_name = collection.collection_name
    ) as tags ON true;
