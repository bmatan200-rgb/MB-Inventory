import {existsSync} from 'node:fs';
for(const f of ['dist/index.html','dist/accounts.mjs','dist/account-access.mjs','dist/manage/index.html','dist/vendor/firebase-sdk.mjs'])if(!existsSync(f))throw Error('Missing '+f);
console.log('Prebuilt site ready: dist');
