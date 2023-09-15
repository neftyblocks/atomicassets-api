import {renderMarkdownToHtml} from '../utils';

export function formatPack(row: any, hideDescription = false, renderMarkdown = false): any {
    const data = {...row};
    data.unlock_time = String(data.unlock_time);

    try {
        data.display_data = JSON.parse(row.display_data);
        if (hideDescription) {
            delete data.display_data.description;
        }
        if (renderMarkdown && data.display_data.description) {
            data.display_data.description = renderMarkdownToHtml(data.display_data.description);
        }
    } catch (e) {
        data.display_data = {};
    }

    return data;
}
