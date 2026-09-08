export interface StoryboardItem {
  id: string;
  name: string;
  shotType: 'full-body' | 'medium' | 'close-up' | 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5';
  imageSrc: string;
  videoSrc: string | null;
  videoBlob?: Blob;
  isGeneratingVideo: boolean;
  progress: number;
  isGeneratingImage?: boolean;
  videoTaskId?: string;
}

export interface AIProject {
  id: string;
  name: string;
  createdAt: string;
  topClothingUrl: string;
  bottomClothingUrl: string;
  referenceOutfitUrl?: string;
  referenceOutfitUrls?: string[];
  modelOutfitImgUrl: string | null;
  modelOutfitImgUrls?: string[];
  modelGender: 'female' | 'male';
  modelRegion: 'east-asian' | 'western';
  modelScene: string;
  sceneImgUrl?: string;
  i2vMasterPrompt15s: string;
  i2vPrompts: {
    'full-body': string;
    'medium': string;
    'close-up': string;
    swapModelUrl?: string;
  };
  storyboards: StoryboardItem[];
  i2vStep: 'idle' | 'storyboard_generated' | 'video_generated';
  videoDuration?: '3s' | '15s';
  isOutfitImgGenerating: boolean;
  isI2vGenerating: boolean;
  isStoryboardGenerating?: boolean;
}
