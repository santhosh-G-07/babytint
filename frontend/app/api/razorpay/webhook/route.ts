import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature");
  const body = await request.text();

  const response = await fetch(`${API_BASE}/api/payment/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "x-razorpay-signature": signature } : {}),
    },
    body,
  });

  const payload = await response.text();
  return new NextResponse(payload, { status: response.status });
}

