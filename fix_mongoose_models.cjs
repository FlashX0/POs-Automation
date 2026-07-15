const fs = require('fs');
let content = fs.readFileSync('api/models/MongooseModels.ts', 'utf-8');

content = content.replace(
  'export const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);',
  'export const Project = (mongoose.models.Project || mongoose.model("Project", projectSchema)) as any;'
);

content = content.replace(
  'export const AppState = mongoose.models.AppState || mongoose.model("AppState", appStateSchema);',
  'export const AppState = (mongoose.models.AppState || mongoose.model("AppState", appStateSchema)) as any;'
);

content = content.replace(
  'export const AllowedDevice = mongoose.models.AllowedDevice || mongoose.model("AllowedDevice", allowedDeviceSchema);',
  'export const AllowedDevice = (mongoose.models.AllowedDevice || mongoose.model("AllowedDevice", allowedDeviceSchema)) as any;'
);

content = content.replace(
  'export const User = mongoose.models.User || mongoose.model("User", userSchema);',
  'export const User = (mongoose.models.User || mongoose.model("User", userSchema)) as any;'
);

content = content.replace(
  'export const AITrainingTemplate = mongoose.models.AITrainingTemplate || mongoose.model("AITrainingTemplate", aiTrainingTemplateSchema);',
  'export const AITrainingTemplate = (mongoose.models.AITrainingTemplate || mongoose.model("AITrainingTemplate", aiTrainingTemplateSchema)) as any;'
);

fs.writeFileSync('api/models/MongooseModels.ts', content);
console.log("Mongoose models fixed");
