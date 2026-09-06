import { useCallback, useState } from 'react';
import { generateOutfitSuggestion } from '../utils/aiGateway';

interface OutfitStylistOptions {
  gatewayUrl: string;
  gatewayToken: string;
}

export function useOutfitStylist({ gatewayUrl, gatewayToken }: OutfitStylistOptions) {
  const [matchingItemDesc, setMatchingItemDesc] = useState('');
  const [shoesDesc, setShoesDesc] = useState('');
  const [accessoriesDesc, setAccessoriesDesc] = useState('');
  const [isStylingLoading, setIsStylingLoading] = useState(false);

  const triggerOutfitStylist = useCallback(async (topUrl: string, bottomUrl: string) => {
    if ((!topUrl && !bottomUrl) || !gatewayUrl.trim() || !gatewayToken.trim()) return;

    setIsStylingLoading(true);
    try {
      const suggestion = await generateOutfitSuggestion({
        topUrl: topUrl || undefined,
        bottomUrl: bottomUrl || undefined,
        gatewayUrl,
        gatewayToken
      });
      setMatchingItemDesc(suggestion.matchingItem);
      setShoesDesc(suggestion.shoes);
      setAccessoriesDesc(suggestion.accessories);
    } catch (error) {
      console.error('Stylist generation failed:', error);
    } finally {
      setIsStylingLoading(false);
    }
  }, [gatewayToken, gatewayUrl]);

  return {
    matchingItemDesc,
    setMatchingItemDesc,
    shoesDesc,
    setShoesDesc,
    accessoriesDesc,
    setAccessoriesDesc,
    isStylingLoading,
    triggerOutfitStylist
  };
}
