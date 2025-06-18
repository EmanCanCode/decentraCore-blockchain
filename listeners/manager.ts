// listeners/manager.ts

import { CpammListener } from "./finance/cpamm";
import { CsammListener } from "./finance/csamm";
import { InventoryManagementListener } from "./supplyChain/inventoryManagement";
import { ProvenanceListener } from "./supplyChain/provenance";
import { EscrowFactoryListener } from "./realEstate/escrowFactory";
import { WebSocketProvider } from "@ethersproject/providers";
import * as fiDeploy from "../logs/finance/deploy.json";
import * as scDeploy from "../logs/supplyChain/deploy.json";
import * as reDeploy from "../logs/realEstate/deploy.json";
import dotenv from "dotenv";

dotenv.config();
process.setMaxListeners(50);

const SWAP_INTERVAL = 30_000;  // 30 seconds

export class ListenerManager {
  private static instance: ListenerManager;
  private wsProvider!: WebSocketProvider;

  // Timers
  private swapTimer!: NodeJS.Timeout;
  private halfwayTimer!: NodeJS.Timeout;

  // Cycle flag and start flag
  private cycleA = true;
  private hasStarted = false;

  // Contract addresses
  private cpammAddr!: string;
  private csammAddr!: string;
  private provAddr!: string;
  private invAddr!: string;
  private escrowAddr!: string;

  // Listener instances
  private cpammListener!: CpammListener;
  private csammListener!: CsammListener;
  private provListener!: ProvenanceListener;
  private invListener!: InventoryManagementListener;
  private escrowFactoryListener!: EscrowFactoryListener;

  private constructor() {
    if (!process.env.PROVIDER_URL) {
      throw new Error("PROVIDER_URL not set");
    }
    this.setupProvider();
  }

  static getInstance(): ListenerManager {
    if (!ListenerManager.instance) {
      ListenerManager.instance = new ListenerManager();
    }
    return ListenerManager.instance;
  }

  private setupProvider() {
    const raw = process.env.PROVIDER_URL!;
    const wsUrl = raw.replace(/^http/, "ws").replace(/\/$/, "");
    this.wsProvider = new WebSocketProvider(wsUrl);

    this.wsProvider._websocket.on("open", () => {
      console.log(`🔌 WebSocket connected → ${wsUrl}`);
      this.buildListeners();
      this.startCycle();
    });

    this.wsProvider.on("error", err =>
      console.error("Provider error:", err.message)
    );
  }

  private buildListeners() {
    this.cpammListener = new CpammListener(this.wsProvider);
    this.csammListener = new CsammListener(this.wsProvider);
    this.provListener = new ProvenanceListener(this.wsProvider);
    this.invListener = new InventoryManagementListener(this.wsProvider);
    this.escrowFactoryListener = new EscrowFactoryListener(this.wsProvider);
  }

  async initialize(
    cpamm: string,
    csamm: string,
    prov: string,
    inv: string,
    escrow: string
  ) {
    this.cpammAddr = cpamm;
    this.csammAddr = csamm;
    this.provAddr = prov;
    this.invAddr = inv;
    this.escrowAddr = escrow;
  }

  /** Begin the swap loop */
  private startCycle() {
    // Swap immediately, then every SWAP_INTERVAL
    this.swap();
    this.swapTimer = setInterval(() => this.swap(), SWAP_INTERVAL);
  }

  /** Swap between Cycle A and B */
  private async swap() {
    // Determine which cycle WAS active (the opposite of next)
    const closingCycle = this.cycleA ? "B" : "A";
    const closingEmoji = closingCycle === "A" ? "🔴🅰️🔴" : "🔴🅱️🔴";

    if (this.hasStarted) {
      console.log(`${closingEmoji} Closing Cycle ${closingCycle}`);
    }

    // Clear all subscriptions from the old cycle
    await this.clearAllListeners();

    // Determine which cycle to START now
    const startCycle = this.cycleA ? "A" : "B";
    const startEmoji = startCycle === "A" ? "🔵🅰️🔵" : "🔵🅱️🔵";

    console.log(`${startEmoji} Starting Cycle ${startCycle}`);

    // (Re)bind contract addresses if needed
    await this.cpammListener.setCpamm(this.cpammAddr);
    await this.csammListener.setCsamm(this.csammAddr);
    await this.provListener.setProvenance(this.provAddr);
    await this.invListener.setInventoryManagement(this.invAddr);
    await this.escrowFactoryListener.setEscrowFactory(this.escrowAddr);

    // Subscribe handlers
    this.csammListener.listen();
    this.cpammListener.listen();
    this.provListener.listenForCreatedRecord();
    this.provListener.listenForUpdatedRecord();
    this.invListener.listenForStockUpdated();
    this.invListener.listenForItemTransferred();
    this.escrowFactoryListener.listenForEscrowCreated();

    // Schedule halfway log
    clearTimeout(this.halfwayTimer);
    this.halfwayTimer = setTimeout(() => {
      const halfEmoji = startCycle === "A" ? "⚪️🅰️⚪️" : "⚪️🅱️⚪️";
      console.log(`${halfEmoji} Halfway through Cycle ${startCycle}`);
    }, SWAP_INTERVAL / 2);

    // Flip for next run
    this.cycleA = !this.cycleA;
    this.hasStarted = true;
  }

  private async clearAllListeners() {
    await Promise.allSettled([
      this.cpammListener?.removeListeners(),
      this.csammListener?.removeListeners(),
      this.provListener?.removeListeners(),
      this.invListener?.removeListeners(),
      this.escrowFactoryListener?.removeListeners(),
    ]);
  }
}

// Bootstrap
(async () => {
  const mgr = ListenerManager.getInstance();
  await mgr.initialize(
    fiDeploy.contracts.CPAMM,
    fiDeploy.contracts.CSAMM,
    scDeploy.contracts.provenance,
    scDeploy.contracts.inventoryManagement,
    reDeploy.contracts.escrowFactory
  );
})();

// Prevent Node from exiting
process.stdin.resume();
