const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

// The block ends around 676.
// Let's replace `await fetchAndSyncDbFromMongo();` and `await UserService.seedAllRequiredUsers();` with try-catch blocks.

const oldStr = `  await fetchAndSyncDbFromMongo();

  // 5. Seed Users with Email/Password and Role (admin/user)
  await UserService.seedAllRequiredUsers();

  try {
    const db = getDb();`;

const newStr = `  try {
    await fetchAndSyncDbFromMongo();
  } catch (err) {
    console.error("Error in fetchAndSyncDbFromMongo:", err);
  }

  // 5. Seed Users with Email/Password and Role (admin/user)
  try {
    await UserService.seedAllRequiredUsers();
  } catch (err) {
    console.error("Error in seedAllRequiredUsers:", err);
  }

  try {
    const db = getDb();`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find the target string!");
}
fs.writeFileSync('api/app.ts', content);
