import { NextResponse } from "next/server";

const DEV_USERNAME = "admin";
const DEV_PASSWORD = "Admin@12345"; // demo only

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 }
      );
    }

    if (username !== DEV_USERNAME || password !== DEV_PASSWORD) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const user = { username: DEV_USERNAME, role: "admin" } as const;
    const token = "dev-demo-token";

    return NextResponse.json({ user, token }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { message: "Unable to sign in. Please try again." },
      { status: 500 }
    );
  }
}