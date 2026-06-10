import type { Request, Response, NextFunction } from "express";

export const DEMO_TOKEN = "demo-token";

export interface AuthUser {
	id: number;
	name: string;
}

export interface AuthenticatedRequest extends Request {
	user?: AuthUser;
}

const DEMO_USER: AuthUser = { id: 1, name: "Demo User" };

/** Проверяет заголовок Authorization: Bearer и подставляет req.user либо отвечает 401. */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
	const authHeader = req.header("authorization");
	if (authHeader === `Bearer ${DEMO_TOKEN}`) {
		req.user = DEMO_USER;
		next();
		return;
	}
	res.status(401).json({ error: "Unauthorized" });
}
