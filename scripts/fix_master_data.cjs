const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src');

const filesToFix = [
  'src/pages/MasterData/MasterPromoItemPage.jsx',
  'src/pages/MasterData/ReconsButtonMappingPage.jsx',
  'src/pages/MasterData/MasterYearPage.jsx',
  'src/pages/MasterData/MasterSkuPage.jsx',
  'src/pages/MasterData/MasterReportTypePage.jsx',
  'src/pages/MasterData/MasterMapPromoItemSkuPage.jsx',
  'src/pages/Tools/Reconciliation/Data/reconsConfigPage.jsx',
  'src/pages/Tools/Reconciliation/Data/BulkReconCellsImportPage.jsx',
  'src/pages/MasterData/MasterDataHome.jsx',
  'src/pages/MasterData/MasterCountryPage.jsx',
  'src/pages/ReconciliationUploadPage.jsx',
  'src/pages/promo_auto_IC.jsx',
  'src/pages/MasterData/MasterBusinessReportTypeMapPage.jsx',
  'src/pages/MasterData/MasterBusinessPage.jsx',
  'src/components/Sidebar.jsx'
];

filesToFix.forEach(relPath => {
  const fullPath = path.join('c:/Users/Syahmi/Desktop/React Tutorial/mdmTools/frontend', relPath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');

  // 1. Fix usePermissions
  const usePermRegex = /usePermissions\(\{\s*defaultRole: "viewer",\s*roleCollection: "roles",\s*roleField: "role",\s*rolePermissionsCollection: "rolePermissions",\s*\}\)/g;
  content = content.replace(usePermRegex, 'usePermissions()');

  // 2. Fix fetchRows (approximate pattern for Master Data)
  content = content.replace(
    /async function fetchRows\(\) \{\s*try \{\s*setLoading\(true\);\s*const q = query\(collection\(db, COL\), orderBy\("([^"]+)", "([^"]+)"\)\);\s*const snap = await getDocs\(q\);\s*const data = snap.docs.map\(\(d\) => \(\{ id: d.id, \.\.\.d.data\(\) \}\)\);\s*setRows\(data\);/g,
    (match, field, dir) => {
      const asc = dir === 'asc';
      return `async function fetchRows() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(COL)
        .select("*")
        .order("${field}", { ascending: ${asc} });
      if (error) throw error;
      setRows(data || []);`;
    }
  );

  // 3. Fix setDoc (approximate pattern for Master Data)
  // This one is trickier due to metadata. Let's look for the start of the try block in onSave
  content = content.replace(
    /await setDoc\(\s*doc\(db, COL, id\),\s*\{([\s\S]+?)\},\s*\{ merge: true \}\s*\);/g,
    (match, body) => {
      // Convert body to object-ish for Supabase insert
      // Most of them follow the same pattern: code/year, name, active, createdAt, createdBy, etc.
      // We'll replace the Firestore specific metadata with JS date/Supabase style
      let newBody = body.replace(/serverTimestamp\(\)/g, 'new Date().toISOString()');
      return `const { error: insErr } = await supabase.from(COL).insert({ id, ${newBody.trim()} });
        if (insErr) throw insErr;`;
    }
  );

  // 4. Remove leftover _updErr style if it already existed but used Firestore elsewhere
  content = content.replace(/const \{ error: _updErr \} = await supabase/g, 'const { error: updErr } = await supabase');
  content = content.replace(/if \(_updErr\) throw _updErr;/g, 'if (updErr) throw updErr;');

  fs.writeFileSync(fullPath, content);
  console.log(`Fixed ${relPath}`);
});
