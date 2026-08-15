/**
 * Seed script to populate menu items
 * Run: node seedMenuItems.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const MenuItem = require('./models/MenuItem');

const menuItems = [
  // Starters
  { name: 'Paneer Tikka', code: 'MENU-001', category: 'starter', unit: 'plate', pricePerUnit: 180 },
  { name: 'Hara Bhara Kebab', code: 'MENU-002', category: 'starter', unit: 'plate', pricePerUnit: 150 },
  { name: 'Spring Roll', code: 'MENU-003', category: 'starter', unit: 'piece', pricePerUnit: 25 },
  { name: 'Samosa', code: 'MENU-004', category: 'starter', unit: 'piece', pricePerUnit: 20 },
  { name: 'Chicken Tikka', code: 'MENU-005', category: 'starter', unit: 'plate', pricePerUnit: 220 },
  { name: 'Fish Amritsari', code: 'MENU-006', category: 'starter', unit: 'plate', pricePerUnit: 250 },
  
  // Main Course
  { name: 'Butter Chicken', code: 'MENU-007', category: 'maincourse', unit: 'plate', pricePerUnit: 280 },
  { name: 'Dal Makhani', code: 'MENU-008', category: 'maincourse', unit: 'plate', pricePerUnit: 180 },
  { name: 'Paneer Butter Masala', code: 'MENU-009', category: 'maincourse', unit: 'plate', pricePerUnit: 200 },
  { name: 'Biryani (Veg)', code: 'MENU-010', category: 'maincourse', unit: 'plate', pricePerUnit: 200 },
  { name: 'Biryani (Chicken)', code: 'MENU-011', category: 'maincourse', unit: 'plate', pricePerUnit: 250 },
  { name: 'Biryani (Mutton)', code: 'MENU-012', category: 'maincourse', unit: 'plate', pricePerUnit: 300 },
  { name: 'Naan (Butter)', code: 'MENU-013', category: 'maincourse', unit: 'piece', pricePerUnit: 30 },
  { name: 'Roti', code: 'MENU-014', category: 'maincourse', unit: 'piece', pricePerUnit: 15 },
  { name: 'Jeera Rice', code: 'MENU-015', category: 'maincourse', unit: 'plate', pricePerUnit: 120 },
  { name: 'Steamed Rice', code: 'MENU-016', category: 'maincourse', unit: 'plate', pricePerUnit: 100 },
  { name: 'Kadhi Pakora', code: 'MENU-017', category: 'maincourse', unit: 'plate', pricePerUnit: 160 },
  { name: 'Mix Veg', code: 'MENU-018', category: 'maincourse', unit: 'plate', pricePerUnit: 150 },
  { name: 'Chole Masala', code: 'MENU-019', category: 'maincourse', unit: 'plate', pricePerUnit: 160 },
  { name: 'Raita', code: 'MENU-020', category: 'maincourse', unit: 'bowl', pricePerUnit: 50 },
  
  // Desserts
  { name: 'Gulab Jamun', code: 'MENU-021', category: 'dessert', unit: 'piece', pricePerUnit: 25 },
  { name: 'Rasmalai', code: 'MENU-022', category: 'dessert', unit: 'piece', pricePerUnit: 35 },
  { name: 'Ice Cream', code: 'MENU-023', category: 'dessert', unit: 'scoop', pricePerUnit: 40 },
  { name: 'Kheer', code: 'MENU-024', category: 'dessert', unit: 'bowl', pricePerUnit: 60 },
  { name: 'Jalebi', code: 'MENU-025', category: 'dessert', unit: 'plate', pricePerUnit: 50 },
  { name: 'Rasgulla', code: 'MENU-026', category: 'dessert', unit: 'piece', pricePerUnit: 25 },
  { name: 'Halwa', code: 'MENU-027', category: 'dessert', unit: 'plate', pricePerUnit: 70 },
  { name: 'Custard', code: 'MENU-028', category: 'dessert', unit: 'bowl', pricePerUnit: 50 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing menu items
    await MenuItem.deleteMany({});
    console.log('Cleared existing menu items');

    // Insert new menu items
    const created = await MenuItem.insertMany(menuItems);
    console.log(`✅ Created ${created.length} menu items`);

    // Display created items
    console.log('\n📋 Created Menu Items:');
    created.forEach(item => {
      console.log(`  - ${item.name} (${item.code}): ₹${item.pricePerUnit}/${item.unit}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();