CREATE MATERIALIZED VIEW IF NOT EXISTS neftydrops_stats AS
    SELECT * FROM neftydrops_stats_master;

CREATE UNIQUE INDEX neftydrops_stats_master_pkey ON neftydrops_stats (drops_contract, listing_type, listing_id);

CREATE INDEX neftydrops_stats_collection_name ON neftydrops_stats USING btree (collection_name);
CREATE INDEX neftydrops_stats_buyer ON neftydrops_stats USING btree (buyer);
CREATE INDEX neftydrops_stats_seller ON neftydrops_stats USING btree (seller);
CREATE INDEX neftydrops_stats_price ON neftydrops_stats USING btree (price);
CREATE INDEX neftydrops_stats_time ON neftydrops_stats USING btree ("time");
CREATE INDEX neftydrops_stats_drop_id ON neftydrops_stats USING btree (drop_id);
CREATE INDEX neftydrops_stats_drop_id_symbol ON neftydrops_stats (drop_id, symbol);
