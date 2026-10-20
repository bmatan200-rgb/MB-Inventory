import {existsSync} from 'node:fs';
for(const f of ['dist/index.html','dist/accounts.mjs','dist/account-access.mjs','dist/manage/index.html','dist/vendor/firebase-sdk.mjs'])if(!existsSync(f))throw Error('Missing '+f);
console.log('Prebuilt site ready: dist');

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {TERMS_ID,TERMS_SHA256,TERMS_TEXT} from './dist/terms-data.mjs';
for(const f of ['dist/terms.html','dist/terms-acceptance.mjs',`dist/legal/archive/${TERMS_ID}.html`])if(!existsSync(f))throw Error('Missing '+f);
if(createHash('sha256').update(TERMS_TEXT).digest('hex')!==TERMS_SHA256)throw Error('Terms content hash mismatch');
const rules=readFileSync('firestore.rules','utf8');
if(!rules.includes(JSON.stringify(TERMS_TEXT))||!rules.includes(TERMS_SHA256))throw Error('Terms rules do not match published text');
console.log('Terms snapshot and rules match');
