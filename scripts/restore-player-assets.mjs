// Restore original four playable-survivor GLBs from GitHub-safe text payloads.
// Each source file comes from DEADLINE_FOUR_Four_Player_3D_Models_v01.zip.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const directory='apps/client/public/models/players';
const assets={
 assault:'6b4f0e790d606f404915cff4a140b6828df70ccd299e2eb39508d487e33b4136',
 medic:'fe764c8860a6180bdd6f5d822d668052e2da9b26b60d50ae966dee16fe28ac53',
 engineer:'afeb8bfaed7daa8fc862b7e44942631c86e7685f105780355d510f8fff75b26e',
 recon:'3977fa159d05e6da563c5b2ee6d980469073b75d77e71fbcbcaff48e1006a9aa'
};
for(const [name,expected] of Object.entries(assets)){
 const encoded=fs.readFileSync(path.join(directory,name+'.glb.b64.txt'),'utf8').replace(/\s+/g,'');
 const binary=Buffer.from(encoded,'base64');
 if(binary.length<1000||binary.toString('ascii',0,4)!=='glTF'||binary.readUInt32LE(4)!==2||binary.readUInt32LE(8)!==binary.length)
   throw new Error('Invalid playable character GLB '+name);
 const sha=crypto.createHash('sha256').update(binary).digest('hex');
 if(sha!==expected)throw new Error('Playable character GLB checksum mismatch '+name);
 const jsonLength=binary.readUInt32LE(12);
 const gltf=JSON.parse(binary.toString('utf8',20,20+jsonLength));
 if((gltf.meshes?.length??0)<50)throw new Error('Incomplete character art '+name);
 fs.writeFileSync(path.join(directory,name+'.glb'),binary);
 console.log('[Survivors] verified '+name+' GLB ('+binary.length+' bytes; '+gltf.meshes.length+' meshes)');
}
