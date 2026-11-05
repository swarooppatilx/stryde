import { TerritoryBurned, TerritoryMinted } from '../../generated/TerritoryNFT/TerritoryNFT';
import { TerritoryNft } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleTerritoryMinted(event: TerritoryMinted): void {
  const nft = new TerritoryNft(event.params.polygonHash);
  nft.tokenId = event.params.tokenId;
  nft.owner = getOrCreateProfile(event.params.recipient).id;
  nft.mintedAt = event.block.timestamp;
  nft.burned = false;
  nft.save();
}

export function handleTerritoryBurned(event: TerritoryBurned): void {
  const nft = TerritoryNft.load(event.params.polygonHash);
  if (!nft) return;
  nft.burned = true;
  nft.burnedAt = event.block.timestamp;
  nft.save();
}
