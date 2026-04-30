import { createClient, SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function rand(s: string) {
  return `${s}-${Date.now().toString().slice(-6)}`;
}

async function createUserAsAdmin(email: string, password: string) {
  // admin.createUser is part of the admin API — use any cast to avoid TS strictness
  const adminApi: any = (svc.auth as any)?.admin;
  if (!adminApi || typeof adminApi.createUser !== "function") {
    throw new Error("Supabase admin.createUser is not available on this client");
  }
  const res = await adminApi.createUser({ email, password, email_confirm: true });
  if (res.error) throw res.error;
  // structure may vary; try to find the created user object
  const user = res.data?.user ?? res.user ?? res;
  return user;
}

async function getUserClient(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const r = await client.auth.signInWithPassword({ email, password } as any);
  if (r.error) throw r.error;
  // set session on this client so future requests use the user's JWT
  if (r.data?.session) await client.auth.setSession(r.data.session as any);
  const user = (r.data as any)?.user ?? (r.data as any)?.session?.user;
  return { client, user } as { client: SupabaseClient; user: any };
}

async function run() {
  console.log("RLS test script starting...");

  const adminEmail = process.env.TEST_ADMIN_EMAIL ?? rand("test-admin") + "@example.com";
  const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? `P@ssw0rd!${Math.floor(Math.random() * 9000) + 1000}`;

  const userEmail = process.env.TEST_USER_EMAIL ?? rand("test-user") + "@example.com";
  const userPassword = process.env.TEST_USER_PASSWORD ?? `P@ssw0rd!${Math.floor(Math.random() * 9000) + 1000}`;

  console.log("Creating admin user:", adminEmail);
  const createdAdmin = await createUserAsAdmin(adminEmail, adminPassword).catch((e) => {
    console.error("Failed to create admin user:", e);
    throw e;
  });
  console.log("Created admin (raw):", createdAdmin);

  console.log("Creating normal user:", userEmail);
  const createdUser = await createUserAsAdmin(userEmail, userPassword).catch((e) => {
    console.error("Failed to create normal user:", e);
    throw e;
  });
  console.log("Created user (raw):", createdUser);

  // Give the admin user the admin role in user_roles table
  const adminId = createdAdmin?.id ?? createdAdmin?.user?.id;
  const userId = createdUser?.id ?? createdUser?.user?.id;
  if (!adminId || !userId) {
    console.error("Could not determine created users' ids. Inspect creation responses above.");
    process.exit(2);
  }

  console.log("Upserting admin role for:", adminId);
  const up = await svc.from("user_roles").insert({ user_id: adminId, role: "admin" }).select();
  if (up.error) console.warn("Inserting admin role returned error (may already exist):", up.error.message);
  else console.log("Inserted admin role:", up.data);

  // Sign in as normal user and attempt to create task assigned to admin (should fail)
  const { client: userClient, user: signedUser } = await getUserClient(userEmail, userPassword);
  console.log("Signed in as normal user id:", signedUser?.id ?? signedUser?.sub);

  const normalInsert = await userClient.from("tasks").insert([
    {
      title: "RLS test - assign to admin (should fail for non-admin)",
      creator_id: userId,
      assignee_id: adminId,
    },
  ]);
  console.log("Normal user insert assigning to admin -> error:", normalInsert.error?.message ?? "none", "data:", normalInsert.data);

  // Insert assigned to self (should succeed)
  const selfInsert = await userClient.from("tasks").insert([
    { title: "RLS test - assign to self (should succeed)", creator_id: userId, assignee_id: userId },
  ]).select();
  console.log("Normal user insert assigning to self -> error:", selfInsert.error?.message ?? "none", "data:", selfInsert.data);

  // Sign in as admin and try assign to other user (should succeed)
  const { client: adminClient, user: signedAdmin } = await getUserClient(adminEmail, adminPassword);
  console.log("Signed in as admin id:", signedAdmin?.id ?? signedAdmin?.sub);

  const adminInsert = await adminClient.from("tasks").insert([
    { title: "RLS test - admin assigns to normal user (should succeed)", creator_id: adminId, assignee_id: userId },
  ]).select();
  console.log("Admin insert assigning to normal -> error:", adminInsert.error?.message ?? "none", "data:", adminInsert.data);

  // Profile visibility checks
  const profilesAsUser = await userClient.from("profiles").select("id,email,display_name").eq("id", adminId);
  console.log("Non-admin selecting admin profile -> rows:", profilesAsUser.data?.length ?? 0, "error:", profilesAsUser.error?.message ?? "none");

  const profilesAsAdmin = await adminClient.from("profiles").select("id,email,display_name").eq("id", adminId);
  console.log("Admin selecting admin profile -> rows:", profilesAsAdmin.data?.length ?? 0, "error:", profilesAsAdmin.error?.message ?? "none");

  // Optional cleanup
  if (process.env.CLEANUP === "1") {
    console.log("Cleaning up created users...");
    try {
      const del1 = await (svc.auth as any).admin.deleteUser(adminId);
      const del2 = await (svc.auth as any).admin.deleteUser(userId);
      console.log("Deleted users (admin result, user result):", del1, del2);
    } catch (e) {
      console.warn("Failed deleting test users:", e);
    }
  }

  console.log("RLS test script finished.");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
