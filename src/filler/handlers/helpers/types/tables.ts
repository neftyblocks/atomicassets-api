export type FeaturesTableRow = {
    list: string,
    collections: string[]
};

export type AccListTableRow = {
    list_name: string,
    list: string[]
};

export type ColThemeData = {
    collection: string,
    theme?: string,
    tags?: string[],
};

export type PreferencesData = {
    key: string,
    value: string,
    values?: string[],
};
