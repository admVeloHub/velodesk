/**
 * processContentHtml v1.0.0 — VeloNews (Desk)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { getVelohubApiBaseUrl } from '../../config/velohubApiConfig';

export function processContentHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') return htmlContent || '';

  const API_BASE_URL = getVelohubApiBaseUrl();
  let processedHtml = htmlContent;
  const bucketUrlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(img_velonews\/[^"'\s)]+|img_artigos\/[^"'\s)]+)/g;

  processedHtml = processedHtml.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^/]+\/api\/images\/(img_velonews\/[^)]+|img_artigos\/[^)]+))\)/gi,
    () => ''
  );
  processedHtml = processedHtml.replace(
    /<img([^>]*src=["'])(https?:\/\/[^/]+\/api\/images\/(img_velonews\/[^"']+|img_artigos\/[^"']+))([^>]*)>/gi,
    () => ''
  );
  processedHtml = processedHtml.replace(/<img\b[^>]*\/api\/images\/(?:img_velonews|img_artigos)\/[^>]*>/gi, '');
  processedHtml = processedHtml.replace(
    /<a([^>]*href=["'])(https?:\/\/[^/]+\/api\/images\/(img_velonews\/[^"']+|img_artigos\/[^"']+))([^>]*)>([^<]*)<\/a>/gi,
    () => ''
  );
  processedHtml = processedHtml.replace(
    /<a\b[^>]*href=["']https?:\/\/[^"']+\/api\/images\/(?:img_velonews|img_artigos)\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    ''
  );
  processedHtml = processedHtml.replace(
    /!?https?:\/\/[^/\s"'<]+\/api\/images\/(?:img_velonews|img_artigos)\/[^<"']*\.(?:png|jpe?g|gif|webp)(?:\?[^\s"'<>]*)?/gi,
    ''
  );
  processedHtml = processedHtml.replace(/!\[([^\]]*)\]\((https:\/\/storage\.googleapis\.com\/[^)]+)\)/g, () => '');
  processedHtml = processedHtml.replace(
    /<img([^>]*src=["'])(https:\/\/storage\.googleapis\.com\/[^/]+\/(img_velonews\/[^"']+|img_artigos\/[^"']+))([^>]*)>/gi,
    (match, beforeSrc, bucketUrl, afterAttrs) => {
      const pathMatch = bucketUrl.match(/(img_velonews\/[^"'\s)]+|img_artigos\/[^"'\s)]+)/);
      if (pathMatch && API_BASE_URL) {
        const encodedPath = pathMatch[1].split('/').map((part) => encodeURIComponent(part)).join('/');
        let processedAttrs = afterAttrs
          .replace(/\s+alt=["']([^"']*\.(jpg|jpeg|png|gif|webp))["']/gi, '')
          .replace(/\s+title=["']([^"']*\.(jpg|jpeg|png|gif|webp))["']/gi, '');
        return `<img${beforeSrc}${API_BASE_URL}/images/${encodedPath}${processedAttrs}>`;
      }
      return match;
    }
  );
  processedHtml = processedHtml.replace(bucketUrlPattern, (match, imagePath) => {
    if (!API_BASE_URL) return match;
    const encodedPath = imagePath.split('/').map((part) => encodeURIComponent(part)).join('/');
    return `${API_BASE_URL}/images/${encodedPath}`;
  });
  processedHtml = processedHtml.replace(
    /(?<!['"=])(https:\/\/storage\.googleapis\.com\/[^/]+\/(img_velonews\/[^\s)]+|img_artigos\/[^\s)]+))/g,
    ''
  );
  processedHtml = processedHtml.replace(/\s*"\s*alt=["']temp:[^"']*["']\s*\/?>/gi, '');

  return processedHtml;
}
