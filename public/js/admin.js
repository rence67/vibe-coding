require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseServiceRoleKey || !username || !password) {
  console.error("Error: Missing required environment variables in .env file.");
  console.error("Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, and ADMIN_PASSWORD are defined.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createAdmin() {
  try {
    const { data: existingUser, error: checkError } = await supabase
      .from("admins")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (checkError) {
      console.error("Database lookup error:", checkError.message);
      process.exit(1);
    }

    if (existingUser) {
      console.log(`User creation skipped: Admin with username "${username}" already exists.`);
      process.exit(0);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const { error: insertError } = await supabase
      .from("admins")
      .insert([{ username: username, password_hash: passwordHash }]);

    if (insertError) {
      console.error("Failed to insert admin record:", insertError.message);
      process.exit(1);
    }

    console.log(`Success: Admin user "${username}" was created successfully.`);
  } catch (err) {
    console.error("An unexpected error occurred:", err.message);
    process.exit(1);
  }
}

createAdmin();
