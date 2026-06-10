import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { requestLogger } from "./middleware/logger";
import { requireAuth, DEMO_TOKEN, type AuthenticatedRequest } from "./middleware/auth";
import { pagesContent } from "./data/pages";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();

app.use(express.json());
app.use(requestLogger);

// --- API: страницы (data loaders клиентского роутера дергают эти эндпоинты) ---
/** Возвращает контент статической страницы (home/about) по её имени. */
app.get<{ name: string }>("/api/pages/:name", (req: Request<{ name: string }>, res: Response) => {
	const page = pagesContent[req.params.name];
	if (!page) {
		res.status(404).json({ error: "Page not found" });
		return;
	}
	res.json(page);
});

// --- API: авторизация (для guard-слоя роутера) ---
/** Проверяет логин/пароль (демо: admin/admin) и выдаёт токен авторизации. */
app.post("/api/login", (req: Request, res: Response) => {
	const { username, password } = req.body as { username?: string; password?: string };
	if (username === "admin" && password === "admin") {
		res.json({ token: DEMO_TOKEN, user: { id: 1, name: "Demo User" } });
		return;
	}
	res.status(401).json({ error: "Invalid credentials" });
});

/** Возвращает данные текущего пользователя по Bearer-токену (требует requireAuth). */
app.get("/api/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
	res.json({ user: req.user });
});

// --- Статика собранного клиента ---
if (existsSync(distDir)) {
	app.use(express.static(distDir));
}

// --- SPA fallback: любой не-API GET отдаёт оболочку приложения ---
/** Отдаёт index.html для всех не-API GET-запросов, чтобы клиентский роутер обработал маршрут. */
app.use((req: Request, res: Response, next) => {
	if (req.method !== "GET" || req.path.startsWith("/api")) {
		next();
		return;
	}

	const indexPath = path.join(distDir, "index.html");
	if (!existsSync(indexPath)) {
		res.status(404).send("Build the client first: npm run build");
		return;
	}
	res.sendFile(indexPath);
});

app.listen(PORT, () => {
	console.log(`API server listening on http://localhost:${PORT}`);
});
