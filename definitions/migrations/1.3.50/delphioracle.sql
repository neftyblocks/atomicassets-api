CREATE TABLE delphioracle_prices
(
    producer         character varying(12) NOT NULL,
    contract         character varying(12) NOT NULL,
    delphi_pair_name character varying(12) NOT NULL,
    median           bigint,
    time             bigint                NOT NULL,
    block            bigint                NOT NULL
);

-- Primary key using id, producer and block
ALTER TABLE delphioracle_prices
    ADD CONSTRAINT delphioracle_prices_pkey PRIMARY KEY (producer, block);

CREATE INDEX delphioracle_prices_time_index ON delphioracle_prices (time);
CREATE INDEX delphioracle_prices_block_index ON delphioracle_prices (block);
CREATE INDEX delphioracle_prices_median_index ON delphioracle_prices (time, delphi_pair_name);
