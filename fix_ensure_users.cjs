const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

content = content.replace('const usersChanged = ensureLocalUsersSeeded(memoryDb);', 'const usersChanged = false;');
content = content.replace('const usersChanged = ensureLocalUsersSeeded(parsed);', 'const usersChanged = false;');
content = content.replace('ensureLocalUsersSeeded(fallback);', '// ensureLocalUsersSeeded(fallback);');

fs.writeFileSync('api/app.ts', content);
console.log("ensureLocalUsersSeeded removed");
