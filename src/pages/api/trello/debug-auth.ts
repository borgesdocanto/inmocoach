import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const token = process.env.TRELLO_TOKEN;
  const key = process.env.TRELLO_API_KEY;

  // Log what we have
  console.log("🔍 DEBUG TRELLO AUTH:");
  console.log("TRELLO_TOKEN length:", token?.length || "MISSING");
  console.log("TRELLO_TOKEN first 20 chars:", token?.substring(0, 20) || "MISSING");
  console.log("TRELLO_API_KEY:", key || "MISSING");

  if (!token || !key) {
    return res.status(500).json({
      error: "Missing Trello credentials",
      hasToken: !!token,
      hasKey: !!key,
    });
  }

  // Test Trello connection
  const testUrl = new URL("https://api.trello.com/1/members/me");
  testUrl.searchParams.append("key", key);
  testUrl.searchParams.append("token", token);

  console.log("🔗 Testing URL:", testUrl.toString().substring(0, 80) + "...");

  try {
    const response = await fetch(testUrl.toString());
    const data = await response.json();

    console.log("✅ Trello response status:", response.status);
    console.log("📊 Trello response:", JSON.stringify(data).substring(0, 200));

    return res.status(200).json({
      status: response.status,
      success: response.ok,
      data: data,
      tokenLength: token.length,
      keyLength: key.length,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      token: token ? "present" : "missing",
      key: key ? "present" : "missing",
    });
  }
}
