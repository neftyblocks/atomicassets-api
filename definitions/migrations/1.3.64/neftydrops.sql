CREATE TABLE IF NOT EXISTS neftydrops_drops_alternative_prices
(
    drops_contract  character varying(12) NOT NULL,
    assets_contract character varying(12) NOT NULL,
    drop_id         bigint                NOT NULL,
    price_index     integer               NOT NULL,
    price           bigint                NOT NULL,
    symbol          character varying(12) NOT NULL,

    CONSTRAINT neftydrops_drops_alternative_prices_pkey PRIMARY KEY (drops_contract, drop_id, price_index)
);

ALTER TABLE ONLY neftydrops_drops_alternative_prices
    ADD CONSTRAINT neftydrops_drops_alternative_prices.drop_fkey FOREIGN KEY (drop_id, drops_contract) REFERENCES neftydrops_drops (drop_id, drops_contract) MATCH SIMPLE ON
        UPDATE RESTRICT
        ON
            DELETE
            RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;

CREATE
    INDEX IF NOT EXISTS neftydrops_drops_alternate_prices_price ON neftydrops_drops_alternative_prices USING btree (price);
CREATE
    INDEX IF NOT EXISTS neftydrops_drops_alternate_prices_symbol ON neftydrops_drops_alternative_prices USING btree (symbol);
