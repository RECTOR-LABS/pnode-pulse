# CLAUDE.md - pNode Pulse

## Project Overview

**pNode Pulse** - Real-time analytics platform for Xandeum's pNode network.

## Technical Context

### Xandeum
- Scalable storage layer for Solana programs
- pNodes = distributed storage nodes storing encrypted data pages
- Provides "disk" to Solana's "RAM" (cheaper than Solana accounts)

### Data Source: pRPC API
- **Endpoint**: `http://<pnode-ip>:6000/rpc` (JSON-RPC 2.0)
- **Methods**:
  - `get-version` - pNode software version
  - `get-stats` - CPU, RAM, uptime, packets, storage metrics
  - `get-pods` - Network peers (address, version, last_seen)

### Network Ports
| Port | Service |
|------|---------|
| 6000 | pRPC API |
| 9001 | Gossip protocol |
| 5000 | Atlas server |
| 80 | Stats dashboard |

### SDK
- `@xandeum/web3.js` - npm package
- DevNet RPC: `https://apis.devnet.xandeum.com`

## Key Challenges

1. **pRPC is localhost-only** - Need own pNode or public endpoint
2. **Limited API surface** - Only 3 methods currently available
3. **v0.7 Heidelberg** (coming) - Will add paging statistics APIs

## Competitors

| Platform | Network | Focus |
|----------|---------|-------|
| Filfox/Filscan | Filecoin | Storage provider analytics |
| beaconcha.in | Ethereum | Validator monitoring |
| Solana Beach | Solana | Validator stats |

## Resources

- [Xandeum Docs](https://www.xandeum.network/docs)
- [Discord](https://discord.com/invite/mGAxAuwnR9)
- [GitHub](https://github.com/Xandeum)

## Status

**Phase**: Planning & Strategy
