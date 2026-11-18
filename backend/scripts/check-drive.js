import {google} from 'googleapis';
import {config} from '../server/config.js';
const id=process.argv[2]||config.DRIVE_FOLDER_ID;
if(!id||!/^[\w-]+$/.test(id))throw Error('Indicá el ID de carpeta');
try {
  const drive=google.drive({version:'v3',auth:new google.auth.GoogleAuth({scopes:['https://www.googleapis.com/auth/drive.readonly']})});
  let pageToken;
  do {const {data}=await drive.files.list({q:`'${id}' in parents and trashed=false`,fields:'files(id,name,mimeType),nextPageToken',pageSize:100,pageToken},{timeout:15000});console.log(JSON.stringify(data.files,null,2));pageToken=data.nextPageToken;}while(pageToken);
}catch(e){console.error('Drive:',e.response?.status||e.code||'error',(e.response?.data?.error?.errors||[]).map(x=>x.reason).join(', '));process.exitCode=1;}
