import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, {
  ssl: process.env.POSTGRES_SSL === "true" ? "require" : false, // Allow SSL config via env
});

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

export async function fetchRevenue() {
  try {
    const data = await sql<Revenue[]>`SELECT * FROM "Revenue"`;
    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT "Invoice"."amount", "Customer"."name", "Customer"."image_url", "Customer"."email", "Invoice"."id"
      FROM "Invoice"
      JOIN "Customer" ON "Invoice"."customer_id" = "Customer"."id"
      ORDER BY "Invoice"."date" DESC
      LIMIT 5;
    `;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM "Invoice"`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM "Customer"`;
    const invoiceStatusPromise = sql`
      SELECT
        SUM(CASE WHEN "Invoice"."status" = 'paid' THEN "Invoice"."amount" ELSE 0 END) AS "paid",
        SUM(CASE WHEN "Invoice"."status" = 'pending' THEN "Invoice"."amount" ELSE 0 END) AS "pending"
      FROM "Invoice"
    `;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0][0].count ?? "0");
    const numberOfCustomers = Number(data[1][0].count ?? "0");
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? "0");
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? "0");

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        "Invoice"."id",
        "Invoice"."amount",
        "Invoice"."date",
        "Invoice"."status",
        "Customer"."name",
        "Customer"."email",
        "Customer"."image_url"
      FROM "Invoice"
      JOIN "Customer" ON "Invoice"."customer_id" = "Customer"."id"
      WHERE
        "Customer"."name" ILIKE ${`%${query}%`} OR
        "Customer"."email" ILIKE ${`%${query}%`} OR
        "Invoice"."amount"::text ILIKE ${`%${query}%`} OR
        "Invoice"."date"::text ILIKE ${`%${query}%`} OR
        "Invoice"."status" ILIKE ${`%${query}%`}
      ORDER BY "Invoice"."date" DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await sql`
      SELECT COUNT(*)
      FROM "Invoice"
      JOIN "Customer" ON "Invoice"."customer_id" = "Customer"."id"
      WHERE
        "Customer"."name" ILIKE ${`%${query}%`} OR
        "Customer"."email" ILIKE ${`%${query}%`} OR
        "Invoice"."amount"::text ILIKE ${`%${query}%`} OR
        "Invoice"."date"::text ILIKE ${`%${query}%`} OR
        "Invoice"."status" ILIKE ${`%${query}%`}
    `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        "Invoice"."id",
        "Invoice"."customer_id",
        "Invoice"."amount",
        "Invoice"."status"
      FROM "Invoice"
      WHERE "Invoice"."id" = ${id};
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100, // Convert cents to dollars
    }));

    return invoice[0];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        "Customer"."id",
        "Customer"."name"
      FROM "Customer"
      ORDER BY "Customer"."name" ASC
    `;

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType[]>`
      SELECT
        "Customer"."id",
        "Customer"."name",
        "Customer"."email",
        "Customer"."image_url",
        COUNT("Invoice"."id") AS "total_invoices",
        SUM(CASE WHEN "Invoice"."status" = 'pending' THEN "Invoice"."amount" ELSE 0 END) AS "total_pending",
        SUM(CASE WHEN "Invoice"."status" = 'paid' THEN "Invoice"."amount" ELSE 0 END) AS "total_paid"
      FROM "Customer"
      LEFT JOIN "Invoice" ON "Customer"."id" = "Invoice"."customer_id"
      WHERE
        "Customer"."name" ILIKE ${`%${query}%`} OR
        "Customer"."email" ILIKE ${`%${query}%`}
      GROUP BY "Customer"."id", "Customer"."name", "Customer"."email", "Customer"."image_url"
      ORDER BY "Customer"."name" ASC
    `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
