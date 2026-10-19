const fs = require('fs');
const path = 'server/app.test.js';
let s = fs.readFileSync(path,'utf8');
// Replace any .set('Authorization', `... (possibly broken) with the correct Bearer ${staffLogin.body.token}
s = s.replace(/\.set\('Authorization', `[\s\S]*?`/g, ".set('Authorization', `Bearer ${staffLogin.body.token}`)");
fs.writeFileSync(path, s, 'utf8');
console.log('done');
