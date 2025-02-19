// interfaces
export interface ContractsToDeploy {
    cpamm: boolean;  // constant product automated market maker (uniswap)
    csamm: boolean;  // constant sum automated market maker 
    obmm: boolean; // order book market maker
}

export interface DeployedContracts {
    [contractName: string]: string; // contract name to contract address
}

export interface DeploymentLog {
    contracts: DeployedContracts;
    timestamp: number; // Date.now()
}
