import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_ANON_KEY; // This contains the service_role key in this setup

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const toAliasEmail = (u) => `${u.trim().toLowerCase()}@yourapp.local`;

async function syncUsers() {
  console.log("Starting Auth Sync...");

  // 1. Fetch all profiles
  const { data: profiles, error: profError } = await supabase.from('profiles').select('*');
  if (profError) throw profError;

  console.log(`Found ${profiles.length} profiles to sync.`);

  for (const profile of profiles) {
    const oldUid = profile.id;
    const username = profile.username;
    const email = profile.email || toAliasEmail(username);

    console.log(`Processing user: ${username} (${email})`);

    try {
      // 2. Create or find Auth user
      // We search by email first
      const { data: listUsers, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw listError;

      let authUser = listUsers.users.find(u => u.email === email);

      if (!authUser) {
        console.log(`  Creating new Auth account for ${email}...`);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: 'Password123!',
          email_confirm: true,
          user_metadata: { username: username }
        });
        if (createError) throw createError;
        authUser = newUser.user;
      } else {
        console.log(`  Auth account already exists for ${email}.`);
      }

      const newUid = authUser.id;

      if (oldUid === newUid) {
        console.log(`  UID already synced for ${username}.`);
        continue;
      }

      console.log(`  Syncing ${oldUid} -> ${newUid}...`);

      // 3. Update related tables
      // We need to handle this carefully because 'id' is often a primary key.
      // We'll update the records by creating new ones and deleting old ones, 
      // or if it's just a reference, we update it.

      // Profiles: Replace ID
      const { error: profUpdateError } = await supabase.from('profiles').insert({
        ...profile,
        id: newUid
      });
      if (profUpdateError && profUpdateError.code !== '23505') throw profUpdateError; // 23505 is unique violation (already exists)

      // User Roles
      const { data: userRole } = await supabase.from('user_roles').select('*').eq('id', oldUid).maybeSingle();
      if (userRole) {
        await supabase.from('user_roles').upsert({ ...userRole, id: newUid });
        await supabase.from('user_roles').delete().eq('id', oldUid);
      }

      // Licenses
      const { data: license } = await supabase.from('licenses').select('*').eq('id', oldUid).maybeSingle();
      if (license) {
        await supabase.from('licenses').upsert({ ...license, id: newUid });
        await supabase.from('licenses').delete().eq('id', oldUid);
      }

      // Email Tasks (references)
      // pic_assign might be an object {uid, name} or a string
      // We need to update all tasks assigned to the old UID
      const { data: tasks } = await supabase.from('email_tasks').select('*');
      for (const task of tasks) {
        let changed = false;
        let picAssign = task.pic_assign;
        
        if (picAssign && typeof picAssign === 'object' && picAssign.uid === oldUid) {
          picAssign.uid = newUid;
          changed = true;
        }

        if (task.pic_create && typeof task.pic_create === 'object' && task.pic_create.uid === oldUid) {
          task.pic_create.uid = newUid;
          changed = true;
        }

        if (task.pic_update && typeof task.pic_update === 'object' && task.pic_update.uid === oldUid) {
          task.pic_update.uid = newUid;
          changed = true;
        }

        if (changed) {
          await supabase.from('email_tasks').update({
            pic_assign: picAssign,
            pic_create: task.pic_create,
            pic_update: task.pic_update
          }).eq('id', task.id);
        }
      }

      // Finally delete old profile
      if (oldUid !== newUid) {
        await supabase.from('profiles').delete().eq('id', oldUid);
      }

      console.log(`  Successfully synced ${username}.`);

    } catch (err) {
      console.error(`  Error syncing ${username}:`, err);
    }
  }

  console.log("Auth Sync completed.");
}

syncUsers().catch(console.error);
