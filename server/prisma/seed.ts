import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed data for the TradeFlow ERP/CRM portal.
 *
 * - 4 users (one per role) with bcrypt-hashed passwords
 * - 5 customers (mixed types/statuses; one with a follow-up tomorrow)
 * - 8 products (RICE-50KG and WHEAT-50KG intentionally below their min stock)
 * - 0 challans -> the first challan created via the API will be
 *   numbered CH-YYYYMMDD-0001
 *
 * Idempotent: users/products are upserted; customers are only inserted when
 * the table is empty.
 */

async function seedUsers() {
  const users: Array<{ email: string; name: string; role: Role; password: string }> = [
    { email: "admin@erp.com", name: "Aditi Admin", role: Role.ADMIN, password: "Admin@123" },
    { email: "sales@erp.com", name: "Sagar Sales", role: Role.SALES, password: "Sales@123" },
    {
      email: "warehouse@erp.com",
      name: "Waseem Warehouse",
      role: Role.WAREHOUSE,
      password: "Warehouse@123",
    },
    {
      email: "accounts@erp.com",
      name: "Meera Accounts",
      role: Role.ACCOUNTS,
      password: "Accounts@123",
    },
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, password: hashedPassword },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword,
      },
    });
  }

  console.log(`Seeded ${users.length} users`);
}

async function seedCustomers() {
  const existingCount = await prisma.customer.count();
  if (existingCount > 0) {
    console.log(`Skipping customer seed (${existingCount} customers already exist)`);
    return;
  }

  // Follow-up scheduled for tomorrow at 10:30 local time.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 30, 0, 0);

  await prisma.customer.createMany({
    data: [
      {
        name: "Rajesh Kumar",
        mobile: "9876543210",
        businessName: "Kumar General Stores",
        type: "RETAIL",
        status: "ACTIVE",
        address: "12, Market Road",
        city: "Hyderabad",
        state: "Telangana",
        followUpDate: tomorrow,
      },
      {
        name: "Priya Sharma",
        mobile: "9812345678",
        businessName: "Priya Traders",
        type: "WHOLESALE",
        status: "ACTIVE",
        address: "45, Commercial Street",
        city: "Vijayawada",
        state: "Andhra Pradesh",
      },
      {
        name: "Anil Gupta",
        mobile: "9845671230",
        businessName: null,
        type: "RETAIL",
        status: "LEAD",
        address: null,
        city: "Warangal",
        state: "Telangana",
      },
      {
        name: "Sunita Reddy",
        mobile: "9900112233",
        businessName: "Reddy Distributors",
        type: "DISTRIBUTOR",
        status: "INACTIVE",
        address: "8, Industrial Estate",
        city: "Nizamabad",
        state: "Telangana",
      },
      {
        name: "Mohammed Irfan",
        mobile: "9765432189",
        businessName: "Irfan Super Market",
        type: "WHOLESALE",
        status: "ACTIVE",
        address: "23, Bazaar Lane",
        city: "Kurnool",
        state: "Andhra Pradesh",
      },
    ],
  });

  console.log("Seeded 5 customers");
}

async function seedProducts() {
  const products = [
    {
      sku: "RICE-50KG",
      name: "Premium Basmati Rice 50kg",
      description: "Aged long-grain basmati rice, 50 kg bag",
      unitPrice: 1450,
      currentStock: 5, // intentionally LOW (min 10)
      minStock: 10,
    },
    {
      sku: "WHEAT-50KG",
      name: "Sharbati Wheat 50kg",
      description: "Premium sharbati wheat, 50 kg bag",
      unitPrice: 1150,
      currentStock: 3, // intentionally LOW (min 15)
      minStock: 15,
    },
    {
      sku: "SUGAR-25KG",
      name: "Refined Sugar 25kg",
      description: "Sulphur-free refined sugar, 25 kg bag",
      unitPrice: 950,
      currentStock: 40,
      minStock: 10,
    },
    {
      sku: "OIL-15L",
      name: "Sunflower Oil 15L Tin",
      description: "Refined sunflower oil, 15 litre tin",
      unitPrice: 1800,
      currentStock: 25,
      minStock: 5,
    },
    {
      sku: "DAL-30KG",
      name: "Toor Dal 30kg",
      description: "Unpolished toor dal, 30 kg bag",
      unitPrice: 2400,
      currentStock: 60,
      minStock: 20,
    },
    {
      sku: "FLOUR-10KG",
      name: "Chakki Fresh Atta 10kg",
      description: "Whole wheat flour, 10 kg bag",
      unitPrice: 380,
      currentStock: 80,
      minStock: 20,
    },
    {
      sku: "SALT-25KG",
      name: "Iodised Salt 25kg",
      description: "Vacuum-evaporated iodised salt, 25 kg bag",
      unitPrice: 210,
      currentStock: 45,
      minStock: 10,
    },
    {
      sku: "TEA-5KG",
      name: "Assam CTC Tea 5kg",
      description: "Strong Assam CTC tea, 5 kg pack",
      unitPrice: 1600,
      currentStock: 30,
      minStock: 8,
    },
  ];

  for (const product of products) {
    // Upsert also restores demo stock levels when re-seeded.
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        unitPrice: product.unitPrice,
        currentStock: product.currentStock,
        minStock: product.minStock,
      },
      create: product,
    });
  }

  console.log(`Seeded ${products.length} products (RICE-50KG and WHEAT-50KG are low on stock)`);
}

async function main() {
  await seedUsers();
  await seedCustomers();
  await seedProducts();

  const [userCount, customerCount, productCount, challanCount] = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.product.count(),
    prisma.challan.count(),
  ]);

  console.log("Seed summary:", {
    users: userCount,
    customers: customerCount,
    products: productCount,
    challans: challanCount,
  });

  if (challanCount === 0) {
    console.log(
      "No challans seeded - the first challan created via the API will be numbered CH-YYYYMMDD-0001"
    );
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });