import { CpammListener } from './cpamm';
import { CsammListener } from './csamm';
import { WebSocketProvider } from '@ethersproject/providers';
import { getResilientProvider } from '../utils/provider'; // adjust path
import * as deployLogs from '../../logs/finance/deploy.json';
import dotenv from 'dotenv';
dotenv.config();

class FinanceManager {
    private cpammListener: CpammListener;
    private csammListener: CsammListener;
    private provider: WebSocketProvider;

    constructor() {
        if (!process.env.PROVIDER_URL) {
            throw new Error("PROVIDER_URL is not set in .env");
        }

        // initialize websocket provider
        const raw = process.env.PROVIDER_URL!;
        // turn http(s):// to ws(s)://
        const url = raw.replace(/^https?:\/\//, "ws://").replace(/\/$/, "");
        this.provider = getResilientProvider(url);

        // initialize listeners
        this.cpammListener = new CpammListener(this.provider);
        this.csammListener = new CsammListener(this.provider);
    }

    async start() {
        // initialize contracts
        await this.cpammListener.setCpamm(deployLogs.contracts.CPAMM);
        await this.csammListener.setCsamm(deployLogs.contracts.CSAMM);
        // start listening
        console.log("Starting FinanceManager listeners...");
        this.cpammListener.listen();
        this.csammListener.listen();
    }
}

// const financeManager = new FinanceManager();
// (async () => {
//     try {
//         await financeManager.start();
//         console.log("FinanceManager started successfully.");
//     } catch (error) {
//         console.error("Error starting FinanceManager:", error);
//     }
// })();