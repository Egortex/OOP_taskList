import type { Request, Response, NextFunction } from "express";

/** Логирует метод, URL, статус ответа и длительность каждого запроса. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
	const start = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
	});
	next();
}
