import 'mocha';
import {expect} from 'chai';

import {encodeDatabaseJson, encodeString} from './utils';

describe('utils', () => {
    describe('encodeDatabaseJson', () => {
        it('replaces NULL(\\u0000) characters for blank space', () => {
            expect(encodeDatabaseJson({
                a: '\u0000',
                b: 'b',
                c: 1,
            })).to.equal(JSON.stringify({
                a: ' ',
                b: 'b',
                c: 1,
            }));
        });
    });

    describe('encodeString', () => {
        it('replaces NULL(\\u0000) characters for blank space', () => {
            const val = '%w\u0002\u0000\u0000\u0000\u0000eSIG_K1_HGT5Bifx1DrxntWgHMhFfQsQxD6QHvioCKZrhAya1NmG5VLkrRyz2sR4moeAARKk2XHFqW4C8TZDaxS1byn7evyFRRSW7q\u000bNeftyBlock';
            const expected = '%w\u0002eSIG_K1_HGT5Bifx1DrxntWgHMhFfQsQxD6QHvioCKZrhAya1NmG5VLkrRyz2sR4moeAARKk2XHFqW4C8TZDaxS1byn7evyFRRSW7q\u000bNeftyBlock';
            expect(encodeString(val)).to.equal(expected);
        });
    });
});