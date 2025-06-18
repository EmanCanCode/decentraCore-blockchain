# ┌───────────────────────────────────────────────────────────────────────────┐
# │ Dockerfile for your "blockchain" module                                   │
# │  - Builds a single image that can:                                        │
# │     • Run a local Hardhat node                                            │
# │     • Run your deploy / seed / listener / metadata scripts via `npx`      │
# │                                                                           │
# │ This is geared toward development & testing, so we install dev-deps too.  │
# └───────────────────────────────────────────────────────────────────────────┘

# 1) Base image: Node 22.14.0 on Alpine Linux (small footprint)
#    - Contains Node.js and npm.
FROM node:22.14.0-alpine

# 2) Set a working directory inside the container.
#    All COPY, RUN, CMD commands will be relative to /app.
WORKDIR /app

# 3) Copy only package manifests first.
#    This allows Docker to cache the npm install step if your deps don't change.
COPY package.json package-lock.json ./

# 4) Install all dependencies (including devDependencies).
#    We need hardhat, ts-node, typescript, etc. for running scripts.
#    Also install `wait-on` globally so we can wait for the Hardhat RPC in our deploy step.
RUN npm install --legacy-peer-deps \
  && npm install -g wait-on

# 5) Copy the rest of your project source code into the container.
#    Now your scripts/, listeners/, blockchain/, etc. are in /app.
COPY . .

# 6) Expose ports to the host machine:
#    - 8545 → Hardhat network (both HTTP and WebSocket)
#    - 3001 → NFT metadata server (METADATA_PORT)
EXPOSE 8545 3001

# 7) Default command when container starts with no override:
#    Launches Hardhat’s local node on all interfaces so other containers can reach it.
#    --network localhost ensures it uses the "localhost" network config in hardhat.config.ts
CMD ["npx", "hardhat", "node", "--port", "8545"]
