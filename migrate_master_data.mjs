import fs from 'fs';
import path from 'path';

const dirs = [
  './src/pages/MasterData',
  './src/pages/Promotions'
];

function processFiles(directory) {
  if (!fs.existsSync(directory)) return;
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const fullPath = path.join(directory, file);
      let ds = fs.readFileSync(fullPath, 'utf8');

      // 1. Imports
      ds = ds.replace(/import\s+\{\s*db\s*\}\s+from\s+["']\.\.\/\.\.\/firebaseClient["'];?/g, 'import { supabase } from "../../supabaseClient";');
      ds = ds.replace(/import\s+\{\s*db\s*\}\s+from\s+["']\.\.\/firebaseClient["'];?/g, 'import { supabase } from "../supabaseClient";');
      
      // Remove firestore imports
      ds = ds.replace(/import\s+\{\s*[^}]*\s*\}\s+from\s+["']firebase\/firestore["'];?/g, '');
      
      // 2. Querying fetching (getDocs)
      // from: const itemsSnap = await getDocs(query(collection(db, COL), orderBy("itemCode", "asc")));
      // or similar
      // we'll replace the fetchRows pattern heavily used in these pages
      if (ds.includes("getDocs")) {
          ds = ds.replace(/const\s+(\w+Snap)\s*=\s*await\s+getDocs\(query\(collection\(db,\s*COL\),\s*orderBy\((["']\w+["']),\s*(["']\w+["'])\)\)\);/g, 
                          'const { data: _$1, error: _$1Err } = await supabase.from(COL).select("*").order($2, { ascending: $3 === "asc" });\n      if (_$1Err) throw _$1Err;\n      const $1 = { docs: _$1.map(d => ({ id: d.id, data: () => d })) };');
                          
          ds = ds.replace(/const\s+(\w+Snap)\s*=\s*await\s+getDocs\(collection\(db,\s*COL\)\);/g, 
                          'const { data: _$1, error: _$1Err } = await supabase.from(COL).select("*");\n      if (_$1Err) throw _$1Err;\n      const $1 = { docs: _$1.map(d => ({ id: d.id, data: () => d })) };');
      }

      // 3. Deleting doc
      // await deleteDoc(doc(db, COL, row.id));
      ds = ds.replace(/await\s+deleteDoc\(doc\(db,\s*COL,\s*([^)]+)\)\);/g, 
                      'const { error: _delErr } = await supabase.from(COL).delete().eq("id", $1);\n      if (_delErr) throw _delErr;');

      // 4. Updating doc
      // await updateDoc(doc(db, COL, editingId), { ... });
      ds = ds.replace(/await\s+updateDoc\(doc\(db,\s*COL,\s*([^)]+)\),\s*({[\s\S]*?})\);/g, (match, idStr, objStr) => {
          let cObj = objStr.replace(/updatedAt:\s*serverTimestamp\(\),?/g, 'updated_at: new Date().toISOString(),');
          return `const { error: _updErr } = await supabase.from(COL).update(${cObj}).eq("id", ${idStr});\n        if (_updErr) throw _updErr;`;
      });

      // 5. Setting doc (creation)
      // await setDoc(doc(db, COL, id), { ... }, { merge: true });
      ds = ds.replace(/await\s+setDoc\(doc\(db,\s*COL,\s*([^)]+)\),\s*({[\s\S]*?}),\s*{\s*merge:\s*true\s*}\s*\);/g, (match, idStr, objStr) => {
          let cObj = objStr.replace(/createdAt:\s*serverTimestamp\(\),?/g, 'created_at: new Date().toISOString(),');
          cObj = cObj.replace(/updatedAt:\s*serverTimestamp\(\),?/g, 'updated_at: new Date().toISOString(),');
          // Inject id into the object manually via string manipulation
          let inObj = cObj.replace(/^{/, `{ id: ${idStr},`);
          return `const { error: _insErr } = await supabase.from(COL).upsert(${inObj});\n        if (_insErr) throw _insErr;`;
      });
      
      // another variant without merge true
      ds = ds.replace(/await\s+setDoc\(doc\(db,\s*COL,\s*([^)]+)\),\s*({[\s\S]*?})\s*\);/g, (match, idStr, objStr) => {
          let cObj = objStr.replace(/createdAt:\s*serverTimestamp\(\),?/g, 'created_at: new Date().toISOString(),');
          cObj = cObj.replace(/updatedAt:\s*serverTimestamp\(\),?/g, 'updated_at: new Date().toISOString(),');
          let inObj = cObj.replace(/^{/, `{ id: ${idStr},`);
          return `const { error: _insErr } = await supabase.from(COL).upsert(${inObj});\n        if (_insErr) throw _insErr;`;
      });

      fs.writeFileSync(fullPath, ds, 'utf8');
      console.log(`Processed: ${fullPath}`);
    }
  }
}

for (const d of dirs) {
  processFiles(d);
}

console.log("Migration substitution applied.");
