// utils/provider.ts
import { WebSocketProvider } from "@ethersproject/providers";

const KEEP_ALIVE_CHECK_INTERVAL = 7_500; // ms between each ping
const EXPECTED_PONG_BACK       = 15_000; // ms to wait for a pong

/**
 * Create a WebSocketProvider that
 *  • automatically pings the node every KEEP_ALIVE_CHECK_INTERVAL
 *  • force-terminates (and then reconnects) if no pong arrives in EXPECTED_PONG_BACK
 *  • re-instantiates itself on any 'close'
 */
export function getResilientProvider(wsUrl: string): WebSocketProvider {
  // 1) Instantiate the provider
  const provider = new WebSocketProvider(wsUrl);

  // these timers live in closure so each new instantiation has its own
  let keepAliveInterval: NodeJS.Timeout;
  let pongTimeout: NodeJS.Timeout;

  const ws = provider._websocket;

  // 2) When the socket opens, start pinging
  ws.on("open", () => {
    console.info("WebSocket open – starting keep-alive ping loop");

    keepAliveInterval = setInterval(() => {
      // send the ping
      ws.ping?.();
      // if no pong comes back in time, kill the socket
      pongTimeout = setTimeout(() => {
        console.warn(`No pong in ${EXPECTED_PONG_BACK}ms – terminating socket`);
        ws.terminate();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);
  });

  // 3) When we get a pong, clear the "missing-pong" timeout
  ws.on("pong", () => {
    clearTimeout(pongTimeout);
  });

  // 4) On error, just log
  ws.on("error", (err: Error) => {
    console.error("WebSocket error:", err.message);
  });

  // 5) On close, clean up timers and reconnect
  ws.on("close", (code: number, reason: Buffer) => {
    console.error(`WebSocket closed (code=${code}): ${reason.toString()}`);
    clearInterval(keepAliveInterval);
    clearTimeout(pongTimeout);

    // after a short back-off, re-create a fresh provider
    setTimeout(() => {
      console.info("Reconnecting WebSocketProvider…");
      getResilientProvider(wsUrl);
    }, 3_000);
  });

  return provider;
}
