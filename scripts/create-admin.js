const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey || !adminUsername || !adminPassword) {
  console.error("Error: Missing required environment variables in .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
  try {
    console.log("Hashing administrator password...");
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    console.log("Inserting admin into Supabase database...");
    const { data, error } = await supabase
      .from("admins")
      .insert([{ username: adminUsername, password_hash: passwordHash }])
      .select();

    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate key")) {
        console.error(`Error: Admin username "${adminUsername}" already exists in the database.`);
        process.exit(1);
      }
      throw error;
    }

    console.log(`Success! Admin account created successfully for username: "${adminUsername}"`);
  } catch (err) {
    console.error("Unexpected error creating admin:", err.message || err);
    process.exit(1);
  }
}

createAdmin();
