export interface ModelAsset {
  id: string;
  src: string;
  date: string;
  name: string;
}

export interface SceneAsset {
  id: string;
  name: string;
  src: string;
}

export interface AudioAsset {
  id: string;
  name: string;
  src: string;
  desc?: string;
}

export interface LocalVideoAsset {
  id: string;
  name: string;
  src: string;
  desc: string;
  duration?: number;
}
