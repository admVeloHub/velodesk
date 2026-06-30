/**
 * mediaContentHelpers v1.0.0 — VeloNews (Desk)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { getVelohubApiBaseUrl } from '../../config/velohubApiConfig';

function apiImagesUrl(relativePath) {
  const base = getVelohubApiBaseUrl();
  if (!base || !relativePath) return null;
  const encodedPath = relativePath.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${base}/images/${encodedPath}`;
}

export function getImageUrl(item) {
  const images = item?.media?.images || item?.images || [];
  if (!Array.isArray(images) || images.length === 0) return null;

  const firstImage = images[0];

  if (
    typeof firstImage === 'string'
    && (firstImage.startsWith('img_velonews/')
      || firstImage.startsWith('img_artigos/')
      || firstImage.startsWith('/img_velonews/')
      || firstImage.startsWith('/img_artigos/'))
  ) {
    const cleanPath = firstImage.startsWith('/') ? firstImage.substring(1) : firstImage;
    return apiImagesUrl(cleanPath);
  }

  if (firstImage?.path) {
    const cleanPath = firstImage.path.startsWith('/') ? firstImage.path.substring(1) : firstImage.path;
    return apiImagesUrl(cleanPath);
  }

  if (typeof firstImage === 'string' && firstImage.startsWith('http')) return firstImage;
  if (firstImage?.url?.startsWith('http')) return firstImage.url;

  return null;
}

export function getAllImages(item) {
  const images = item?.media?.images || item?.images || [];
  if (!Array.isArray(images) || images.length === 0) return [];

  return images
    .map((img) => {
      if (
        typeof img === 'string'
        && (img.startsWith('img_velonews/')
          || img.startsWith('img_artigos/')
          || img.startsWith('/img_velonews/')
          || img.startsWith('/img_artigos/'))
      ) {
        const cleanPath = img.startsWith('/') ? img.substring(1) : img;
        return apiImagesUrl(cleanPath);
      }
      if (img?.path) {
        const cleanPath = img.path.startsWith('/') ? img.path.substring(1) : img.path;
        return apiImagesUrl(cleanPath);
      }
      if (typeof img === 'string' && img.startsWith('http')) return img;
      if (img?.url?.startsWith('http')) return img.url;
      return null;
    })
    .filter(Boolean);
}

export function getYouTubeThumbnail(item) {
  const videos = item?.media?.videos || item?.videos || [];
  if (!Array.isArray(videos) || videos.length === 0) return null;

  let youtubeUrl = null;
  for (const v of videos) {
    if (typeof v === 'string' && (v.includes('youtube.com') || v.includes('youtu.be'))) {
      youtubeUrl = v;
      break;
    }
    if (v && typeof v === 'object' && (v.type === 'youtube' || v.embed || v.url)) {
      youtubeUrl = v.url || v.embed || '';
      break;
    }
  }

  if (!youtubeUrl) return null;
  const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^"&?/\s]{11})/);
  if (!videoIdMatch?.[1]) return null;
  return `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`;
}
