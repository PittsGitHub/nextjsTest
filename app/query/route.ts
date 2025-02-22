import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!, {
  ssl: process.env.POSTGRES_SSL === "true" ? "require" : false, // Allow SSL config via env
});

async function listInvoices() {
  const data = await sql`
    SELECT invoices.amount, customers.name
    FROM "Invoice" AS invoices
    JOIN "Customer" AS customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

  return data;
}

export async function GET() {
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unknown error occurred" },
      { status: 500 }
    );
  }
}
