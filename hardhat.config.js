const PRIVATE_KEY = process.env.PRIVATE_KEY || null;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  networks: {
    astar: {
      chainId: 592,
      url: "https://evm.astar.network",
    },
    shibuya: {
      url: "https://evm.shibuya.astar.network",
      chainId: 81,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
    },
  },
};
