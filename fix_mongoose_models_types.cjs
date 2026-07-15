const fs = require('fs');
let content = fs.readFileSync('api/models/MongooseModels.ts', 'utf-8');

content = content.replace(/export const Project = \(mongoose\.models\.Project \|\| mongoose\.model\("Project", projectSchema\)\) as any;/g, 'export const Project: any = mongoose.models.Project || mongoose.model("Project", projectSchema);');
content = content.replace(/export const AppState = \(mongoose\.models\.AppState \|\| mongoose\.model\("AppState", appStateSchema\)\) as any;/g, 'export const AppState: any = mongoose.models.AppState || mongoose.model("AppState", appStateSchema);');
content = content.replace(/export const AllowedDevice = \(mongoose\.models\.AllowedDevice \|\| mongoose\.model\("AllowedDevice", allowedDeviceSchema\)\) as any;/g, 'export const AllowedDevice: any = mongoose.models.AllowedDevice || mongoose.model("AllowedDevice", allowedDeviceSchema);');
content = content.replace(/export const User = \(mongoose\.models\.User \|\| mongoose\.model\("User", userSchema\)\) as any;/g, 'export const User: any = mongoose.models.User || mongoose.model("User", userSchema);');
content = content.replace(/export const AITrainingTemplate = \(mongoose\.models\.AITrainingTemplate \|\| mongoose\.model\("AITrainingTemplate", aiTrainingTemplateSchema\)\) as any;/g, 'export const AITrainingTemplate: any = mongoose.models.AITrainingTemplate || mongoose.model("AITrainingTemplate", aiTrainingTemplateSchema);');

fs.writeFileSync('api/models/MongooseModels.ts', content);
console.log("Fixed Mongoose models types");
