import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Readable } from "node:stream";
import { authenticatedWebServer, loopback, } from "../web-route-auth.js";
const incoming = (headers) => ({ headers });
const lan = "192.168.1.6:3344";
const local = "127.0.0.1:3344";
function fixture({ connection, host = "127.0.0.1", logger, } = {}) {
    const routes = [];
    class Server {
        #host = host;
        get host() {
            return this.#host;
        }
        getOrigin() {
            return `http://${this.#host}:3344`;
        }
        register(route) {
            assert.equal(this.#host, host);
            routes.push(route);
            return () => {
                const idx = routes.indexOf(route);
                if (idx !== -1)
                    routes.splice(idx, 1);
            };
        }
    }
    const server = new Server();
    const facade = authenticatedWebServer({ get: () => connection, logger }, server);
    return { routes, facade, server };
}
function nativeConnection(seen = []) {
    return {
        allowsRemoteAuthorities: true,
        requestRejection(request) {
            seen.push({ ...request.headers });
            const headers = request.headers;
            if (![lan, local].includes(headers["host"] ?? "") ||
                (headers["origin"] &&
                    headers["origin"] !== `http://${headers["host"]}`) ||
                headers["sec-fetch-site"] === "cross-site") {
                return 403;
            }
            if (headers["cookie"] !== "authenticated")
                return 401;
            return undefined;
        },
    };
}
function createResponse() {
    const result = {
        writeHead(status, headers) {
            this.status = status;
            this.headers = headers;
        },
        end(body) {
            this.body = body;
        },
    };
    return result;
}
describe("web-route-auth: loopback verification", () => {
    it("recognizes standard IPv4 loopback addresses", () => {
        assert.equal(loopback("127.0.0.1"), true);
        assert.equal(loopback("127.0.0.1:3344"), true);
        assert.equal(loopback("127.255.255.255"), true);
        assert.equal(loopback("127.1.2.3:8080"), true);
    });
    it("recognizes IPv6 loopback addresses with and without brackets and ports", () => {
        assert.equal(loopback("::1"), true);
        assert.equal(loopback("[::1]"), true);
        assert.equal(loopback("[::1]:3344"), true);
    });
    it("recognizes IPv4-mapped IPv6 loopback addresses", () => {
        assert.equal(loopback("::ffff:127.0.0.1"), true);
        assert.equal(loopback("[::ffff:127.0.0.1]:80"), true);
        assert.equal(loopback("::ffff:7f00:1"), true);
        assert.equal(loopback("[::ffff:7f00:1]:3344"), true);
    });
    it("recognizes localhost hostname case-insensitively with optional port", () => {
        assert.equal(loopback("localhost"), true);
        assert.equal(loopback("LocalHost"), true);
        assert.equal(loopback("localhost:3344"), true);
        assert.equal(loopback("LOCALHOST:8080"), true);
    });
    it("rejects non-loopback addresses and domains", () => {
        assert.equal(loopback("127.evil.com"), false);
        assert.equal(loopback("127.evil.com:8080"), false);
        assert.equal(loopback("0.0.0.0"), false);
        assert.equal(loopback("0.0.0.0:3344"), false);
        assert.equal(loopback("10.0.0.5"), false);
        assert.equal(loopback("192.168.1.1"), false);
        assert.equal(loopback("localhost.evil.com"), false);
        assert.equal(loopback(""), false);
        assert.equal(loopback(null), false);
        assert.equal(loopback(undefined), false);
    });
});
describe("web-route-auth: authenticatedWebServer", () => {
    it("returns undefined or null as-is when server is nullish", () => {
        assert.equal(authenticatedWebServer({}, undefined), undefined);
        assert.equal(authenticatedWebServer({}, null), null);
    });
    it("unauthenticated handler on LAN is rejected with 401 before handler side-effects", () => {
        const { facade, routes } = fixture({ connection: nativeConnection() });
        let called = false;
        facade.register({
            kind: "exact",
            path: "/private",
            handler() {
                called = true;
            },
        });
        const res = createResponse();
        routes[0].handler(incoming({ host: lan }), res);
        assert.equal(res.status, 401);
        assert.equal(res.body, "access denied");
        assert.equal(called, false);
    });
    it("unauthenticated handler on local host is rejected with 401 when remote authorities enabled", () => {
        const { facade, routes } = fixture({ connection: nativeConnection() });
        let called = false;
        facade.register({
            kind: "exact",
            path: "/private",
            handler() {
                called = true;
            },
        });
        const res = createResponse();
        routes[0].handler(incoming({ host: local }), res);
        assert.equal(res.status, 401);
        assert.equal(called, false);
    });
    it("wrong Origin and Sec-Fetch-Site cross-site requests are rejected with 403 before normalization", () => {
        const { facade, routes } = fixture({ connection: nativeConnection() });
        facade.register({
            handler() {
                assert.fail("private handler reached");
            },
        });
        for (const extra of [
            { origin: "http://attacker.test" },
            { "sec-fetch-site": "cross-site" },
        ]) {
            const res = createResponse();
            routes[0].handler(incoming({ host: lan, cookie: "authenticated", ...extra }), res);
            assert.equal(res.status, 403);
            assert.equal(res.body, "access denied");
        }
    });
    it("spoofed loopback subdomain origin is rejected with 403 on loopback listener", () => {
        const { facade, routes } = fixture({ host: "127.0.0.1" });
        facade.register({
            handler() {
                assert.fail("handler reached on spoofed origin");
            },
        });
        const res = createResponse();
        routes[0].handler(incoming({ host: local, origin: "http://127.evil.com:8080" }), res);
        assert.equal(res.status, 403);
    });
    it("origin header arrays are strictly validated and cross-site origins rejected with 403", () => {
        const { facade, routes } = fixture({ host: "127.0.0.1" });
        facade.register({
            handler() {
                assert.fail("handler reached on malicious origin array");
            },
        });
        // Single cross-site origin in array
        let res = createResponse();
        routes[0].handler(incoming({
            host: local,
            origin: ["http://evil.com"],
        }), res);
        assert.equal(res.status, 403);
        // Multiple cross-site origins
        res = createResponse();
        routes[0].handler(incoming({
            host: local,
            origin: ["http://evil.com", "http://evil2.com"],
        }), res);
        assert.equal(res.status, 403);
        // Mix of loopback and cross-site origin
        res = createResponse();
        routes[0].handler(incoming({
            host: local,
            origin: [
                "http://127.0.0.1:3344",
                "http://evil.com",
            ],
        }), res);
        assert.equal(res.status, 403);
        // Empty array origin
        res = createResponse();
        routes[0].handler(incoming({ host: local, origin: [] }), res);
        assert.equal(res.status, 403);
        // Empty string origin
        res = createResponse();
        routes[0].handler(incoming({ host: local, origin: [""] }), res);
        assert.equal(res.status, 403);
    });
    it("origin header array containing valid loopback or dsh-app is admitted", () => {
        const { facade, routes } = fixture({ host: "127.0.0.1" });
        let reachedCount = 0;
        facade.register({
            handler() {
                reachedCount++;
            },
        });
        let res = createResponse();
        routes[0].handler(incoming({
            host: local,
            origin: ["http://127.0.0.1:3344"],
        }), res);
        assert.equal(reachedCount, 1);
        res = createResponse();
        routes[0].handler(incoming({
            host: local,
            origin: ["dsh-app://canvas"],
        }), res);
        assert.equal(reachedCount, 2);
    });
    it("desktop scheme dsh-app:// is permitted without 403 rejection", () => {
        const { facade, routes } = fixture({ host: "127.0.0.1" });
        let reached = false;
        facade.register({
            handler() {
                reached = true;
            },
        });
        const res = createResponse();
        routes[0].handler(incoming({ host: local, origin: "dsh-app://desktop" }), res);
        assert.equal(reached, true);
    });
    it("authenticated LAN handler receives legacy loopback headers and functioning stream", async () => {
        const seen = [];
        const { facade, routes, server } = fixture({
            connection: nativeConnection(seen),
        });
        const req = Object.assign(Readable.from(["body"]), {
            headers: {
                host: lan,
                origin: `http://${lan}`,
                cookie: "authenticated",
                "sec-fetch-site": "same-origin",
            },
        });
        facade.register({
            handler: async (incomingMsg) => {
                assert.equal(incomingMsg.headers["host"], local);
                assert.equal(incomingMsg.headers["origin"], `http://${local}`);
                assert.equal(incomingMsg.headers["sec-fetch-site"], "same-origin");
                let body = "";
                for await (const chunk of incomingMsg)
                    body += chunk;
                assert.equal(body, "body");
            },
        });
        await routes[0].handler(req, createResponse());
        assert.equal(seen[0]["host"], lan);
        assert.equal(seen[0]["origin"], `http://${lan}`);
        assert.equal(req.headers["host"], lan);
        assert.equal(facade.getOrigin(), server.getOrigin());
        assert.equal(server.host, facade.host);
    });
    it("Fetch resources reject unauthenticated (401), cross-origin (403), and adapt admitted LAN requests", async () => {
        const seen = [];
        const { facade, routes } = fixture({ connection: nativeConnection(seen) });
        let calls = 0;
        facade.register({
            resource: (request) => {
                calls++;
                assert.equal(request.headers.get("host"), local);
                assert.equal(request.headers.get("origin"), `http://${local}`);
                return new Response("private");
            },
        });
        for (const h of [lan, local]) {
            const result = await routes[0].resource(new Request(`http://${h}/private`, { headers: { host: h } }));
            assert.equal(result.status, 401);
        }
        const wrong = await routes[0].resource(new Request(`http://${lan}/private`, {
            headers: {
                host: lan,
                cookie: "authenticated",
                origin: "http://attacker.test",
            },
        }));
        assert.equal(wrong.status, 403);
        assert.equal(calls, 0);
        const original = new Request(`http://${lan}/private`, {
            headers: { host: lan, cookie: "authenticated", origin: `http://${lan}` },
        });
        assert.equal(await (await routes[0].resource(original)).text(), "private");
        assert.equal(original.headers.get("host"), lan);
        assert.equal(seen.at(-1)["host"], lan);
        assert.equal(calls, 1);
    });
    it("remote listener without native admission fails closed with 503", async () => {
        const { facade, routes } = fixture({ host: "0.0.0.0" });
        facade.register({
            handler() {
                assert.fail("handler reached");
            },
            resource() {
                assert.fail("resource reached");
            },
        });
        const res = createResponse();
        routes[0].handler(incoming({ host: local }), res);
        assert.equal(res.status, 503);
        assert.equal(res.body, "authentication unavailable");
        const fetchRes = await routes[0].resource(new Request(`http://${local}`));
        assert.equal(fetchRes.status, 503);
        assert.equal(await fetchRes.text(), "authentication unavailable");
    });
    it("managed LAN marker fails closed with 503 before connection service is available", () => {
        const previous = process.env.WORKSTATION_DSH_LAN_AUTHORITY;
        try {
            process.env.WORKSTATION_DSH_LAN_AUTHORITY = lan;
            const { facade, routes } = fixture();
            facade.register({
                handler() {
                    assert.fail("handler reached");
                },
            });
            const res = createResponse();
            routes[0].handler(incoming({ host: local }), res);
            assert.equal(res.status, 503);
        }
        finally {
            if (previous === undefined) {
                delete process.env.WORKSTATION_DSH_LAN_AUTHORITY;
            }
            else {
                process.env.WORKSTATION_DSH_LAN_AUTHORITY = previous;
            }
        }
    });
    it("native admission errors fail closed with 503 and log warning", () => {
        const warnings = [];
        const { facade, routes } = fixture({
            connection: {
                allowsRemoteAuthorities: true,
                requestRejection() {
                    throw new Error("sensitive detail");
                },
            },
            logger: { warn: (...args) => warnings.push(args) },
        });
        facade.register({
            handler() {
                assert.fail("handler reached");
            },
        });
        const res = createResponse();
        routes[0].handler(incoming({ host: local }), res);
        assert.equal(res.status, 503);
        assert.deepEqual(warnings, [["private web route authentication failed"]]);
    });
    it("route wrappers forward optional arguments in private and LAN modes", async () => {
        for (const remote of [false, true]) {
            const { facade, routes } = fixture({
                connection: remote ? nativeConnection() : undefined,
            });
            const extras = [{ signal: "context" }, 42];
            const res = createResponse();
            facade.register({
                handler: (_req, incomingRes, ...args) => {
                    assert.equal(incomingRes, res);
                    assert.deepEqual(args, extras);
                    return "handled";
                },
                resource: (_req, ...args) => {
                    assert.deepEqual(args, extras);
                    return new Response("resource");
                },
            });
            const headers = { host: remote ? lan : local, cookie: "authenticated" };
            assert.equal(routes[0].handler(incoming(headers), res, ...extras), "handled");
            assert.equal(await (await routes[0].resource(new Request(`http://${headers.host}`, { headers }), ...extras)).text(), "resource");
        }
    });
    it("clean disposer lifecycle removes route", () => {
        const { facade, routes } = fixture();
        const dispose = facade.register({
            path: "/test",
            handler() { },
        });
        assert.equal(routes.length, 1);
        dispose();
        assert.equal(routes.length, 0);
    });
});
