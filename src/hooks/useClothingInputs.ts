import { useCallback } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { AIProject } from '../types/aiProject';
import { uploadFileToOSS } from '../utils/ossClient';

const AUTO_RENAME_PROJECT_NAMES = new Set(['新项目', '默认项目', '项目_1']);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('无法读取图片内容'));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

interface ClothingInputsOptions {
  activeProjectId: string;
  setProjects: Dispatch<SetStateAction<AIProject[]>>;
  topClothingUrl: string;
  setTopClothingUrl: Dispatch<SetStateAction<string>>;
  bottomClothingUrl: string;
  setBottomClothingUrl: Dispatch<SetStateAction<string>>;
  referenceOutfitUrls: string[];
  setReferenceOutfitUrl: Dispatch<SetStateAction<string>>;
  setReferenceOutfitUrls: Dispatch<SetStateAction<string[]>>;
  triggerOutfitStylist: (topUrl: string, bottomUrl: string) => Promise<void>;
}

export function useClothingInputs({
  activeProjectId,
  setProjects,
  topClothingUrl,
  setTopClothingUrl,
  bottomClothingUrl,
  setBottomClothingUrl,
  referenceOutfitUrls,
  setReferenceOutfitUrl,
  setReferenceOutfitUrls,
  triggerOutfitStylist
}: ClothingInputsOptions) {
  const renameDefaultProject = useCallback((filename: string, fallback: string) => {
    const baseName = filename.split('.')[0] || fallback;
    setProjects(previous => previous.map(project => {
      const shouldRename = project.id === activeProjectId && (
        project.name.startsWith('新项目_') || AUTO_RENAME_PROJECT_NAMES.has(project.name)
      );
      return shouldRename ? { ...project, name: `项目 - ${baseName}` } : project;
    }));
  }, [activeProjectId, setProjects]);

  const handleTopClothingUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    renameDefaultProject(file.name, '上装');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setTopClothingUrl(dataUrl);
      await triggerOutfitStylist(dataUrl, bottomClothingUrl);
    } catch (error) {
      console.error('Failed to read top clothing image:', error);
    } finally {
      event.target.value = '';
    }
  }, [bottomClothingUrl, renameDefaultProject, setTopClothingUrl, triggerOutfitStylist]);

  const handleBottomClothingUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    renameDefaultProject(file.name, '下装');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBottomClothingUrl(dataUrl);
      await triggerOutfitStylist(topClothingUrl, dataUrl);
    } catch (error) {
      console.error('Failed to read bottom clothing image:', error);
    } finally {
      event.target.value = '';
    }
  }, [renameDefaultProject, setBottomClothingUrl, topClothingUrl, triggerOutfitStylist]);

  const handleReferenceOutfitUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const availableSlots = 3 - referenceOutfitUrls.length;
    if (availableSlots <= 0) {
      alert('最多只能上传 3 套穿搭参考图！');
      event.target.value = '';
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    renameDefaultProject(selectedFiles[0].name, '穿搭参考');
    try {
      const uploadedUrls = await Promise.all(selectedFiles.map(file => uploadFileToOSS(file)));
      setReferenceOutfitUrls(previous => {
        const next = [...previous, ...uploadedUrls].slice(0, 3);
        setReferenceOutfitUrl(next[0] || '');
        return next;
      });
    } catch (error) {
      console.error('Failed to upload reference outfit to OSS:', error);
      alert(`参考图上传 OSS 失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      event.target.value = '';
    }
  }, [referenceOutfitUrls.length, renameDefaultProject, setReferenceOutfitUrl, setReferenceOutfitUrls]);

  return { handleTopClothingUpload, handleBottomClothingUpload, handleReferenceOutfitUpload };
}
