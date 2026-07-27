// packages/block-editor/src/utils/pasting.ts
import { getFilesFromDataTransfer } from "@wordpress/dom";
function removeWindowsFragments(html) {
  const startStr = "<!--StartFragment-->";
  const startIdx = html.indexOf(startStr);
  if (startIdx > -1) {
    html = html.substring(startIdx + startStr.length);
  } else {
    return html;
  }
  const endStr = "<!--EndFragment-->";
  const endIdx = html.indexOf(endStr);
  if (endIdx > -1) {
    html = html.substring(0, endIdx);
  }
  return html;
}
function removeCharsetMetaTag(html) {
  const metaTag = `<meta charset='utf-8'>`;
  if (html.startsWith(metaTag)) {
    return html.slice(metaTag.length);
  }
  return html;
}
function getPasteEventData({
  clipboardData
}) {
  let plainText = "";
  let html = "";
  try {
    plainText = clipboardData.getData("text/plain");
    html = clipboardData.getData("text/html");
  } catch {
    return;
  }
  html = removeWindowsFragments(html);
  html = removeCharsetMetaTag(html);
  const files = getFilesFromDataTransfer(clipboardData);
  if (files.length && !shouldDismissPastedFiles(files, html)) {
    return { files };
  }
  return { html, plainText, files: [] };
}
function shouldDismissPastedFiles(files, html) {
  if (html && files?.length === 1 && files[0].type.indexOf("image/") === 0) {
    const IMAGE_TAG = /<\s*img\b/gi;
    if (html.match(IMAGE_TAG)?.length !== 1) {
      return true;
    }
    const IMG_WITH_LOCAL_SRC = /<\s*img\b[^>]*\bsrc="file:\/\//i;
    if (html.match(IMG_WITH_LOCAL_SRC)) {
      return true;
    }
  }
  return false;
}
export {
  getPasteEventData,
  shouldDismissPastedFiles
};
