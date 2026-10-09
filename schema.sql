-- Clean up existing tables if re-running
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS admins;

-- 1. Services Table
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- 2. Bookings Table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference VARCHAR(20) UNIQUE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  guests INT DEFAULT 1 NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Admins Table
CREATE TABLE admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed Data: 5 Services themed around Computer Repair
INSERT INTO services (name, description, price, is_active)
VALUES
  (
    'PC & Laptop Diagnostics',
    'Comprehensive hardware and software check to detect errors, blue screens, and performance bottlenecks.',
    250.00,
    true
  ),
  (
    'Deep Dust Cleaning & Thermal Paste Re-apply',
    'Full internal dust clearing with compressed air and fresh application of high-grade thermal compound for CPU/GPU cooling.',
    450.00,
    true
  ),
  (
    'OS Reinstallation & Driver Setup',
    'Clean installation of Windows or Linux, complete with driver updates, essentials, and initial security setup.',
    500.00,
    true
  ),
  (
    'RAM / Storage Upgrade & Installation',
    'Installation of new SSD or RAM modules including drive cloning, partition configuration, and hardware testing.',
    350.00,
    true
  ),
  (
    'Virus & Malware Removal',
    'Thorough cleanup of spyware, rootkits, adware, and trojans, plus security optimization to protect system integrity.',
    400.00,
    true
  );