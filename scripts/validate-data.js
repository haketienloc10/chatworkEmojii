const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const fileListPath = path.join(dataDir, "file_list.json");
const previewPattern = /^\[preview id=(\d+) ht=(\d+)\]$/;

const errors = [];
const warnings = [];
const ids = new Map();
const previewIds = new Map();
let total = 0;

function addIssue(collection, file, index, message) {
  const location = Number.isInteger(index) ? `${file}[${index}]` : file;
  collection.push(`${location}: ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(rootDir, filePath)}: ${error.message}`);
    return null;
  }
}

function parsePreviewId(id) {
  if (typeof id !== "string") return null;
  const match = id.match(previewPattern);
  if (!match) return null;

  return {
    previewId: match[1],
    height: Number(match[2]),
  };
}

function getUrlFileId(url) {
  if (typeof url !== "string") return null;

  try {
    const parsed = new URL(url, "https://www.chatwork.com/");
    return parsed.searchParams.get("file_id");
  } catch (_error) {
    return null;
  }
}

function isKnownStickerUrl(url) {
  if (typeof url !== "string") return false;
  if (url.startsWith("gateway/download_file.php?")) return true;
  if (url.startsWith("gateway/preview_file.php?")) return true;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "www.chatwork.com" &&
      (parsed.pathname === "/gateway/download_file.php" ||
        parsed.pathname === "/gateway/preview_file.php")
    );
  } catch (_error) {
    return false;
  }
}

function rememberUnique(map, key, file, index, field) {
  if (!key) return;
  const previous = map.get(key);
  const current = `${file}[${index}]`;

  if (previous) {
    addIssue(errors, file, index, `duplicate ${field} "${key}" also found at ${previous}`);
    return;
  }

  map.set(key, current);
}

const fileList = readJson(fileListPath);
if (!fileList || !Array.isArray(fileList.files)) {
  errors.push("data/file_list.json: expected { \"files\": [ ... ] }");
} else {
  fileList.files.forEach((fileName, fileIndex) => {
    if (typeof fileName !== "string" || !fileName.endsWith(".json")) {
      addIssue(errors, "data/file_list.json", fileIndex, "file name must be a .json string");
      return;
    }

    const relativeFile = path.join("data", fileName);
    const data = readJson(path.join(dataDir, fileName));
    if (!Array.isArray(data)) {
      addIssue(errors, relativeFile, null, "expected an array of sticker items");
      return;
    }

    data.forEach((item, itemIndex) => {
      total += 1;

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        addIssue(errors, relativeFile, itemIndex, "sticker must be an object");
        return;
      }

      if (typeof item.id !== "string" || item.id.trim() === "") {
        addIssue(errors, relativeFile, itemIndex, "missing required string field id");
      }

      if (typeof item.url !== "string" || item.url.trim() === "") {
        addIssue(errors, relativeFile, itemIndex, "missing required string field url");
      }

      const parsedPreview = parsePreviewId(item.id);
      if (!parsedPreview) {
        addIssue(errors, relativeFile, itemIndex, "id must match [preview id=<file_id> ht=<height>]");
      } else {
        rememberUnique(previewIds, parsedPreview.previewId, relativeFile, itemIndex, "previewId");
      }

      rememberUnique(ids, item.id, relativeFile, itemIndex, "id");

      const urlFileId = getUrlFileId(item.url);
      if (parsedPreview && urlFileId && urlFileId !== parsedPreview.previewId) {
        addIssue(
          warnings,
          relativeFile,
          itemIndex,
          `url file_id "${urlFileId}" does not match previewId "${parsedPreview.previewId}"`
        );
      }

      if (!isKnownStickerUrl(item.url)) {
        addIssue(warnings, relativeFile, itemIndex, `suspicious sticker url "${item.url}"`);
      }
    });
  });
}

console.log(`Validated ${total} sticker items across ${fileList && fileList.files ? fileList.files.length : 0} files.`);

if (warnings.length > 0) {
  console.warn(`\nWarnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length > 0) {
  console.error(`\nErrors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Sticker data validation passed.");
