require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

// Validate required environment variables
const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();

// Middleware configuration
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

// Helper: Generate Unique Booking Reference (BK + 6 alphanumeric chars)
function generateReference() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomStr = "";
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BK${randomStr}`;
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized access: Token missing." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized access: Invalid or expired token." });
    }
    req.admin = decoded;
    next();
  });
}

// ==========================================
// PUBLIC ROUTES
// ==========================================

// GET /api/services
app.get("/api/services", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase Error fetching services:", error);
      return res.status(500).json({ error: "Failed to fetch active services." });
    }

    return res.json(data);
  } catch (err) {
    console.error("Server Error in GET /api/services:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/bookings
app.post("/api/bookings", async (req, res) => {
  try {
    const { service_id, name, contact, email, booking_date, booking_time, guests, notes } = req.body;

    // Validate presence of required fields
    if (!service_id || !name || !contact || !email || !booking_date || !booking_time || guests === undefined) {
      return res.status(400).json({ error: "Missing required booking fields." });
    }

    // Validate guest count
    const parsedGuests = parseInt(guests, 10);
    if (isNaN(parsedGuests) || parsedGuests < 1) {
      return res.status(400).json({ error: "Guests count must be at least 1." });
    }

    // Validate booking date (no past dates)
    const todayStr = new Date().toISOString().split("T")[0];
    if (booking_date < todayStr) {
      return res.status(400).json({ error: "Booking date cannot be in the past." });
    }

    // Validate booking time (between 07:00 and 17:00 inclusive)
    if (booking_time < "07:00" || booking_time > "17:00") {
      return res.status(400).json({ error: "Booking time must be between 07:00 and 17:00." });
    }

    // Verify service exists and is active
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .eq("id", service_id)
      .eq("is_active", true)
      .single();

    if (serviceError || !service) {
      return res.status(400).json({ error: "Selected service is invalid or unavailable." });
    }

    // Generate reference and attempt insertion with collision retry handling
    let reference = generateReference();
    let inserted = false;
    let attempts = 0;

    while (!inserted && attempts < 5) {
      attempts++;
      const { data, error } = await supabase
        .from("bookings")
        .insert([
          {
            reference,
            service_id,
            name,
            contact,
            email,
            booking_date,
            booking_time,
            guests: parsedGuests,
            notes: notes || null,
            status: "pending"
          }
        ])
        .select("reference")
        .single();

      if (!error && data) {
        inserted = true;
      } else if (error && error.code === "23505") {
        // Unique constraint error on reference collision
        reference = generateReference();
      } else {
        console.error("Supabase Insert Booking Error:", error);
        return res.status(500).json({ error: "Failed to create booking." });
      }
    }

    if (!inserted) {
      return res.status(500).json({ error: "Failed to generate unique reference code. Please try again." });
    }

    return res.status(201).json({ reference });
  } catch (err) {
    console.error("Server Error in POST /api/bookings:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/bookings/:reference
app.get("/api/bookings/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name)")
      .eq("reference", reference)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const responseData = {
      ...data,
      service_name: data.services ? data.services.name : null
    };
    delete responseData.services;

    return res.json(responseData);
  } catch (err) {
    console.error("Server Error in GET /api/bookings/:reference:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ==========================================
// ADMIN AUTHENTICATION ROUTES
// ==========================================

// POST /api/admin/login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("admin_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000 // 1 day in ms
    });

    return res.json({ message: "Login successful." });
  } catch (err) {
    console.error("Server Error in POST /api/admin/login:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/admin/logout
app.post("/api/admin/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("admin_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction
  });
  return res.json({ message: "Logout successful." });
});

// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================

// GET /api/admin/bookings
app.get("/api/admin/bookings", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Error fetching admin bookings:", error);
      return res.status(500).json({ error: "Failed to fetch bookings." });
    }

    const formattedData = data.map((booking) => {
      const { services, ...rest } = booking;
      return {
        ...rest,
        service_name: services ? services.name : null
      };
    });

    return res.json(formattedData);
  } catch (err) {
    console.error("Server Error in GET /api/admin/bookings:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// PATCH /api/admin/bookings/:id/confirm
app.patch("/api/admin/bookings/:id/confirm", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Booking not found or update failed." });
    }

    return res.json(data);
  } catch (err) {
    console.error("Server Error in PATCH /api/admin/bookings/:id/confirm:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// PATCH /api/admin/bookings/:id/cancel
app.patch("/api/admin/bookings/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Booking not found or update failed." });
    }

    return res.json(data);
  } catch (err) {
    console.error("Server Error in PATCH /api/admin/bookings/:id/cancel:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// DELETE /api/admin/bookings/:id
app.delete("/api/admin/bookings/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Booking not found or delete failed." });
    }

    return res.json({ message: "Booking deleted successfully." });
  } catch (err) {
    console.error("Server Error in DELETE /api/admin/bookings/:id:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Export application for Vercel
module.exports = app;

// Local Development Server Listener
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server executing locally on http://localhost:${PORT}`);
  });
}