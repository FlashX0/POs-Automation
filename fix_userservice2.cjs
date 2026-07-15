const fs = require('fs');
let content = fs.readFileSync('api/services/UserService.ts', 'utf-8');

content = content.replace(
  'authUpdateObj.password = password || "";',
  'authUpdateObj.password = password;'
);

fs.writeFileSync('api/services/UserService.ts', content);
