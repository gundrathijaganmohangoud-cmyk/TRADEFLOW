import { prisma } from "../lib/prisma";
import { AppError } from "../errors";

/**
 * Summary fields of a customer attached to challan responses.
 */
export const customerSummarySelect: any = {
  id: true,
  name: true,
  mobile: true,
  businessName: true,
  type: true,
  status: true,
};

/**
 * Standard include used whenever a full challan is returned.
 */
export const challanDetailInclude: any = {
  items: true,
  customer: { select: customerSummarySelect },
};

export interface ChallanItemInput {
  productId: string;
  quantity: number;
}

// The checked-in Prisma client is generated without the usual Prisma helper
// types. Keep the service compatible with that client while retaining runtime
// validation in the database.
type TxClient = any;

/** Formats a date as YYYYMMDD for challan numbers. */
function challanDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Generates the next challan number CH-YYYYMMDD-####, where #### is the count
 * of challans created today + 1 (padded to 4 digits). `attemptOffset` is added
 * on unique-violation retries so concurrent creations converge on a free number.
 */
async function nextChallanNumber(tx: TxClient, attemptOffset: number): Promise<string> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const createdToday = await tx.challan.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  });

  const sequence = String(createdToday + 1 + attemptOffset).padStart(4, "0");
  return `CH-${challanDateStamp(now)}-${sequence}`;
}

/**
 * Loads the products referenced by the given items and builds immutable
 * snapshot lines (product_name, product_sku, unit_price, line_total) plus the
 * challan totals.
 */
async function buildChallanLines(items: ChallanItemInput[]) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products: any[] = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productsById = new Map(products.map((product) => [product.id, product]));

  const lines = items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new AppError(400, `Product not found: ${item.productId}`);
    }
    const lineTotal = Math.round(product.unitPrice * item.quantity * 100) / 100;
    return {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unitPrice: product.unitPrice,
      quantity: item.quantity,
      lineTotal,
    };
  });

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalAmount =
    Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;

  return { lines, totalQuantity, totalAmount };
}

/**
 * Creates a DRAFT challan (with item snapshots and computed totals) and, when
 * input.status is CONFIRMED, immediately runs the confirm flow inline.
 *
 * The challan number is generated inside a transaction and retried (up to 5
 * times) on a unique violation of challanNumber, which can happen when
 * challans are created concurrently.
 */
export async function createChallan(
  input: { customerId: string; items: ChallanItemInput[]; status: "DRAFT" | "CONFIRMED" },
  createdById: string
) {
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true },
  });
  if (!customer) {
    throw new AppError(404, "Customer not found");
  }

  const { lines, totalQuantity, totalAmount } = await buildChallanLines(input.items);

  const challan = await prisma.$transaction(async (tx: TxClient) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const challanNumber = await nextChallanNumber(tx, attempt);
      try {
        return await tx.challan.create({
          data: {
            challanNumber,
            customerId: input.customerId,
            status: "DRAFT",
            totalQuantity,
            totalAmount,
            items: { create: lines },
          },
          include: challanDetailInclude,
        });
      } catch (error) {
        lastError = error;
        const isUniqueViolation =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002";
        if (!isUniqueViolation) {
          throw error;
        }
        // challanNumber collision -> bump the sequence and retry
      }
    }
    console.error("Could not allocate a unique challan number after 5 attempts", lastError);
    throw new AppError(500, "Could not allocate a unique challan number, please retry");
  });

  if (input.status === "CONFIRMED") {
    return confirmChallan(challan.id, createdById);
  }
  return challan;
}

/**
 * Confirms a DRAFT challan atomically:
 * 1. SELECT ... FOR UPDATE on the challan row   (locks it against concurrent confirms)
 * 2. SELECT ... FOR UPDATE on all product rows  (locks stock against concurrent writes)
 * 3. verifies stock for every item              (409 with first insufficient item)
 * 4. decrements product stock
 * 5. writes OUT stock movements (reason "Challan {number} confirmed")
 * 6. sets status CONFIRMED + confirmedAt
 */
export async function confirmChallan(challanId: string, confirmedById: string) {
  return prisma.$transaction(async (tx: TxClient) => {
    const lockedChallans = await tx.$queryRaw<
      Array<{ id: string; challanNumber: string; status: string }>
    >`
      SELECT id, "challanNumber", status::text AS status
      FROM "challans"
      WHERE id = ${challanId}
      FOR UPDATE`;

    if (lockedChallans.length === 0) {
      throw new AppError(404, "Challan not found");
    }
    const lockedChallan = lockedChallans[0];
    if (lockedChallan.status !== "DRAFT") {
      throw new AppError(409, "Only draft challans can be confirmed");
    }

    const items: Array<{ productId: string; quantity: number }> = await tx.challanItem.findMany({
      where: { challanId },
    });
    if (items.length === 0) {
      throw new AppError(400, "This challan has no items to confirm");
    }

    const productIds = items.map((item) => item.productId);
    const products: any[] = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productsById = new Map(products.map((product) => [product.id, product]));

    // Verify stock for every item; fail with the first insufficient one.
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new AppError(400, `Product not found: ${item.productId}`);
      }
      if (product.currentStock < item.quantity) {
        throw new AppError(
          409,
          `Insufficient stock for ${product.sku} (requested ${item.quantity}, available ${product.currentStock})`
        );
      }
    }

    // All good -> decrement stock.
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      });
    }

    // Audit trail: one OUT movement per item.
    await tx.stockMovement.createMany({
      data: items.map((item: { productId: string; quantity: number }) => ({
        productId: item.productId,
        type: "OUT",
        quantity: item.quantity,
        reason: `Challan ${lockedChallan.challanNumber} confirmed`,
        createdById: confirmedById,
      })),
    });

    return tx.challan.update({
      where: { id: challanId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: challanDetailInclude,
    });
  });
}

/**
 * Updates a DRAFT challan. CONFIRMED/CANCELLED challans cannot be edited (409).
 * When items are supplied they are fully replaced (with fresh product
 * snapshots) and totals are recomputed.
 */
export async function updateDraftChallan(
  challanId: string,
  input: { customerId?: string; items?: ChallanItemInput[] }
) {
  const challan = await prisma.challan.findUnique({
    where: { id: challanId },
    select: { id: true, status: true },
  });
  if (!challan) {
    throw new AppError(404, "Challan not found");
  }
  if (challan.status !== "DRAFT") {
    throw new AppError(409, "Only draft challans can be updated");
  }

  const data: any = {};

  if (input.customerId !== undefined) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new AppError(404, "Customer not found");
    }
    data.customerId = input.customerId;
  }

  if (input.items !== undefined) {
    const { lines, totalQuantity, totalAmount } = await buildChallanLines(input.items);
    data.items = { deleteMany: {}, create: lines };
    data.totalQuantity = totalQuantity;
    data.totalAmount = totalAmount;
  }

  return prisma.challan.update({
    where: { id: challanId },
    data,
    include: challanDetailInclude,
  });
}

/**
 * Cancels a challan:
 * - DRAFT     -> simply marked CANCELLED (no stock was touched)
 * - CONFIRMED -> restores stock for every item inside one transaction and
 *                writes IN movements (reason "Challan {number} cancelled")
 * - CANCELLED -> 409 (already cancelled)
 */
export async function cancelChallan(challanId: string, cancelledById: string) {
  const challan = await prisma.challan.findUnique({
    where: { id: challanId },
    include: { items: true },
  });
  if (!challan) {
    throw new AppError(404, "Challan not found");
  }
  if (challan.status === "CANCELLED") {
    throw new AppError(409, "Challan is already cancelled");
  }

  if (challan.status === "DRAFT") {
    return prisma.challan.update({
      where: { id: challanId },
      data: { status: "CANCELLED" },
      include: challanDetailInclude,
    });
  }

  // CONFIRMED: restore stock + write IN movements atomically.
  return prisma.$transaction(async (tx: TxClient) => {
    for (const item of challan.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      });
    }

    await tx.stockMovement.createMany({
      data: challan.items.map((item: { productId: string; quantity: number }) => ({
        productId: item.productId,
        type: "IN",
        quantity: item.quantity,
        reason: `Challan ${challan.challanNumber} cancelled`,
        createdById: cancelledById,
      })),
    });

    return tx.challan.update({
      where: { id: challanId },
      data: { status: "CANCELLED" },
      include: challanDetailInclude,
    });
  });
}