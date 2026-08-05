import "server-only";
export function prepareImageSource(buffer: Buffer, mimeType: string) { return { fileData: buffer.toString("base64"), mimeType }; }
