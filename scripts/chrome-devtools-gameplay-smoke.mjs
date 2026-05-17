#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DEFAULT_BASE_URL = "https://localhost:8443";
const DEFAULT_SAMPLE_DURATION_MS = 2400;
const DEFAULT_SAMPLE_INTERVAL_MS = 80;
const DEFAULT_WAIT_TIMEOUT_MS = 30000;

const args = new Map(
	process.argv.slice(2).map((entry) => {
		const [key, value = ""] = entry.split("=");
		return [key, value];
	})
);

const rawBaseUrl =
	args.get("--base-url") ||
	process.env.GAMEPLAY_TEST_BASE_URL ||
	DEFAULT_BASE_URL;
const baseUrl = new URL(rawBaseUrl).origin;
const baseHostname = new URL(baseUrl).hostname;
const cookieBootstrapEnabled =
	baseHostname === "localhost" || baseHostname === "127.0.0.1";
const extraRequestHeaders = baseHostname.includes("ngrok")
	? { "ngrok-skip-browser-warning": "1" }
	: null;
const sampleDurationMs = Number(
	args.get("--duration-ms") ||
	process.env.GAMEPLAY_TEST_DURATION_MS ||
	DEFAULT_SAMPLE_DURATION_MS
);
const sampleIntervalMs = Number(
	process.env.GAMEPLAY_TEST_SAMPLE_INTERVAL_MS || DEFAULT_SAMPLE_INTERVAL_MS
);

const thresholds = {
	minAverageFps: Number(process.env.GAMEPLAY_TEST_MIN_AVG_FPS || 40),
	maxWorstFrameMs: Number(process.env.GAMEPLAY_TEST_MAX_WORST_FRAME_MS || 90),
	maxLongFrames: Number(process.env.GAMEPLAY_TEST_MAX_LONG_FRAMES || 10),
	minHashChanges: Number(process.env.GAMEPLAY_TEST_MIN_HASH_CHANGES || 6),
	minUniqueHashes: Number(process.env.GAMEPLAY_TEST_MIN_UNIQUE_HASHES || 4),
	maxInputResponseMs: Number(process.env.GAMEPLAY_TEST_MAX_INPUT_RESPONSE_MS || 260),
};

const keyDescriptors = {
	s: { key: "s", code: "KeyS", windowsVirtualKeyCode: 83, nativeVirtualKeyCode: 83, text: "s" },
	ArrowDown: {
		key: "ArrowDown",
		code: "ArrowDown",
		windowsVirtualKeyCode: 40,
		nativeVirtualKeyCode: 40,
	},
};

const PAGE_HELPERS_SCRIPT = String.raw`
(() => {
	if (window.__cdpGameTest) return;

	const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

	const isVisible = (element) => {
		if (!element || !(element instanceof Element)) return false;
		const style = window.getComputedStyle(element);
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
			return false;
		}
		const rect = element.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	};

	const clickables = () =>
		Array.from(
			document.querySelectorAll(
				'button, [role="button"], a, input[type="button"], input[type="submit"]'
			)
		).filter(isVisible);

	const textMatches = (element, candidates) => {
		const text = normalize(element.textContent || element.value || "");
		if (!text) return false;
		return candidates.some((candidate) => {
			const target = normalize(candidate);
			return text === target || text.includes(target);
		});
	};

	const findButton = (candidates) => {
		const elements = clickables();
		const exactMatch = elements.find((element) =>
			candidates.some((candidate) => normalize(element.textContent || element.value || "") === normalize(candidate))
		);
		if (exactMatch) return exactMatch;
		return elements.find((element) => textMatches(element, candidates)) || null;
	};

	const editableInputs = () =>
		Array.from(document.querySelectorAll("input, textarea")).filter((element) => {
			if (!isVisible(element)) return false;
			if (element instanceof HTMLInputElement && ["hidden", "button", "submit", "checkbox", "radio"].includes(element.type)) {
				return false;
			}
			return !element.readOnly && !element.disabled;
		});

	const readonlyInputs = () =>
		Array.from(document.querySelectorAll("input")).filter(
			(element) => isVisible(element) && element.readOnly && !element.disabled
		);

	const setFieldValue = (element, value) => {
		const prototype = Object.getPrototypeOf(element);
		const descriptor =
			Object.getOwnPropertyDescriptor(prototype, "value") ||
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") ||
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
		if (descriptor && typeof descriptor.set === "function") {
			descriptor.set.call(element, value);
		} else {
			element.value = value;
		}
		element.focus();
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
	};

	const submitInput = (element) => {
		element.focus();
		for (const type of ["keydown", "keypress", "keyup"]) {
			element.dispatchEvent(
				new KeyboardEvent(type, {
					key: "Enter",
					code: "Enter",
					bubbles: true,
					cancelable: true,
				})
			);
		}
	};

	const hashBytes = (bytes) => {
		let hash = 2166136261 >>> 0;
		for (let index = 0; index < bytes.length; index += 1) {
			hash ^= bytes[index];
			hash = Math.imul(hash, 16777619);
		}
		return hash >>> 0;
	};

	const drawCanvasSlice = (canvas, side) => {
		const width = canvas.width;
		const height = canvas.height;
		if (!width || !height) return null;

		const offscreen = document.createElement("canvas");
		offscreen.width = side ? 12 : 24;
		offscreen.height = 24;
		const context = offscreen.getContext("2d", { willReadFrequently: true });
		if (!context) return null;

		if (side === "left") {
			context.drawImage(canvas, 0, 0, Math.max(24, width * 0.12), height, 0, 0, offscreen.width, offscreen.height);
		} else if (side === "right") {
			const cropWidth = Math.max(24, width * 0.12);
			context.drawImage(
				canvas,
				Math.max(0, width - cropWidth),
				0,
				cropWidth,
				height,
				0,
				0,
				offscreen.width,
				offscreen.height
			);
		} else {
			context.drawImage(canvas, 0, 0, width, height, 0, 0, offscreen.width, offscreen.height);
		}

		return hashBytes(context.getImageData(0, 0, offscreen.width, offscreen.height).data);
	};

	window.__cdpGameTest = {
		getPath() {
			return window.location.pathname + window.location.search;
		},
		hasHelper() {
			return true;
		},
		getVisibleText(candidates) {
			const button = findButton(candidates);
			return button ? normalize(button.textContent || button.value || "") : null;
		},
		getButtonState(candidates) {
			const button = findButton(candidates);
			if (!button) {
				return { exists: false, disabled: true, text: null };
			}
			return {
				exists: true,
				disabled:
					button.hasAttribute("disabled") ||
					button.getAttribute("aria-disabled") === "true",
				text: normalize(button.textContent || button.value || ""),
			};
		},
		clickByText(candidates) {
			const button = findButton(candidates);
			if (!button) return { clicked: false, text: null };
			button.click();
			return { clicked: true, text: normalize(button.textContent || button.value || "") };
		},
		hasText(needle) {
			return normalize(document.body.innerText || "").includes(normalize(needle));
		},
		fillFirstEditableInput(value) {
			const input = editableInputs()[0];
			if (!input) return false;
			setFieldValue(input, value);
			return true;
		},
		fillEditableInputByIndex(index, value) {
			const input = editableInputs()[index];
			if (!input) return false;
			setFieldValue(input, value);
			return true;
		},
		fillInputByPlaceholder(placeholderNeedle, value) {
			const input = editableInputs().find((element) =>
				normalize(element.getAttribute("placeholder") || "").includes(normalize(placeholderNeedle))
			);
			if (!input) return false;
			setFieldValue(input, value);
			return true;
		},
		clickButtonAdjacentToFirstEditableInput() {
			const input = editableInputs()[0];
			if (!input) return false;

			const containers = [input.parentElement, input.parentElement?.parentElement].filter(Boolean);
			for (const container of containers) {
				const buttons = Array.from(
					container.querySelectorAll(
						'button, [role="button"], input[type="button"], input[type="submit"]'
					)
				).filter((element) => isVisible(element) && element !== input);
				const button = buttons.find(
					(element) =>
						!element.hasAttribute("disabled") &&
						element.getAttribute("aria-disabled") !== "true"
				);
				if (button) {
					button.click();
					return true;
				}
			}

			return false;
		},
		submitFirstEditableInput() {
			const input = editableInputs()[0];
			if (!input) return false;
			submitInput(input);
			return true;
		},
		getReadonlyInputValue() {
			const input = readonlyInputs()[0];
			return input ? input.value : null;
		},
		getCanvasState() {
			const canvas = document.querySelector("canvas");
			if (!(canvas instanceof HTMLCanvasElement)) {
				return null;
			}
			return {
				full: drawCanvasSlice(canvas, null),
				left: drawCanvasSlice(canvas, "left"),
				right: drawCanvasSlice(canvas, "right"),
				width: canvas.width,
				height: canvas.height,
			};
		},
		async collectCanvasMetrics(durationMs, sampleIntervalMs) {
			const canvas = document.querySelector("canvas");
			if (!(canvas instanceof HTMLCanvasElement)) {
				return { error: "Canvas not found" };
			}

			const frameDeltas = [];
			const sampleHashes = [];
			let hashChanges = 0;
			let longFrames = 0;
			let previousFrame = performance.now();
			let previousHash = drawCanvasSlice(canvas, null);
			let lastSampleAt = previousFrame;
			let frames = 0;

			return new Promise((resolve) => {
				const startedAt = performance.now();

				const tick = (now) => {
					const delta = now - previousFrame;
					previousFrame = now;
					frames += 1;
					frameDeltas.push(delta);
					if (delta > 40) {
						longFrames += 1;
					}

					if (now - lastSampleAt >= sampleIntervalMs) {
						const nextHash = drawCanvasSlice(canvas, null);
						if (nextHash !== null) {
							if (previousHash !== null && previousHash !== nextHash) {
								hashChanges += 1;
							}
							previousHash = nextHash;
							sampleHashes.push(nextHash);
						}
						lastSampleAt = now;
					}

					if (now - startedAt >= durationMs) {
						const relevantDeltas = frameDeltas.slice(1);
						const averageDelta =
							relevantDeltas.reduce((sum, value) => sum + value, 0) /
							Math.max(relevantDeltas.length, 1);
						resolve({
							frames,
							averageDeltaMs: Number(averageDelta.toFixed(2)),
							averageFps: Number((1000 / Math.max(averageDelta, 0.001)).toFixed(2)),
							worstFrameMs: Number(Math.max(...relevantDeltas, 0).toFixed(2)),
							longFrames,
							hashChanges,
							uniqueHashes: new Set(sampleHashes).size,
						});
						return;
					}

					requestAnimationFrame(tick);
				};

				requestAnimationFrame(tick);
			});
		},
	};
})();
`;

async function findFreePort() {
	const server = await import("node:net").then(({ createServer }) => createServer());
	const port = await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			resolve(address && typeof address === "object" ? address.port : 0);
		});
	});
	server.close();
	return port;
}

async function fetchJson(url, options = {}) {
	const response = await fetch(url, {
		headers: {
			"content-type": "application/json",
			...(options.headers || {}),
		},
		...options,
	});
	const bodyText = await response.text();
	let body = null;
	if (bodyText) {
		try {
			body = JSON.parse(bodyText);
		} catch {
			body = bodyText;
		}
	}
	return { response, body };
}

async function createUser(label) {
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const email = `gameplay-${label}-${suffix}@example.com`;
	const password = `Pass!${Math.random().toString(36).slice(2, 12)}A9`;
	const fullName = `Gameplay ${label}`;

	const signup = await fetchJson(`${baseUrl}/api/auth/signup`, {
		method: "POST",
		body: JSON.stringify({ email, password, fullName }),
	});
	if (!signup.response.ok) {
		throw new Error(
			`Signup failed for ${email}: ${signup.response.status} ${JSON.stringify(signup.body)}`
		);
	}

	const login = await fetchJson(`${baseUrl}/api/auth/login`, {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
	if (login.response.status !== 200) {
		throw new Error(
			`Login failed for ${email}: ${login.response.status} ${JSON.stringify(login.body)}`
		);
	}

	const tokenCookie = login.response.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith("token="));
	if (!tokenCookie) {
		throw new Error(`Login did not return token cookie for ${email}`);
	}

	const token = tokenCookie.split(";")[0].slice("token=".length);
	return { email, password, token };
}

function createDeferred() {
	let resolve;
	let reject;
	const promise = new Promise((innerResolve, innerReject) => {
		resolve = innerResolve;
		reject = innerReject;
	});
	return { promise, resolve, reject };
}

class CdpClient {
	constructor(wsUrl) {
		this.wsUrl = wsUrl;
		this.ws = null;
		this.nextId = 1;
		this.pending = new Map();
		this.listeners = new Set();
	}

	async connect() {
		this.ws = new WebSocket(this.wsUrl);
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error(`Timed out connecting to ${this.wsUrl}`));
			}, DEFAULT_WAIT_TIMEOUT_MS);
			this.ws.addEventListener("open", () => {
				clearTimeout(timer);
				resolve();
			});
			this.ws.addEventListener("error", (event) => {
				clearTimeout(timer);
				reject(new Error(`WebSocket error while connecting to ${this.wsUrl}: ${event.message || "unknown error"}`));
			});
		});

		this.ws.addEventListener("message", (event) => {
			const message = JSON.parse(event.data);
			if (message.id) {
				const pending = this.pending.get(message.id);
				if (!pending) return;
				this.pending.delete(message.id);
				if (message.error) {
					pending.reject(
						new Error(`${message.error.message} (${message.error.code})`)
					);
					return;
				}
				pending.resolve(message.result);
				return;
			}
			for (const listener of this.listeners) {
				listener(message);
			}
		});

		this.ws.addEventListener("close", () => {
			for (const pending of this.pending.values()) {
				pending.reject(new Error("CDP connection closed"));
			}
			this.pending.clear();
		});
	}

	onEvent(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	send(method, params = {}, sessionId = undefined) {
		const id = this.nextId += 1;
		const deferred = createDeferred();
		this.pending.set(id, deferred);
		this.ws.send(
			JSON.stringify({
				id,
				method,
				params,
				...(sessionId ? { sessionId } : {}),
			})
		);
		return deferred.promise;
	}

	async close() {
		if (!this.ws) return;
		this.ws.close();
		await delay(100);
	}
}

class HarnessPage {
	constructor(browser, name, targetId, sessionId, browserContextId) {
		this.browser = browser;
		this.name = name;
		this.targetId = targetId;
		this.sessionId = sessionId;
		this.browserContextId = browserContextId;
		this.pageErrors = [];
		this.unsubscribe = this.browser.client.onEvent((message) => {
			if (message.sessionId !== this.sessionId) return;
			if (message.method === "Runtime.exceptionThrown") {
				const details = message.params?.exceptionDetails;
				this.pageErrors.push(
					`Runtime exception: ${details?.text || "Unknown error"}`
				);
			}
			if (message.method === "Log.entryAdded") {
				const entry = message.params?.entry;
				if (
					entry?.level === "error" &&
					entry.source === "javascript"
				) {
					this.pageErrors.push(`Log error: ${entry.text}`);
				}
			}
		});
	}

	async init() {
		const setupCommands = [
			this.browser.client.send("Page.enable", {}, this.sessionId),
			this.browser.client.send("Runtime.enable", {}, this.sessionId),
			this.browser.client.send("Network.enable", {}, this.sessionId),
			this.browser.client.send("Log.enable", {}, this.sessionId),
			this.browser.client.send("Page.addScriptToEvaluateOnNewDocument", {
				source: PAGE_HELPERS_SCRIPT,
			}, this.sessionId),
			this.browser.client.send("Emulation.setDeviceMetricsOverride", {
				width: 1440,
				height: 960,
				deviceScaleFactor: 1,
				mobile: false,
			}, this.sessionId),
		];
		if (extraRequestHeaders) {
			setupCommands.push(
				this.browser.client.send(
					"Network.setExtraHTTPHeaders",
					{ headers: extraRequestHeaders },
					this.sessionId
				)
			);
		}
		await Promise.all(setupCommands);
	}

	async setTokenCookie(token) {
		await this.browser.client.send(
			"Network.setCookie",
			{
				name: "token",
				value: token,
				url: `${baseUrl}/`,
				secure: true,
				httpOnly: true,
				sameSite: "Strict",
			},
			this.sessionId
		);
	}

	async activate() {
		await this.browser.client.send("Target.activateTarget", { targetId: this.targetId });
	}

	async navigate(targetUrl) {
		await this.browser.client.send(
			"Page.navigate",
			{ url: targetUrl },
			this.sessionId
		);
		await this.waitForDocumentReady();
		await this.waitForHelper();
	}

	async waitForDocumentReady(timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		await this.waitFor(async () => {
			const state = await this.evaluate(() => document.readyState);
			return state === "complete";
		}, { timeoutMs, description: `${this.name} document ready` });
	}

	async waitForHelper(timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		await this.waitFor(async () => {
			try {
				return await this.callHelper("hasHelper");
			} catch {
				return false;
			}
		}, { timeoutMs, description: `${this.name} helper injection` });
	}

	async evaluate(fn, ...args) {
		const expression = `(${fn.toString()}).apply(null, ${JSON.stringify(args)})`;
		const result = await this.browser.client.send(
			"Runtime.evaluate",
			{
				expression,
				awaitPromise: true,
				returnByValue: true,
				userGesture: true,
			},
			this.sessionId
		);
		if (result.exceptionDetails) {
			throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
		}
		return result.result?.value;
	}

	async callHelper(method, ...args) {
		const expression = `window.__cdpGameTest.${method}.apply(window.__cdpGameTest, ${JSON.stringify(args)})`;
		const result = await this.browser.client.send(
			"Runtime.evaluate",
			{
				expression,
				awaitPromise: true,
				returnByValue: true,
				userGesture: true,
			},
			this.sessionId
		);
		if (result.exceptionDetails) {
			throw new Error(result.exceptionDetails.text || `Helper ${method} failed`);
		}
		return result.result?.value;
	}

	async waitFor(predicate, { timeoutMs = DEFAULT_WAIT_TIMEOUT_MS, intervalMs = 125, description = "condition" } = {}) {
		const deadline = Date.now() + timeoutMs;
		let lastError = null;
		while (Date.now() < deadline) {
			try {
				const value = await predicate();
				if (value) return value;
			} catch (error) {
				lastError = error;
			}
			await delay(intervalMs);
		}
		const suffix = lastError ? ` Last error: ${lastError.message}` : "";
		throw new Error(`Timed out waiting for ${description}.${suffix}`);
	}

	async waitForPathIncludes(fragment, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		return this.waitFor(async () => {
			const currentPath = await this.callHelper("getPath");
			return currentPath.includes(fragment) ? currentPath : false;
		}, { timeoutMs, description: `${this.name} path containing ${fragment}` });
	}

	async waitForText(text, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		return this.waitFor(
			() => this.callHelper("hasText", text),
			{ timeoutMs, description: `${this.name} text ${text}` }
		);
	}

	async waitForButtonEnabled(candidates, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		return this.waitFor(async () => {
			const state = await this.callHelper("getButtonState", candidates);
			return state.exists && !state.disabled ? state : false;
		}, { timeoutMs, description: `${this.name} enabled button ${candidates.join(", ")}` });
	}

	async clickByText(candidates, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		await this.waitFor(async () => {
			const state = await this.callHelper("getButtonState", candidates);
			return state.exists ? state : false;
		}, { timeoutMs, description: `${this.name} button ${candidates.join(", ")}` });
		const result = await this.callHelper("clickByText", candidates);
		if (!result?.clicked) {
			throw new Error(`${this.name} could not click ${candidates.join(", ")}`);
		}
		return result;
	}

	async getPath() {
		return this.callHelper("getPath");
	}

	async getReadonlyInputValue(timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
		return this.waitFor(async () => {
			const value = await this.callHelper("getReadonlyInputValue");
			return value ? value : false;
		}, { timeoutMs, description: `${this.name} readonly input value` });
	}

	async fillFirstInput(value) {
		return this.waitFor(
			async () => {
				const ok = await this.callHelper("fillFirstEditableInput", value);
				return ok ? true : false;
			},
			{ description: `${this.name} first editable input` }
		);
	}

	async fillInputAtIndex(index, value) {
		return this.waitFor(
			async () => {
				const ok = await this.callHelper("fillEditableInputByIndex", index, value);
				return ok ? true : false;
			},
			{ description: `${this.name} editable input at index ${index}` }
		);
	}

	async submitFirstInput() {
		return this.waitFor(
			async () => {
				const ok = await this.callHelper("submitFirstEditableInput");
				return ok ? true : false;
			},
			{ description: `${this.name} submit first editable input` }
		);
	}

	async clickAdjacentInputButton() {
		return this.waitFor(
			async () => {
				const ok = await this.callHelper("clickButtonAdjacentToFirstEditableInput");
				return ok ? true : false;
			},
			{ description: `${this.name} adjacent input button` }
		);
	}

	async focusGameSurface() {
		await this.activate();
		await this.evaluate(() => {
			window.focus();
			document.body.focus();
			const canvas = document.querySelector("canvas");
			if (canvas instanceof HTMLCanvasElement) {
				canvas.scrollIntoView({ block: "center", inline: "center" });
			}
		});
	}

	async keyDown(key) {
		const descriptor = keyDescriptors[key];
		if (!descriptor) {
			throw new Error(`Unsupported key: ${key}`);
		}
		await this.browser.client.send("Input.dispatchKeyEvent", { type: "keyDown", ...descriptor }, this.sessionId);
	}

	async keyUp(key) {
		const descriptor = keyDescriptors[key];
		if (!descriptor) {
			throw new Error(`Unsupported key: ${key}`);
		}
		await this.browser.client.send("Input.dispatchKeyEvent", { type: "keyUp", ...descriptor }, this.sessionId);
	}

	async captureCanvasState() {
		return this.callHelper("getCanvasState");
	}

	async collectMetrics() {
		return this.callHelper("collectCanvasMetrics", sampleDurationMs, sampleIntervalMs);
	}

	async saveScreenshot(label) {
		const outputPath = path.join(os.tmpdir(), `ft-transcendence-${label}-${Date.now()}.png`);
		const result = await this.browser.client.send(
			"Page.captureScreenshot",
			{ format: "png" },
			this.sessionId
		);
		await writeFile(outputPath, Buffer.from(result.data, "base64"));
		return outputPath;
	}

	async close() {
		this.unsubscribe?.();
		try {
			await this.browser.client.send("Target.closeTarget", { targetId: this.targetId });
		} catch {
			// Ignore already-closed targets during cleanup.
		}
	}

	async loginTo(nextPath) {
		if (!this.authUser) {
			throw new Error(`${this.name} has no auth user available for login fallback`);
		}

		await this.navigate(`${baseUrl}/login?next=${encodeURIComponent(nextPath)}`);
		await this.fillInputAtIndex(0, this.authUser.email);
		await this.fillInputAtIndex(1, this.authUser.password);
		await this.clickByText(["Login"]);
		await this.waitFor(async () => {
			const currentPath = await this.getPath();
			return currentPath.startsWith("/login") ? false : currentPath;
		}, { description: `${this.name} login redirect`, timeoutMs: DEFAULT_WAIT_TIMEOUT_MS });
	}

	async openProtectedPath(targetPath) {
		if (!cookieBootstrapEnabled) {
			await this.loginTo(targetPath);
			await this.waitFor(async () => {
				const nextPath = await this.getPath();
				return nextPath.includes(targetPath) ? nextPath : false;
			}, { description: `${this.name} protected path ${targetPath}`, timeoutMs: DEFAULT_WAIT_TIMEOUT_MS });
			return;
		}

		await this.navigate(`${baseUrl}${targetPath}`);
		const currentPath = await this.getPath();
		if (currentPath.startsWith("/login")) {
			await this.loginTo(targetPath);
			await this.waitFor(async () => {
				const nextPath = await this.getPath();
				return nextPath.includes(targetPath) ? nextPath : false;
			}, { description: `${this.name} protected path ${targetPath}`, timeoutMs: DEFAULT_WAIT_TIMEOUT_MS });
		}
	}
}

class ChromeHarnessBrowser {
	constructor({ baseUrl, port, userDataDir, processHandle, client }) {
		this.baseUrl = baseUrl;
		this.port = port;
		this.userDataDir = userDataDir;
		this.processHandle = processHandle;
		this.client = client;
		this.contextIds = new Set();
	}

	static async launch() {
		const port = await findFreePort();
		const userDataDir = await mkdtemp(path.join(os.tmpdir(), "ft-transcendence-cdp-"));
		const chromeArgs = [
			"--headless=new",
			"--disable-gpu",
			"--disable-dev-shm-usage",
			"--ignore-certificate-errors",
			"--no-first-run",
			"--no-default-browser-check",
			`--user-data-dir=${userDataDir}`,
			`--remote-debugging-port=${port}`,
			"about:blank",
		];
		const processHandle = spawn("/usr/bin/google-chrome", chromeArgs, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		processHandle.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		const versionInfo = await waitFor(async () => {
			try {
				const response = await fetch(`http://127.0.0.1:${port}/json/version`);
				if (!response.ok) return false;
				return response.json();
			} catch {
				return false;
			}
		}, "chrome remote debugging endpoint");

		const client = new CdpClient(versionInfo.webSocketDebuggerUrl);
		await client.connect();
		const browser = new ChromeHarnessBrowser({
			baseUrl,
			port,
			userDataDir,
			processHandle,
			client,
		});
		processHandle.once("exit", (code) => {
			if (code !== 0) {
				console.error(`Chrome exited with code ${code}. stderr:\n${stderr}`);
			}
		});
		return browser;
	}

	async newAuthedPage(name, user) {
		const { browserContextId } = await this.client.send("Target.createBrowserContext");
		this.contextIds.add(browserContextId);
		const { targetId } = await this.client.send("Target.createTarget", {
			url: "about:blank",
			browserContextId,
			width: 1440,
			height: 960,
		});
		const { sessionId } = await this.client.send("Target.attachToTarget", {
			targetId,
			flatten: true,
		});

		const page = new HarnessPage(this, name, targetId, sessionId, browserContextId);
		page.authUser = user;
		await page.init();
		if (cookieBootstrapEnabled) {
			await page.setTokenCookie(user.token);
		}
		return page;
	}

	async disposeContext(browserContextId) {
		if (!browserContextId || !this.contextIds.has(browserContextId)) return;
		this.contextIds.delete(browserContextId);
		try {
			await this.client.send("Target.disposeBrowserContext", { browserContextId });
		} catch {
			// Ignore disposal races during teardown.
		}
	}

	async close() {
		for (const contextId of [...this.contextIds]) {
			await this.disposeContext(contextId);
		}
		await this.client.close();
		this.processHandle.kill("SIGTERM");
		await delay(250);
		if (!this.processHandle.killed) {
			this.processHandle.kill("SIGKILL");
		}
		await rm(this.userDataDir, { recursive: true, force: true });
	}
}

async function waitFor(fn, description, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS, intervalMs = 150) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const value = await fn();
		if (value) return value;
		await delay(intervalMs);
	}
	throw new Error(`Timed out waiting for ${description}`);
}

function evaluateMetrics(metrics) {
	const failures = [];
	if (metrics.averageFps < thresholds.minAverageFps) {
		failures.push(`average fps ${metrics.averageFps} < ${thresholds.minAverageFps}`);
	}
	if (metrics.worstFrameMs > thresholds.maxWorstFrameMs) {
		failures.push(`worst frame ${metrics.worstFrameMs}ms > ${thresholds.maxWorstFrameMs}ms`);
	}
	if (metrics.longFrames > thresholds.maxLongFrames) {
		failures.push(`long frames ${metrics.longFrames} > ${thresholds.maxLongFrames}`);
	}
	if (metrics.hashChanges < thresholds.minHashChanges) {
		failures.push(`hash changes ${metrics.hashChanges} < ${thresholds.minHashChanges}`);
	}
	if (metrics.uniqueHashes < thresholds.minUniqueHashes) {
		failures.push(`unique hashes ${metrics.uniqueHashes} < ${thresholds.minUniqueHashes}`);
	}
	return failures;
}

async function probeInputLatency(page, keys) {
	await page.focusGameSurface();
	const baseline = await page.captureCanvasState();
	if (!baseline) {
		throw new Error(`${page.name} has no canvas for input probe`);
	}

	for (const key of keys) {
		await page.keyDown(key);
		const startedAt = Date.now();
		let responseMs = null;

		for (let sampleIndex = 0; sampleIndex < 6; sampleIndex += 1) {
			await delay(60);
			const snapshot = await page.captureCanvasState();
			if (
				snapshot &&
				((snapshot.left !== baseline.left && snapshot.left !== null && baseline.left !== null) ||
					(snapshot.right !== baseline.right && snapshot.right !== null && baseline.right !== null))
			) {
				responseMs = Date.now() - startedAt;
				break;
			}
		}

		await page.keyUp(key);
		await delay(80);

		if (responseMs !== null) {
			return { key, responseMs };
		}
	}

	return { key: keys[0], responseMs: null };
}

async function waitForGameplay(page) {
	await page.focusGameSurface();
	await page.waitFor(async () => {
		const canvas = await page.captureCanvasState();
		return canvas ? canvas : false;
	}, { description: `${page.name} canvas` });

	const metrics = await page.collectMetrics();
	if (metrics.error) {
		throw new Error(`${page.name} metrics error: ${metrics.error}`);
	}
	return metrics;
}

async function startRuntimeGame(pages, { remote = false } = {}) {
	for (const page of pages) {
		await page.waitFor(async () => {
			const canvas = await page.captureCanvasState();
			return canvas ? canvas : false;
		}, { description: `${page.name} runtime canvas` });
	}

	if (remote) {
		await waitFor(async () => {
			for (const page of pages) {
				const readyState = await page.callHelper("getButtonState", ["I AM READY"]);
				if (readyState.exists && !readyState.disabled) {
					await page.clickByText(["I AM READY"]);
					await delay(120);
				}
			}

			let waitingOverlayVisible = false;
			for (const page of pages) {
				const readyState = await page.callHelper("getButtonState", ["I AM READY"]);
				const cancelState = await page.callHelper("getButtonState", ["Not Ready? Click to cancel"]);
				if (readyState.exists || cancelState.exists) {
					waitingOverlayVisible = true;
				}
			}

			return waitingOverlayVisible ? false : true;
		}, "remote players to become active", DEFAULT_WAIT_TIMEOUT_MS, 200);
		await delay(800);
		return;
	}

	await pages[0].clickByText(["Start Game"]);
	await delay(600);
}

async function assertPageHealth(page, label) {
	if (page.pageErrors.length === 0) return;
	const screenshot = await page.saveScreenshot(`${label}-error`);
	throw new Error(
		`${page.name} recorded runtime errors:\n- ${page.pageErrors.join("\n- ")}\nScreenshot: ${screenshot}`
	);
}

async function runLocalSingleGuest(browser) {
	const user = await createUser("local-single");
	const page = await browser.newAuthedPage("local-single", user);
	try {
		console.log("Running local single vs guest...");
		await page.openProtectedPath("/game/local/single");
		await page.fillFirstInput("Guest Challenger");
		await page.clickAdjacentInputButton();
		await page.waitForButtonEnabled(["Start Match"]);
		await page.clickByText(["Start Match"]);
		await page.waitForPathIncludes("/game/local-");
		await startRuntimeGame([page], { remote: false });

		const metrics = await waitForGameplay(page);
		const failures = evaluateMetrics(metrics);
		const player1Input = await probeInputLatency(page, ["s"]);
		const player2Input = await probeInputLatency(page, ["ArrowDown"]);
		if (player1Input.responseMs === null) {
			failures.push("player 1 paddle did not visibly react to input");
		} else if (player1Input.responseMs > thresholds.maxInputResponseMs) {
			failures.push(`player 1 input response ${player1Input.responseMs}ms > ${thresholds.maxInputResponseMs}ms`);
		}
		if (player2Input.responseMs === null) {
			failures.push("player 2 paddle did not visibly react to input");
		} else if (player2Input.responseMs > thresholds.maxInputResponseMs) {
			failures.push(`player 2 input response ${player2Input.responseMs}ms > ${thresholds.maxInputResponseMs}ms`);
		}

		await assertPageHealth(page, "local-single");
		return {
			mode: "local-single",
			metrics,
			input: { player1: player1Input, player2: player2Input },
			failures,
		};
	} finally {
		await page.close();
		await browser.disposeContext(page.browserContextId);
	}
}

async function runLocalSingleAi(browser) {
	const user = await createUser("local-ai");
	const page = await browser.newAuthedPage("local-ai", user);
	try {
		console.log("Running local single vs AI...");
		await page.openProtectedPath("/game/local/single");
		await page.clickByText(["Disabled"]);
		await page.clickByText(["Start Match"]);
		await page.waitForPathIncludes("/game/local-");
		await startRuntimeGame([page], { remote: false });

		const metrics = await waitForGameplay(page);
		const failures = evaluateMetrics(metrics);
		const input = await probeInputLatency(page, ["s"]);
		if (input.responseMs === null) {
			failures.push("human paddle did not visibly react to input");
		} else if (input.responseMs > thresholds.maxInputResponseMs) {
			failures.push(`human input response ${input.responseMs}ms > ${thresholds.maxInputResponseMs}ms`);
		}

		await assertPageHealth(page, "local-ai");
		return {
			mode: "local-ai",
			metrics,
			input,
			failures,
		};
	} finally {
		await page.close();
		await browser.disposeContext(page.browserContextId);
	}
}

async function runLocalTournament(browser) {
	const user = await createUser("local-tournament");
	const page = await browser.newAuthedPage("local-tournament", user);
	try {
		console.log("Running local tournament first match...");
		await page.openProtectedPath("/game/local/tournament");
		await page.fillFirstInput("Tournament Guest 1");
		await page.clickByText(["Add Player"]);
		await page.fillFirstInput("Tournament Guest 2");
		await page.clickByText(["Add Player"]);
		await page.clickByText(["Begin Tournament"]);
		await page.waitForPathIncludes("/game/local/tournament/");
		await page.waitFor(async () => {
			const startState = await page.callHelper("getButtonState", ["Start Match"]);
			if (startState.exists && !startState.disabled) return true;

			const byeState = await page.callHelper("getButtonState", ["Process Bye & Advance"]);
			if (byeState.exists && !byeState.disabled) {
				await page.clickByText(["Process Bye & Advance"]);
				return false;
			}

			return false;
		}, { description: "local tournament playable match", timeoutMs: DEFAULT_WAIT_TIMEOUT_MS });
		await page.clickByText(["Start Match"]);
		await page.waitForPathIncludes("/game/local-");
		await startRuntimeGame([page], { remote: false });

		const metrics = await waitForGameplay(page);
		const failures = evaluateMetrics(metrics);
		const input = await probeInputLatency(page, ["s"]);
		if (input.responseMs === null) {
			failures.push("tournament paddle did not visibly react to input");
		} else if (input.responseMs > thresholds.maxInputResponseMs) {
			failures.push(`tournament input response ${input.responseMs}ms > ${thresholds.maxInputResponseMs}ms`);
		}

		await assertPageHealth(page, "local-tournament");
		return {
			mode: "local-tournament",
			metrics,
			input,
			failures,
		};
	} finally {
		await page.close();
		await browser.disposeContext(page.browserContextId);
	}
}

async function runRemoteSingle() {
	const hostUser = await createUser("remote-single-host");
	const guestUser = await createUser("remote-single-guest");
	const spectatorUser = await createUser("remote-single-spectator");
	const hostBrowser = await ChromeHarnessBrowser.launch();
	const guestBrowser = await ChromeHarnessBrowser.launch();
	const spectatorBrowser = await ChromeHarnessBrowser.launch();
	const hostPage = await hostBrowser.newAuthedPage("remote-single-host", hostUser);
	const guestPage = await guestBrowser.newAuthedPage("remote-single-guest", guestUser);
	const spectatorPage = await spectatorBrowser.newAuthedPage(
		"remote-single-spectator",
		spectatorUser
	);
	const playerPages = [hostPage, guestPage];
	const pages = [hostPage, guestPage, spectatorPage];
	const browsers = [hostBrowser, guestBrowser, spectatorBrowser];

	try {
		console.log("Running remote single private room...");
		await hostPage.openProtectedPath("/game/remote/single/create");
		const roomId = await hostPage.getReadonlyInputValue();
		await guestPage.openProtectedPath("/game/remote/single/join");
		await guestPage.fillFirstInput(roomId);
		await guestPage.clickByText(["Join Game"]);

		await hostPage.waitForButtonEnabled(["Start Game"], DEFAULT_WAIT_TIMEOUT_MS);
		await hostPage.clickByText(["Start Game"]);
		await Promise.all(playerPages.map((page) => page.waitForPathIncludes("/game/RS-")));
		await startRuntimeGame(playerPages, { remote: true });

		const hostRuntimePath = await hostPage.getPath();
		const spectatorPath = `${hostRuntimePath.split("?")[0]}?spectator=true`;
		await spectatorPage.openProtectedPath(spectatorPath);
		await spectatorPage.waitForPathIncludes("?spectator=true");

		const pageResults = [];
		for (const page of playerPages) {
			const metrics = await waitForGameplay(page);
			const failures = evaluateMetrics(metrics);
			const input = await probeInputLatency(page, ["s"]);
			if (input.responseMs === null) {
				failures.push("remote paddle did not visibly react to input");
			} else if (input.responseMs > thresholds.maxInputResponseMs) {
				failures.push(`remote input response ${input.responseMs}ms > ${thresholds.maxInputResponseMs}ms`);
			}
			await assertPageHealth(page, `remote-single-${page.name}`);
			pageResults.push({ page: page.name, metrics, input, failures });
		}

		const spectatorMetrics = await waitForGameplay(spectatorPage);
		const spectatorFailures = evaluateMetrics(spectatorMetrics);
		await assertPageHealth(spectatorPage, "remote-single-spectator");
		pageResults.push({
			page: spectatorPage.name,
			metrics: spectatorMetrics,
			input: null,
			failures: spectatorFailures,
		});

		return {
			mode: "remote-single",
			roomId,
			pageResults,
			failures: pageResults.flatMap((entry) =>
				entry.failures.map((failure) => `${entry.page}: ${failure}`)
			),
		};
	} finally {
		for (const page of pages) {
			await page.close();
		}
		for (const [index, browser] of browsers.entries()) {
			const page = pages[index];
			await browser.disposeContext(page.browserContextId);
			await browser.close();
		}
	}
}

async function runRemoteTournament() {
	const hostUser = await createUser("remote-tournament-host");
	const guestOneUser = await createUser("remote-tournament-guest-1");
	const guestTwoUser = await createUser("remote-tournament-guest-2");

	const hostBrowser = await ChromeHarnessBrowser.launch();
	const guestOneBrowser = await ChromeHarnessBrowser.launch();
	const guestTwoBrowser = await ChromeHarnessBrowser.launch();
	const hostPage = await hostBrowser.newAuthedPage("remote-tournament-host", hostUser);
	const guestOnePage = await guestOneBrowser.newAuthedPage("remote-tournament-guest-1", guestOneUser);
	const guestTwoPage = await guestTwoBrowser.newAuthedPage("remote-tournament-guest-2", guestTwoUser);
	const pages = [hostPage, guestOnePage, guestTwoPage];
	const browsers = [hostBrowser, guestOneBrowser, guestTwoBrowser];

	try {
		console.log("Running remote tournament private room...");
		await hostPage.openProtectedPath("/game/remote/tournament/create");
		const roomId = await hostPage.getReadonlyInputValue();

		for (const guestPage of [guestOnePage, guestTwoPage]) {
			await guestPage.openProtectedPath("/game/remote/tournament/join");
			await guestPage.fillFirstInput(roomId);
			await guestPage.clickByText(["Join Tournament"]);
		}

		await hostPage.waitForButtonEnabled(["Start Tournament"], DEFAULT_WAIT_TIMEOUT_MS);
		await hostPage.clickByText(["Start Tournament"]);
		await Promise.all(
			pages.map((page) =>
				page.waitForPathIncludes(`/game/remote/tournament/RT-${roomId}`)
			)
		);

		const readyPages = await waitFor(async () => {
			const activePages = [];
			for (const page of pages) {
				const state = await page.callHelper("getButtonState", ["Ready"]);
				if (state.exists && !state.disabled) {
					activePages.push(page);
				}
			}
			return activePages.length >= 2 ? activePages : false;
		}, "two tournament players ready to launch", DEFAULT_WAIT_TIMEOUT_MS, 200);

		for (const page of readyPages) {
			await page.clickByText(["Ready"]);
		}

		const runtimePages = await waitFor(async () => {
			const activeRuntimePages = [];
			for (const page of pages) {
				const currentPath = await page.getPath();
				if (currentPath.startsWith("/game/RT-")) {
					activeRuntimePages.push(page);
				}
			}
			return activeRuntimePages.length >= 2 ? activeRuntimePages : false;
		}, "two tournament runtime pages", DEFAULT_WAIT_TIMEOUT_MS, 200);

		await startRuntimeGame(runtimePages, { remote: true });

		const pageResults = [];
		for (const page of runtimePages) {
			const metrics = await waitForGameplay(page);
			const failures = evaluateMetrics(metrics);
			const input = await probeInputLatency(page, ["s"]);
			if (input.responseMs === null) {
				failures.push("tournament remote paddle did not visibly react to input");
			} else if (input.responseMs > thresholds.maxInputResponseMs) {
				failures.push(`tournament remote input response ${input.responseMs}ms > ${thresholds.maxInputResponseMs}ms`);
			}
			await assertPageHealth(page, `remote-tournament-${page.name}`);
			pageResults.push({ page: page.name, metrics, input, failures });
		}

		const spectatorLobbyPage = pages.find((page) => !runtimePages.includes(page));
		if (spectatorLobbyPage) {
			await spectatorLobbyPage.waitForButtonEnabled(
				["Watch Live", "Watch"],
				DEFAULT_WAIT_TIMEOUT_MS
			);
			await spectatorLobbyPage.clickByText(["Watch Live", "Watch"]);
			await spectatorLobbyPage.waitForPathIncludes("?spectator=true");
			const spectatorMetrics = await waitForGameplay(spectatorLobbyPage);
			const spectatorFailures = evaluateMetrics(spectatorMetrics);
			await assertPageHealth(
				spectatorLobbyPage,
				`remote-tournament-${spectatorLobbyPage.name}-spectator`
			);
			pageResults.push({
				page: `${spectatorLobbyPage.name}-spectator`,
				metrics: spectatorMetrics,
				input: null,
				failures: spectatorFailures,
			});
		} else {
			pageResults.push({
				page: "remote-tournament-spectator",
				metrics: {
					averageFps: 0,
					worstFrameMs: 0,
					longFrames: 0,
					hashChanges: 0,
				},
				input: null,
				failures: ["no spectator lobby page was available for tournament smoke"],
			});
		}

		return {
			mode: "remote-tournament",
			roomId,
			pageResults,
			failures: pageResults.flatMap((entry) =>
				entry.failures.map((failure) => `${entry.page}: ${failure}`)
			),
		};
	} finally {
		for (const page of pages) {
			await page.close();
		}
		for (const [index, browser] of browsers.entries()) {
			const page = pages[index];
			await browser.disposeContext(page.browserContextId);
			await browser.close();
		}
	}
}

function printModeResult(result) {
	console.log(`\n[${result.mode}]`);
	if (result.pageResults) {
		for (const entry of result.pageResults) {
			const inputResponse =
				entry.input && typeof entry.input.responseMs !== "undefined"
					? `${entry.input.responseMs ?? "n/a"}ms`
					: "n/a";
			console.log(
				`  ${entry.page}: fps=${entry.metrics.averageFps}, worst=${entry.metrics.worstFrameMs}ms, ` +
					`longFrames=${entry.metrics.longFrames}, hashChanges=${entry.metrics.hashChanges}, ` +
					`input=${inputResponse}`
			);
		}
	} else {
		const input = result.input
			? JSON.stringify(result.input)
			: "n/a";
		console.log(
			`  fps=${result.metrics.averageFps}, worst=${result.metrics.worstFrameMs}ms, ` +
				`longFrames=${result.metrics.longFrames}, hashChanges=${result.metrics.hashChanges}, input=${input}`
		);
	}

	if (result.failures.length === 0) {
		console.log("  PASS");
		return;
	}

	console.log("  FAIL");
	for (const failure of result.failures) {
		console.log(`    - ${failure}`);
	}
}

async function main() {
	console.log(`Gameplay smoke test target: ${baseUrl}`);
	const browser = await ChromeHarnessBrowser.launch();
	const results = [];
	let exitCode = 0;

	try {
		const testRuns = [
			runLocalSingleGuest,
			runLocalSingleAi,
			runLocalTournament,
			runRemoteSingle,
			runRemoteTournament,
		];

		for (const testRun of testRuns) {
			try {
				const result = await testRun(browser);
				results.push(result);
				printModeResult(result);
				if (result.failures.length > 0) {
					exitCode = 1;
				}
			} catch (error) {
				exitCode = 1;
				const failure = {
					mode: testRun.name,
					failures: [error.stack || error.message || String(error)],
				};
				results.push(failure);
				console.log(`\n[${testRun.name}]`);
				console.log("  FAIL");
				console.log(`    - ${failure.failures[0]}`);
			}
		}
	} finally {
		await browser.close();
	}

	console.log("\nSummary:");
	for (const result of results) {
		const status = result.failures.length === 0 ? "PASS" : "FAIL";
		console.log(`- ${result.mode || "unknown"}: ${status}`);
	}

	if (exitCode !== 0) {
		process.exitCode = exitCode;
	}
}

main().catch((error) => {
	console.error(error.stack || error.message || String(error));
	process.exitCode = 1;
});
